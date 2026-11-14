#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# NutGPUHub — first deployment to Google Cloud Run (Lab 5, Student Guide Episode 5)
# Adapted from the Lab 5 starter kit (TokTickIT). Safe to run again.
# ==============================================================================
# Usage (from the repository root, in Cloud Shell):
#   DRY_RUN=1 PROJECT_ID=... REGION=asia-southeast1 bash deploy/deploy.sh   # print only
#   PROJECT_ID=... REGION=asia-southeast1 bash deploy/deploy.sh             # create + deploy
#
# Environment variables:
#   PROJECT_ID   GCP project ID (default: the active gcloud project)
#   REGION       GCP region (default: asia-southeast1)
#   DRY_RUN      1 = print every command and call nothing (no gcloud, no cost)
#   IMAGE_TAG    Offline tests only. Normally the full commit SHA of HEAD, and the
#                working tree must be clean so the image matches that commit.
#
# What it does (each "create" step is skipped when the resource already exists):
#   1 enable APIs            2 Artifact Registry       3 Cloud SQL (no storage auto-increase)
#   4 database               5 runtime service account + Cloud SQL Client
#   6 DB user + DATABASE_URL secret                    7 DEMO_PASSWORD secret
#     secret access per secret (never project-wide)
#   8 build the image with Cloud Build, tagged with the commit SHA
#   9 migration job: prisma migrate deploy + seed      10 Cloud Run service
#   Later releases are done by GitHub Actions (deploy/release.sh, Lab5-7).
#
# Differences from the kit:
#   - Names nutgpuhub* instead of toktickit*.
#   - No administrator secret: NutGPUHub has no administrator. The seed always needs
#     DEMO_PASSWORD (four demo accounts and two GPU machines), so that secret is
#     always created and there is no --demo option.
#   - APP_ORIGIN is set to the service's deterministic URL
#     https://nutgpuhub-PROJECT_NUMBER.REGION.run.app. The app rejects every POST
#     (sign-in included) whose Origin differs, so open the app at that URL.
#   - The image is tagged with the commit SHA (not latest), so the running commit
#     is known from the first deployment and release.sh can roll back by tag.
#   - Cloud SQL is created with --no-storage-auto-increase (guide step 5.4).
#
# Passwords are generated with openssl, stored only in Secret Manager and never
# printed (run_cmd redacts --password=...). Offline test: deploy/tests/test_deploy_stub.sh
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

if [ "$#" -gt 0 ]; then
  echo "Unknown argument: $1" >&2
  echo "Usage: [DRY_RUN=1] PROJECT_ID=... REGION=... bash deploy/deploy.sh" >&2
  exit 1
fi

# Prints the command (DRY_RUN=1) or prints and runs it. --password=... is redacted.
run_cmd() {
  local arg
  if [ "$DRY_RUN" = "1" ]; then
    printf '[DRY_RUN] '
  else
    printf '+ '
  fi
  for arg in "$@"; do
    case "$arg" in
      --password=*) printf '%s ' '--password=<REDACTED>' ;;
      *) printf '%q ' "$arg" ;;
    esac
  done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then
    "$@"
  fi
}

# ------------------------------------------------------------------------------
# Project, commit and resource names
# ------------------------------------------------------------------------------
if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    echo "Run: gcloud config set project YOUR_PROJECT_ID" >&2
    exit 1
  fi
fi

