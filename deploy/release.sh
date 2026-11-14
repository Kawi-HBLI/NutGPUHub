#!/usr/bin/env bash
# ==============================================================================
# NutGPUHub — release.sh (used by .github/workflows/deploy.yml, Lab5-7)
# Adapted from the Lab 5 starter kit (TokTickIT). Changes: the names; the revision
# gets APP_COMMIT=<commit SHA> so the Console shows which commit runs; SERVICE_URL is
# the service's APP_ORIGIN (the deterministic URL from deploy.sh), because sign-in
# and the smoke test's origin check only work on that URL.
# ==============================================================================
# Updates resources that deploy/deploy.sh created. Never creates SQL, IAM or secrets.
#   Normal release : find the image -> run the migration job -> update the service
#   Rollback       : find the image -> update the service (no migration, no seed)
#
# Input (environment variables)
#   PROJECT_ID, REGION, IMAGE_TAG   required (IMAGE_TAG = full 40-character commit SHA)
#   SERVICE_NAME, MIGRATE_JOB_NAME  optional (default nutgpuhub, nutgpuhub-migrate)
#   ROLLBACK                        true | false (default false)
#   GITHUB_ENV                      when set, SERVICE_URL and DEPLOYED_IMAGE are
#                                   appended for later workflow steps
#
# If the migration job fails, `set -e` stops the script before the service is
# updated. The image is pinned by its sha256 digest, so the job and the service
# run exactly the same image. Offline test: deploy/tests/test_release_stub.sh
# ==============================================================================
set -euo pipefail

: "${PROJECT_ID:?Required}" "${REGION:?Required}" "${IMAGE_TAG:?Required}"
SERVICE_NAME="${SERVICE_NAME:-nutgpuhub}"
MIGRATE_JOB_NAME="${MIGRATE_JOB_NAME:-nutgpuhub-migrate}"
ROLLBACK="${ROLLBACK:-false}"
[[ "$IMAGE_TAG" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid image tag.' >&2; exit 1; }
[[ "$ROLLBACK" == true || "$ROLLBACK" == false ]] || { echo 'Invalid rollback mode.' >&2; exit 1; }

# <Artifact Registry repository>/<image name> = nutgpuhub/nutgpuhub (see deploy.sh).
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/nutgpuhub/nutgpuhub:$IMAGE_TAG"
DIGEST_IMAGE="$(gcloud artifacts docker images describe "$IMAGE" --project="$PROJECT_ID" --format='value(image_summary.fully_qualified_digest)')"
[[ "$DIGEST_IMAGE" == "$REGION-docker.pkg.dev/$PROJECT_ID/nutgpuhub/nutgpuhub@sha256:"* ]] || { echo 'Image digest not found.' >&2; exit 1; }

if [[ "$ROLLBACK" == false ]]; then
  gcloud run jobs update "$MIGRATE_JOB_NAME" --image="$DIGEST_IMAGE" --project="$PROJECT_ID" --region="$REGION" --quiet
  gcloud run jobs execute "$MIGRATE_JOB_NAME" --wait --project="$PROJECT_ID" --region="$REGION" --quiet
else
  echo 'Rollback: reuse existing image; skip tests, build, migration and seed.'
fi

# The new revision records the commit it runs (Cloud Run > revision > Containers > env).
gcloud run services update "$SERVICE_NAME" --image="$DIGEST_IMAGE" --update-env-vars="APP_COMMIT=$IMAGE_TAG" --project="$PROJECT_ID" --region="$REGION" --quiet
# Send 100% of traffic to the new latest revision even if traffic was pinned before.
gcloud run services update-traffic "$SERVICE_NAME" --to-latest --project="$PROJECT_ID" --region="$REGION" --quiet

# Report the URL users open: APP_ORIGIN of the service (falls back to status.url).
SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --project="$PROJECT_ID" --region="$REGION" --format=json | python3 -c '
import json, sys
service = json.load(sys.stdin)
env = service["spec"]["template"]["spec"]["containers"][0].get("env", [])
origin = next((item.get("value", "") for item in env if item.get("name") == "APP_ORIGIN"), "")
print(origin or service["status"]["url"])
')"
[[ "$SERVICE_URL" == https://* ]] || { echo 'Service URL not found.' >&2; exit 1; }
echo "Service URL: $SERVICE_URL"
if [[ -n "${GITHUB_ENV:-}" ]]; then
  printf 'SERVICE_URL=%s\nDEPLOYED_IMAGE=%s\n' "$SERVICE_URL" "$DIGEST_IMAGE" >> "$GITHUB_ENV"
fi
