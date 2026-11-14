#!/usr/bin/env bash
# ==============================================================================
# Offline test for deploy/deploy.sh: every gcloud and openssl call is a local stub
# (no GCP access, no cost). Adapted from the Lab 5 starter kit.
# ==============================================================================
# Scenarios
#   first_run : nothing exists      -> everything is created
#   rerun     : everything exists   -> no credential is replaced
#   partial   : DB secret missing   -> DB user password reset + secret created
#   job-fail  : migration fails     -> exit 1, service not deployed
# Every scenario also checks: secret access is per secret (never project-wide),
# the DB password equals the one inside DATABASE_URL, no secret value is printed,
# the migration job gets DATABASE_URL and DEMO_PASSWORD but the service only
# DATABASE_URL, APP_ORIGIN is the deterministic service URL, and the image is
# tagged with the commit SHA. Finally: DRY_RUN=1 makes no gcloud call, and a bad
# argument or image tag stops the script before any gcloud call.
# Run (repository root):  bash deploy/tests/test_deploy_stub.sh
# ==============================================================================
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_SCRIPT="${SCRIPT_DIR}/../deploy.sh"
export TEST_STATE_DIR
TEST_STATE_DIR="$(mktemp -d)"
trap 'rm -rf "$TEST_STATE_DIR"' EXIT
mkdir -p "$TEST_STATE_DIR/bin"

fail() { echo "FAIL $*"; exit 1; }

# --- Fake `openssl` (deterministic "random" values) ---------------------------
cat > "$TEST_STATE_DIR/bin/openssl" <<'STUB'
#!/usr/bin/env bash
if [ "$2" = "-hex" ]; then
  printf '%s\n' '0123456789abcdef0123456789abcdef0123456789abcdef'
else
  printf '%s\n' 'TESTONLYGENERATEDPASSWORD'
fi
STUB

# --- Fake `gcloud`: logs each call (password redacted), answers per $STUB_MODE ---
cat > "$TEST_STATE_DIR/bin/gcloud" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
redacted=()
for arg in "$@"; do
  case "$arg" in
    --password=*)
      printf '%s' "${arg#--password=}" > "$TEST_STATE_DIR/sql-pass"
      redacted+=("--password=<REDACTED>") ;;
    *) redacted+=("$arg") ;;
  esac
done
printf '%s\n' "${redacted[*]}" >> "$GCLOUD_LOG"
case "${1:-} ${2:-} ${3:-}" in
  'config get-value project') echo stub-gcp-project; exit 0 ;;
  'projects describe '*) echo 123456789012; exit 0 ;;
  'run services describe') echo https://nutgpuhub-stub.example.invalid; exit 0 ;;
  'run jobs execute') [ "$STUB_MODE" != job-fail ]; exit $? ;;
  'secrets versions add') cat > "$TEST_STATE_DIR/payload-${4}"; exit 0 ;;
  'sql users list')
    if [ "$STUB_MODE" = first_run ]; then echo postgres; else printf 'postgres\nnutgpuhub\n'; fi
    exit 0 ;;
esac
for word in "$@"; do
  if [ "$word" = describe ]; then
    case "$STUB_MODE" in
      first_run) exit 1 ;;
      partial) if [ "${1:-} ${3:-}" = 'secrets nutgpuhub-database-url' ]; then exit 1; fi ;;
    esac
  fi
done
STUB
chmod +x "$TEST_STATE_DIR/bin/openssl" "$TEST_STATE_DIR/bin/gcloud"
export PATH="$TEST_STATE_DIR/bin:$PATH"
export PROJECT_ID=stub-gcp-project
export REGION=asia-southeast1
export IMAGE_TAG=abcdefabcdefabcdefabcdefabcdefabcdefabcd
export DRY_RUN=0
SERVICE_URL='https://nutgpuhub-123456789012.asia-southeast1.run.app'
IMAGE="asia-southeast1-docker.pkg.dev/stub-gcp-project/nutgpuhub/nutgpuhub:${IMAGE_TAG}"

