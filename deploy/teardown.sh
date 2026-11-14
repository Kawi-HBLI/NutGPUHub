#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# NutGPUHub — delete every Google Cloud resource that deploy/deploy.sh created
# Adapted from the Lab 5 starter kit (TokTickIT): names and the secret list changed.
# ==============================================================================
# Usage:  [DRY_RUN=1] PROJECT_ID=... REGION=... bash deploy/teardown.sh
#
# DESTRUCTIVE: all Cloud SQL data is permanently lost. You must type the project
# ID to confirm. Preview first with DRY_RUN=1. Run it when the course no longer
# needs the deployment, to stop billing.
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

run_cmd() {
  if [ "$DRY_RUN" = "1" ]; then
    echo "[DRY_RUN] $*"
  else
    echo "+ $*"
    "$@"
  fi
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    exit 1
  fi
fi

# Must match deploy/deploy.sh.
REPO_NAME="nutgpuhub"
SQL_INSTANCE="nutgpuhub-pg"
SERVICE_NAME="nutgpuhub"
MIGRATE_JOB_NAME="nutgpuhub-migrate"
SA_NAME="nutgpuhub-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SECRET_DB_URL="nutgpuhub-database-url"
SECRET_DEMO_PASS="nutgpuhub-demo-password"

echo "=================================================================="
echo "WARNING: This will permanently delete NutGPUHub resources in:"
echo "  Project : ${PROJECT_ID}"
echo "  Region  : ${REGION}"
echo "Resources to be deleted:"
echo "  - Cloud Run Service : ${SERVICE_NAME}"
echo "  - Cloud Run Job     : ${MIGRATE_JOB_NAME}"
echo "  - Cloud SQL Instance: ${SQL_INSTANCE} (ALL DATABASE DATA WILL BE LOST)"
echo "  - Artifact Registry : ${REPO_NAME}"
echo "  - Secrets           : ${SECRET_DB_URL}, ${SECRET_DEMO_PASS}"
echo "  - Service Account   : ${SA_EMAIL}"
echo "=================================================================="

if [ "$DRY_RUN" != "1" ]; then
  read -r -p "Type the project ID (${PROJECT_ID}) to confirm deletion: " CONFIRM_PROJECT
  if [ "$CONFIRM_PROJECT" != "$PROJECT_ID" ]; then
    echo "Aborted: confirmation did not match ${PROJECT_ID}."
    exit 1
  fi
fi

# Each `|| true` lets the rest continue when one resource is already gone.
run_cmd gcloud run services delete "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud run jobs delete "$MIGRATE_JOB_NAME" --region "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud sql instances delete "$SQL_INSTANCE" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud artifacts repositories delete "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DB_URL" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud secrets delete "$SECRET_DEMO_PASS" --project "$PROJECT_ID" --quiet || true
run_cmd gcloud iam service-accounts delete "$SA_EMAIL" --project "$PROJECT_ID" --quiet || true

echo "Teardown completed."
