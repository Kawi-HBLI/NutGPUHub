#!/usr/bin/env bash
# ==============================================================================
# Offline test for deploy/release.sh (fake `gcloud`, no GCP access, no cost)
# Adapted from the Lab 5 starter kit.
# ==============================================================================
#   1. normal release : image pinned by @sha256 digest, migration awaited (--wait),
#                       service updated with APP_COMMIT, SERVICE_URL = APP_ORIGIN
#   2. rollback       : service updated, migration job not touched
#   3. image missing / migration fails : service not updated
#   4. no APP_ORIGIN  : SERVICE_URL falls back to status.url
#   5. invalid tag    : rejected before any gcloud call
# Run (repository root):  bash deploy/tests/test_release_stub.sh
# ==============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TASK_TMP="$(mktemp -d)"
trap 'rm -rf "$TASK_TMP"' EXIT
export PROJECT_ID=release-test REGION=asia-southeast1
export IMAGE_TAG=1111111111111111111111111111111111111111
export CALL_LOG="$TASK_TMP/calls" GITHUB_ENV="$TASK_TMP/env"
export PATH="$TASK_TMP:$PATH"
cat > "$TASK_TMP/gcloud" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$CALL_LOG"
case "$*" in
  'artifacts docker images describe '*)
    [[ "${FAIL_AT:-}" != image ]] || exit 1
    echo 'asia-southeast1-docker.pkg.dev/release-test/nutgpuhub/nutgpuhub@sha256:abcdef' ;;
  'run jobs execute '*) [[ "${FAIL_AT:-}" != migration ]] || exit 1 ;;
  'run services describe '*)
    if [[ "${NO_APP_ORIGIN:-}" == 1 ]]; then env='[{"name":"NODE_ENV","value":"production"}]'
    else env='[{"name":"NODE_ENV","value":"production"},{"name":"APP_ORIGIN","value":"https://nutgpuhub-123456789012.asia-southeast1.run.app"},{"name":"DATABASE_URL","valueFrom":{"secretKeyRef":{"name":"nutgpuhub-database-url","key":"latest"}}}]'
    fi
    printf '{"spec":{"template":{"spec":{"containers":[{"env":%s}]}}},"status":{"url":"https://nutgpuhub-abc123-as.a.run.app"}}\n' "$env" ;;
esac
STUB
chmod +x "$TASK_TMP/gcloud"
export ROLLBACK=false
bash "$ROOT/deploy/release.sh"
grep -q 'artifacts docker images describe asia-southeast1-docker.pkg.dev/release-test/nutgpuhub/nutgpuhub:1111111111111111111111111111111111111111' "$CALL_LOG"
grep -q 'run jobs update nutgpuhub-migrate .*@sha256:abcdef' "$CALL_LOG"
grep -q 'run jobs execute nutgpuhub-migrate .*--wait' "$CALL_LOG"
grep -q 'run services update nutgpuhub .*@sha256:abcdef --update-env-vars=APP_COMMIT=1111111111111111111111111111111111111111 ' "$CALL_LOG"
grep -qx 'SERVICE_URL=https://nutgpuhub-123456789012.asia-southeast1.run.app' "$GITHUB_ENV"
grep -qx 'DEPLOYED_IMAGE=asia-southeast1-docker.pkg.dev/release-test/nutgpuhub/nutgpuhub@sha256:abcdef' "$GITHUB_ENV"
echo 'PASS normal release uses digest, waits for migration, records the commit and reports APP_ORIGIN'

: > "$CALL_LOG"
export ROLLBACK=true
bash "$ROOT/deploy/release.sh"
if grep -q 'run jobs' "$CALL_LOG"; then echo 'Rollback ran migration' >&2; exit 1; fi
grep -q 'run services update .*APP_COMMIT=1111111111111111111111111111111111111111' "$CALL_LOG"
echo 'PASS rollback reuses image without touching migration job'

for failure in image migration; do
  : > "$CALL_LOG"
  if ROLLBACK=false FAIL_AT="$failure" bash "$ROOT/deploy/release.sh"; then
    echo "Expected $failure failure" >&2; exit 1
  fi
  if grep -q 'run services update' "$CALL_LOG"; then
    echo "Service changed after $failure failure" >&2; exit 1
  fi
  echo "PASS $failure failure blocks service update"
done

: > "$GITHUB_ENV"
ROLLBACK=false NO_APP_ORIGIN=1 bash "$ROOT/deploy/release.sh" > /dev/null
grep -qx 'SERVICE_URL=https://nutgpuhub-abc123-as.a.run.app' "$GITHUB_ENV"
echo 'PASS falls back to status.url when APP_ORIGIN is not set'

: > "$CALL_LOG"
if IMAGE_TAG='invalid;tag' bash "$ROOT/deploy/release.sh"; then exit 1; fi
test ! -s "$CALL_LOG"
echo 'PASS invalid tag rejected before GCP calls'
