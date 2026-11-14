#!/usr/bin/env bash
# ==============================================================================
# Offline test for deploy/setup-github-deploy.sh (fake gcloud, no GCP access, no cost)
# ==============================================================================
#   first_run   : only deploy.sh resources exist -> deployer, pool and provider created
#   rerun       : everything exists              -> nothing created, provider updated
#   no-runner   : deploy.sh has not run          -> exit 1 before any change
#   key-found   : the deployer has a key         -> exit 1
#   dry run     : no gcloud call at all
# Every successful run also checks least privilege (no project-wide writer,
# Service Account User or secret access for the deployer; no key is created) and
# that the condition and the principal set use this repository's IDs.
# Run (repository root):  bash deploy/tests/test_setup_github_stub.sh
# ==============================================================================
set -euo pipefail
SCRIPT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/setup-github-deploy.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail() { echo "FAIL $*"; exit 1; }

cat > "$TMP/gcloud" <<'STUB'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$GCLOUD_LOG"
case "${1:-} ${2:-} ${3:-}" in
  'projects describe '*) echo 123456789012; exit 0 ;;
  'iam service-accounts describe')
    case "$4" in
      nutgpuhub-runner@*) [ "$STUB_MODE" != no-runner ]; exit $? ;;
      *) [ "$STUB_MODE" = rerun ]; exit $? ;;
    esac ;;
  'artifacts repositories describe') exit 0 ;;
  'iam workload-identity-pools describe') [ "$STUB_MODE" = rerun ]; exit $? ;;
  'iam workload-identity-pools providers') if [ "$4" = describe ]; then [ "$STUB_MODE" = rerun ]; exit $?; fi ;;
  'iam service-accounts keys') [ "$STUB_MODE" != key-found ] || echo 'projects/p/serviceAccounts/d/keys/abc'; exit 0 ;;
esac
exit 0
STUB
chmod +x "$TMP/gcloud"
export PATH="$TMP:$PATH" PROJECT_ID=stub-project REGION=asia-southeast1 DRY_RUN=0

CONDITION="assertion.repository_id == '1448293003' && assertion.repository_owner_id == '249026567' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'Kawi-HBLI/NutGPUHub/.github/workflows/deploy.yml@refs/heads/main' && assertion.sub == 'repo:Kawi-HBLI@249026567/NutGPUHub@1448293003:environment:demo'"
DEPLOYER='serviceAccount:nutgpuhub-deployer@stub-project.iam.gserviceaccount.com'

for MODE in first_run rerun no-runner key-found; do
  export STUB_MODE="$MODE" GCLOUD_LOG="$TMP/$MODE.log"
  result=0
  bash "$SCRIPT" > "$TMP/out" 2>&1 || result=$?
  case "$MODE" in
    no-runner)
      [ "$result" -eq 1 ] || fail 'ran without the runtime account'
      if grep -Eq ' (create|create-oidc|add-iam-policy-binding|enable) ' "$GCLOUD_LOG"; then fail 'changed GCP before the prerequisite check'; fi
      echo 'PASS: no-runner stops before any change'; continue ;;
    key-found)
      [ "$result" -eq 1 ] || fail 'accepted a deployer with a key'
      echo 'PASS: key-found fails'; continue ;;
  esac
  [ "$result" -eq 0 ] || { cat "$TMP/out"; fail "$MODE exit $result"; }

  grep -q "^projects add-iam-policy-binding stub-project --member=${DEPLOYER} --role=roles/run.developer " "$GCLOUD_LOG" || fail 'Cloud Run Developer'
  grep -q "^artifacts repositories add-iam-policy-binding nutgpuhub .*--member=${DEPLOYER} --role=roles/artifactregistry.writer" "$GCLOUD_LOG" || fail 'repository writer'
  grep -q "^iam service-accounts add-iam-policy-binding nutgpuhub-runner@stub-project.iam.gserviceaccount.com --member=${DEPLOYER} --role=roles/iam.serviceAccountUser" "$GCLOUD_LOG" || fail 'act as runner'
  if [ "$(grep -c '^projects add-iam-policy-binding' "$GCLOUD_LOG")" -ne 1 ]; then fail 'extra project-wide role'; fi
  if grep -Eq 'secretmanager|keys create|roles/(owner|editor|iam\.serviceAccountTokenCreator)' "$GCLOUD_LOG"; then fail 'deployer gets more than it needs'; fi
  grep -q "^iam service-accounts add-iam-policy-binding nutgpuhub-deployer@stub-project.iam.gserviceaccount.com --member=principalSet://iam.googleapis.com/projects/123456789012/locations/global/workloadIdentityPools/github-actions/attribute.repository_id/1448293003 --role=roles/iam.workloadIdentityUser" "$GCLOUD_LOG" || fail 'principal set'
  grep -Fq -- "--attribute-condition=${CONDITION}" "$GCLOUD_LOG" || fail 'attribute condition'
  grep -Fq 'WIF_PROVIDER        = projects/123456789012/locations/global/workloadIdentityPools/github-actions/providers/github-main' "$TMP/out" || fail 'printed provider'
  case "$MODE" in
    first_run)
      grep -q '^iam service-accounts create nutgpuhub-deployer ' "$GCLOUD_LOG" || fail 'deployer not created'
      grep -q '^iam workload-identity-pools create github-actions ' "$GCLOUD_LOG" || fail 'pool not created'
      grep -q '^iam workload-identity-pools providers create-oidc github-main .*--issuer-uri=https://token.actions.githubusercontent.com ' "$GCLOUD_LOG" || fail 'provider not created' ;;
    rerun)
      if grep -Eq ' (create|create-oidc) ' "$GCLOUD_LOG"; then fail 'rerun created a resource again'; fi
      grep -q '^iam workload-identity-pools providers update-oidc github-main ' "$GCLOUD_LOG" || fail 'provider not updated' ;;
  esac
  echo "PASS: $MODE (roles, condition, principal set, no key)"
done

export GCLOUD_LOG="$TMP/dry.log"
DRY_RUN=1 bash "$SCRIPT" > "$TMP/dry-out"
[ ! -f "$GCLOUD_LOG" ] || fail 'dry run called gcloud'
grep -q 'create-oidc github-main' "$TMP/dry-out" || fail 'dry run plan'
echo 'PASS: dry run makes no gcloud calls'