if [ -z "${IMAGE_TAG:-}" ]; then
  IMAGE_TAG="$(git rev-parse HEAD 2>/dev/null || true)"
  if [ "$DRY_RUN" != "1" ] && [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo "Error: the working tree has uncommitted changes. Deploy a clean checkout of main." >&2
    exit 1
  fi
fi
if ! [[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Error: run this script from a git checkout (the image tag is the full commit SHA)." >&2
  exit 1
fi

# The same names are used in release.sh, teardown.sh, the tests and deployment.md.
REPO_NAME="nutgpuhub"
SQL_INSTANCE="nutgpuhub-pg"
DB_NAME="nutgpuhub"
DB_USER="nutgpuhub"
SERVICE_NAME="nutgpuhub"
MIGRATE_JOB_NAME="nutgpuhub-migrate"
SA_NAME="nutgpuhub-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:${IMAGE_TAG}"

# Secret Manager secret names (the values never appear in the repository).
SECRET_DB_URL="nutgpuhub-database-url"
SECRET_DEMO_PASS="nutgpuhub-demo-password"

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_NUMBER="PROJECT_NUMBER"
else
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
  if ! [[ "$PROJECT_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "Error: could not read the project number of ${PROJECT_ID}." >&2
    exit 1
  fi
fi
SERVICE_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app"

echo "=================================================================="
echo "NutGPUHub Cloud Run Deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Commit  : ${IMAGE_TAG}"
echo "URL     : ${SERVICE_URL}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# ==============================================================================
# 1. Enable the Google APIs
# ==============================================================================
run_cmd gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID"

# ==============================================================================
# 2. Artifact Registry repository (stores one image per commit SHA)
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID"
  run_cmd gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location "$REGION" --description="NutGPUHub container images" --project "$PROJECT_ID"
elif ! gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location "$REGION" \
    --description="NutGPUHub container images" \
    --project "$PROJECT_ID"
fi

# ==============================================================================
# 3. Cloud SQL for PostgreSQL 16, smallest tier, fixed 10 GB disk
#    db-f1-micro on PostgreSQL 16 needs --edition=enterprise. Billed every hour
#    until deploy/teardown.sh deletes it.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region="$REGION" --storage-size=10GB --storage-type=SSD --no-storage-auto-increase --backup-start-time=03:00 --project "$PROJECT_ID"
elif ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=enterprise \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-type=SSD \
    --no-storage-auto-increase \
    --backup-start-time=03:00 \
    --project "$PROJECT_ID"
fi

# ==============================================================================
# 4. Database
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
elif ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
fi

# ==============================================================================
# 5. Runtime service account: only Cloud SQL Client on the project.
#    Secret access is granted per secret below.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID"
  run_cmd gcloud iam service-accounts create "$SA_NAME" --display-name="NutGPUHub Cloud Run runtime" --project "$PROJECT_ID"
elif ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud iam service-accounts create "$SA_NAME" \
    --display-name="NutGPUHub Cloud Run runtime" \
    --project "$PROJECT_ID"
fi

run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --quiet

# ==============================================================================
# 6. Database user + DATABASE_URL secret (only when the secret does not exist yet)
#    The user's password and the password inside DATABASE_URL are the same value.
#    Prisma reaches Cloud SQL through the Unix socket /cloudsql/PROJECT:REGION:INSTANCE.
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"
  run_cmd gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)"
  run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<GENERATED_HEX_PASSWORD>" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
elif ! gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  DB_PASS="$(openssl rand -hex 24)"
  if gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)" | grep -qx "$DB_USER"; then
    run_cmd gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  else
    run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  fi
  DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}&schema=public&connection_limit=3"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  printf "%s" "$DB_URL_VALUE" | gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
fi

# ==============================================================================
# 7. DEMO_PASSWORD secret for the four demo accounts (only when it does not exist yet)
#    Read it privately with: gcloud secrets versions access latest --secret=nutgpuhub-demo-password
# ==============================================================================
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_DEMO_PASS" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_DEMO_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_DEMO_PASS" --data-file=- --project "$PROJECT_ID"
elif ! gcloud secrets describe "$SECRET_DEMO_PASS" --project "$PROJECT_ID" >/dev/null 2>&1; then
  DEMO_PASS="$(openssl rand -base64 24 | tr -d '/+=\n' | cut -c1-24)"
  run_cmd gcloud secrets create "$SECRET_DEMO_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
  printf "%s" "$DEMO_PASS" | gcloud secrets versions add "$SECRET_DEMO_PASS" --data-file=- --project "$PROJECT_ID"
fi

# Secret access for the runtime account, one binding per secret (never project-wide).
for secret in "$SECRET_DB_URL" "$SECRET_DEMO_PASS"; do
  run_cmd gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet
done

# ==============================================================================
# 8. Build the root Dockerfile with Cloud Build and push it, tagged with the commit SHA
# ==============================================================================
run_cmd gcloud builds submit \
  --tag "$IMAGE_URI" \
  --project "$PROJECT_ID"

# ==============================================================================
# 9. Migration job: migrations, then the rerunnable seed. If it fails, the script
#    stops before the service is deployed. release.sh reruns this job on each release.
# ==============================================================================
run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --set-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,DEMO_PASSWORD=${SECRET_DEMO_PASS}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok" \
  --command "sh" \
  --args "-c,npx prisma migrate deploy && npm run db:seed" \
  --max-retries 1 \
  --task-timeout 300s \
  --project "$PROJECT_ID"

if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
  --region "$REGION" \
  --wait \
  --project "$PROJECT_ID"; then
  printf '%s\n' "ERROR: Cloud Run migration job '${MIGRATE_JOB_NAME}' failed. Aborting service deployment." >&2
  printf '%s\n' "View job logs with:" >&2
  printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}\" --project \"${PROJECT_ID}\" --limit 50 --format=\"value(textPayload)\"" >&2
  exit 1
fi

# ==============================================================================
# 10. Cloud Run service: public, port 3000 (Dockerfile), 0 to 3 instances.
#     The service gets only DATABASE_URL; DEMO_PASSWORD is for the migration job.
# ==============================================================================
run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "$SA_EMAIL" \
  --add-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok,APP_ORIGIN=${SERVICE_URL}" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --port 3000 \
  --project "$PROJECT_ID"

printf '\n'
printf '%s\n' "=================================================================="
printf '%s\n' "Deployment Completed!"
printf '%s\n' "Service URL    : ${SERVICE_URL}  (open the app here; sign-in works only on this URL)"
printf '%s\n' "Health Check   : ${SERVICE_URL}/api/health"
printf '%s\n' "Readiness Check: ${SERVICE_URL}/api/ready"
printf '%s\n' "Image          : ${IMAGE_URI}"
printf '%s\n' "Demo accounts  : student-a, student-b, operator-a, operator-b"
printf '%s\n' "Demo password  : stored in Secret Manager: ${SECRET_DEMO_PASS} (not printed)."
printf '%s\n' "=================================================================="
