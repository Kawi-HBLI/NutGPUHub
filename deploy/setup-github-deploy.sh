#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# NutGPUHub — let GitHub Actions deploy without a key (Student Guide Episode 6.2–6.3)
# ==============================================================================
# The same steps as the Console instructions in the guide, as one reviewable script.
# Run it once in Cloud Shell AFTER deploy/deploy.sh (the runtime account and the
# Artifact Registry repository must exist). Safe to run again.
#
# Usage (repository root, Cloud Shell):
#   DRY_RUN=1 PROJECT_ID=... REGION=asia-southeast1 bash deploy/setup-github-deploy.sh
#   PROJECT_ID=... REGION=asia-southeast1 bash deploy/setup-github-deploy.sh
#
# What it creates
#   - Deployer service account nutgpuhub-deployer, used only by .github/workflows/deploy.yml:
#       Cloud Run Developer (project)            update the service and the migration job
#       Artifact Registry Writer (repo nutgpuhub) push images to this repository only
#       Service Account User (on nutgpuhub-runner only) deploy revisions that run as the runtime account
#     It cannot read secrets, change IAM or create databases. It never gets a key.
#   - Workload Identity pool github-actions with OIDC provider github-main. The provider
#     accepts a GitHub token only from this repository (by ID, not by name), the main
#     branch, the deploy.yml workflow and the GitHub environment "demo".
#   - Workload Identity User on the deployer for tokens with repository_id = REPO_ID.
# At the end it prints the four variables for GitHub (Settings > Environments > demo).
#
# Repository IDs (not secret) from https://api.github.com/repos/Kawi-HBLI/NutGPUHub:
# id 1448293003, owner.id 249026567. The repository uses the immutable OIDC subject
# (repos/.../actions/oidc/customization/sub: use_immutable_subject = true).
# Offline test: deploy/tests/test_setup_github_stub.sh
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"
GITHUB_REPO="Kawi-HBLI/NutGPUHub"
GITHUB_OWNER="${GITHUB_REPO%%/*}"
GITHUB_NAME="${GITHUB_REPO##*/}"
REPO_ID="1448293003"
OWNER_ID="249026567"
ENV_NAME="demo"

if [ "$#" -gt 0 ]; then
  echo "Usage: [DRY_RUN=1] PROJECT_ID=... REGION=... bash deploy/setup-github-deploy.sh" >&2
  exit 1
fi

run_cmd() {
  local arg
  if [ "$DRY_RUN" = "1" ]; then printf '[DRY_RUN] '; else printf '+ '; fi
  for arg in "$@"; do printf '%q ' "$arg"; done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then "$@"; fi
}