for MODE in first_run rerun partial job-fail; do
  export STUB_MODE="$MODE"
  export GCLOUD_LOG="$TEST_STATE_DIR/gcloud-$MODE.log"
  rm -f "$TEST_STATE_DIR/sql-pass" "$TEST_STATE_DIR"/payload-*
  result=0
  bash "$DEPLOY_SCRIPT" > "$TEST_STATE_DIR/output" 2>&1 || result=$?
  expected=0
  if [ "$MODE" = job-fail ]; then expected=1; fi
  [ "$result" -eq "$expected" ] || { cat "$TEST_STATE_DIR/output"; fail "$MODE: unexpected exit $result (wanted $expected)"; }

  # Migration gate: the service is deployed only after the job succeeded.
  if [ "$MODE" = job-fail ]; then
    if grep -q '^run deploy ' "$GCLOUD_LOG"; then fail 'service deployed after migration failure'; fi
  else
    service="$(grep '^run deploy ' "$GCLOUD_LOG")" || fail "$MODE: service not deployed"
    case "$service" in *"--image ${IMAGE} "*) ;; *) fail 'service image is not tagged with the commit SHA' ;; esac
    case "$service" in *"APP_ORIGIN=${SERVICE_URL}"*) ;; *) fail 'APP_ORIGIN is not the service URL' ;; esac
    case "$service" in *DEMO_PASSWORD*) fail 'service receives DEMO_PASSWORD' ;; esac
    case "$service" in *'--min-instances 0 '*'--max-instances 3 '*) ;; *) fail 'scaling is not 0 to 3' ;; esac
    grep -q 'Deployment Completed!' "$TEST_STATE_DIR/output"
  fi
  job="$(grep '^run jobs deploy ' "$GCLOUD_LOG")" || fail "$MODE: migration job not deployed"
  case "$job" in *'DATABASE_URL=nutgpuhub-database-url:latest,DEMO_PASSWORD=nutgpuhub-demo-password:latest'*) ;; *) fail 'job secrets' ;; esac
  case "$job" in *'npx prisma migrate deploy && npm run db:seed'*) ;; *) fail 'job command' ;; esac

  # Least privilege: secret access per secret, never project-wide.
  if grep -q '^projects add-iam-policy-binding .*roles/secretmanager.secretAccessor' "$GCLOUD_LOG"; then
    fail 'runtime has project-wide secret access'
  fi
  for secret in nutgpuhub-database-url nutgpuhub-demo-password; do
    grep -q "^secrets add-iam-policy-binding $secret .*roles/secretmanager.secretAccessor" "$GCLOUD_LOG" || fail "no access to $secret"
  done
  if grep -q 'admin-password' "$GCLOUD_LOG"; then fail 'kit admin secret is still used'; fi

  case "$MODE" in
    first_run)
      grep -q -- '--edition=enterprise' "$GCLOUD_LOG" || fail 'missing --edition=enterprise'
      grep -q -- '--no-storage-auto-increase' "$GCLOUD_LOG" || fail 'storage auto-increase not disabled'
      grep -q '^sql users create ' "$GCLOUD_LOG" || fail 'DB user not created'
      demo="$(cat "$TEST_STATE_DIR/payload-nutgpuhub-demo-password")"
      [ "${#demo}" -ge 12 ] || fail 'demo password shorter than the seed allows' ;;
    partial)
      grep -q '^sql users set-password ' "$GCLOUD_LOG" || fail 'DB password not reset' ;;
    rerun)
      if grep -Eq '^(secrets create|sql users (create|set-password)|sql instances create) ' "$GCLOUD_LOG"; then
        fail 'rerun replaced existing resources or credentials'
      fi ;;
  esac

  # Secrets: DB password matches DATABASE_URL, and no value reaches the output.
  if [ -f "$TEST_STATE_DIR/sql-pass" ]; then
    db_pass="$(cat "$TEST_STATE_DIR/sql-pass")"
    db_url="$(cat "$TEST_STATE_DIR/payload-nutgpuhub-database-url")"
    case "$db_url" in
      "postgresql://nutgpuhub:${db_pass}@localhost/nutgpuhub?host=/cloudsql/stub-gcp-project:asia-southeast1:nutgpuhub-pg&"*) ;;
      *) fail 'DB password or socket path differs from the secret' ;;
    esac
    if grep -Fq "$db_pass" "$TEST_STATE_DIR/output"; then fail 'DB password leaked to output'; fi
  fi
  for secret_file in "$TEST_STATE_DIR"/payload-*; do
    [ -f "$secret_file" ] || continue
    secret_value="$(cat "$secret_file")"
    if [ -n "$secret_value" ] && grep -Fq "$secret_value" "$TEST_STATE_DIR/output"; then
      fail 'secret payload leaked to output'
    fi
  done
  echo "PASS: $MODE (exit, migration gate, secrets, APP_ORIGIN, image tag)"
done

# --- Inputs are checked before any gcloud call --------------------------------
export STUB_MODE=first_run GCLOUD_LOG="$TEST_STATE_DIR/bad-input-calls"
if bash "$DEPLOY_SCRIPT" --demo > /dev/null 2>&1; then fail 'unknown argument accepted'; fi
if IMAGE_TAG='latest' bash "$DEPLOY_SCRIPT" > /dev/null 2>&1; then fail 'non-SHA image tag accepted'; fi
if [ -f "$GCLOUD_LOG" ]; then fail 'bad input reached gcloud'; fi
echo 'PASS: bad argument and image tag rejected before gcloud'

# --- Dry run must not call gcloud at all ----------------------------------------
export GCLOUD_LOG="$TEST_STATE_DIR/dry-run-calls"
DRY_RUN=1 bash "$DEPLOY_SCRIPT" > "$TEST_STATE_DIR/dry-run-output"
if [ -f "$GCLOUD_LOG" ]; then fail 'dry run called gcloud'; fi
grep -q 'APP_ORIGIN=https://nutgpuhub-PROJECT_NUMBER.asia-southeast1.run.app' "$TEST_STATE_DIR/dry-run-output" || fail 'dry run APP_ORIGIN'
echo 'PASS: dry run makes no gcloud calls'