# Runs a describe check; in a dry run it is only printed and treated as "missing".
exists() {
  if [ "$DRY_RUN" = "1" ]; then
    run_cmd "$@"
    return 1
  fi
  "$@" >/dev/null 2>&1
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
  PROJECT_NUMBER="PROJECT_NUMBER"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    exit 1
  fi
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  if ! [[ "$PROJECT_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: could not read the project number of ${PROJECT_ID}." >&2
    exit 1
  fi
fi

# Must match deploy/deploy.sh and .github/workflows/deploy.yml.
REPO_NAME="nutgpuhub"
RUNNER_EMAIL="nutgpuhub-runner@${PROJECT_ID}.iam.gserviceaccount.com"
DEPLOYER_NAME="nutgpuhub-deployer"
DEPLOYER_EMAIL="${DEPLOYER_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL_ID="github-actions"
PROVIDER_ID="github-main"
PROVIDER_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/providers/${PROVIDER_ID}"
PRINCIPAL_SET="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL_ID}/attribute.repository_id/${REPO_ID}"
ATTRIBUTE_MAPPING="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id"
WIF_CONDITION="assertion.repository_id == '${REPO_ID}' && assertion.repository_owner_id == '${OWNER_ID}' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '${GITHUB_REPO}/.github/workflows/deploy.yml@refs/heads/main' && assertion.sub == 'repo:${GITHUB_OWNER}@${OWNER_ID}/${GITHUB_NAME}@${REPO_ID}:environment:${ENV_NAME}'"

echo "=================================================================="
echo "NutGPUHub: GitHub Actions -> Google Cloud (Workload Identity Federation)"
echo "Project    : ${PROJECT_ID}"
echo "Repository : ${GITHUB_REPO} (id ${REPO_ID}, owner id ${OWNER_ID})"
echo "Environment: ${ENV_NAME}"
echo "Dry Run    : ${DRY_RUN}"
echo "=================================================================="

# Prerequisites from deploy/deploy.sh.
if [ "$DRY_RUN" != "1" ]; then
  for check in \
    "gcloud iam service-accounts describe ${RUNNER_EMAIL} --project ${PROJECT_ID}" \
    "gcloud artifacts repositories describe ${REPO_NAME} --location ${REGION} --project ${PROJECT_ID}"; do
    if ! $check >/dev/null 2>&1; then
      echo "Error: missing prerequisite (${check}). Run deploy/deploy.sh first." >&2
      exit 1
    fi
  done
fi

# 1. APIs used to exchange the GitHub token for a short-lived Google token.
run_cmd gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project "$PROJECT_ID"

# 2. Deployer service account and its three narrow roles.
if ! exists gcloud iam service-accounts describe "$DEPLOYER_EMAIL" --project "$PROJECT_ID"; then
  run_cmd gcloud iam service-accounts create "$DEPLOYER_NAME" \
    --display-name="NutGPUHub GitHub Actions deployer" \
    --project "$PROJECT_ID"
fi
run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/run.developer" \
  --condition=None \
  --quiet
run_cmd gcloud artifacts repositories add-iam-policy-binding "$REPO_NAME" \
  --location "$REGION" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/artifactregistry.writer" \
  --project "$PROJECT_ID" --quiet
run_cmd gcloud iam service-accounts add-iam-policy-binding "$RUNNER_EMAIL" \
  --member="serviceAccount:${DEPLOYER_EMAIL}" \
  --role="roles/iam.serviceAccountUser" \
  --project "$PROJECT_ID" --quiet

# 3. Workload Identity pool and the GitHub OIDC provider with the attribute condition.
if ! exists gcloud iam workload-identity-pools describe "$POOL_ID" --location=global --project "$PROJECT_ID"; then
  run_cmd gcloud iam workload-identity-pools create "$POOL_ID" \
    --location=global \
    --display-name="github-actions" \
    --project "$PROJECT_ID"
fi
if exists gcloud iam workload-identity-pools providers describe "$PROVIDER_ID" --workload-identity-pool="$POOL_ID" --location=global --project "$PROJECT_ID"; then
  # Keep an existing provider in line with this script (mapping and condition only).
  run_cmd gcloud iam workload-identity-pools providers update-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$WIF_CONDITION" \
    --project "$PROJECT_ID"
else
  run_cmd gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_ID" \
    --workload-identity-pool="$POOL_ID" \
    --location=global \
    --display-name="github-main" \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="$ATTRIBUTE_MAPPING" \
    --attribute-condition="$WIF_CONDITION" \
    --project "$PROJECT_ID"
fi

# 4. Only tokens from this repository may act as the deployer.
run_cmd gcloud iam service-accounts add-iam-policy-binding "$DEPLOYER_EMAIL" \
  --member="$PRINCIPAL_SET" \
  --role="roles/iam.workloadIdentityUser" \
  --project "$PROJECT_ID" --quiet

# 5. The deployer must never have a user-managed key.
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud iam service-accounts keys list --iam-account="$DEPLOYER_EMAIL" --managed-by=user --project "$PROJECT_ID" --format='value(name)'
else
  KEYS="$(gcloud iam service-accounts keys list --iam-account="$DEPLOYER_EMAIL" --managed-by=user --project "$PROJECT_ID" --format='value(name)')"
  if [ -n "$KEYS" ]; then
    echo "Error: ${DEPLOYER_EMAIL} has a user-managed key. Delete it and find out who created it." >&2
    exit 1
  fi
fi

printf '\n'
printf '%s\n' "=================================================================="
printf '%s\n' "Done. In GitHub: Settings > Environments > ${ENV_NAME} (deployment branch: main)"
printf '%s\n' "add these four environment VARIABLES (not secrets):"
printf '%s\n' "  GCP_PROJECT_ID      = ${PROJECT_ID}"
printf '%s\n' "  GCP_REGION          = ${REGION}"
printf '%s\n' "  WIF_PROVIDER        = ${PROVIDER_NAME}"
printf '%s\n' "  WIF_SERVICE_ACCOUNT = ${DEPLOYER_EMAIL}"
printf '%s\n' "Attribute condition:"
printf '%s\n' "  ${WIF_CONDITION}"
printf '%s\n' "=================================================================="
