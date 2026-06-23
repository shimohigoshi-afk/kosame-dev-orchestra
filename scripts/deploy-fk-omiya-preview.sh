#!/usr/bin/env bash
# FK Omiya Console — Public Preview Deploy Script
# Deploys the demo page to Cloud Run (unauthenticated, demo only).
# NO secrets, NO .env, NO internal tools are included.
# Human approval required before running this script.
set -euo pipefail

PROJECT="${GCP_PROJECT:-}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"
SERVICE_NAME="fk-omiya-preview"
IMAGE_TAG="${IMAGE_TAG:-latest}"
REPO="${ARTIFACT_REGISTRY_REPO:-}"

if [ -z "$PROJECT" ]; then
  echo "ERROR: GCP_PROJECT is not set"
  exit 1
fi

if [ -z "$REPO" ]; then
  REPO="${REGION}-docker.pkg.dev/${PROJECT}/kosame/${SERVICE_NAME}"
fi

IMAGE="${REPO}:${IMAGE_TAG}"

echo "=== FK Omiya Preview Deploy ==="
echo "Project : ${PROJECT}"
echo "Region  : ${REGION}"
echo "Service : ${SERVICE_NAME}"
echo "Image   : ${IMAGE}"
echo ""

echo "[1/3] Building image with Dockerfile.fk-omiya-preview ..."
docker build -f Dockerfile.fk-omiya-preview -t "${IMAGE}" .

echo "[2/3] Pushing image ..."
docker push "${IMAGE}"

echo "[3/3] Deploying to Cloud Run (allow-unauthenticated) ..."
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=0 \
  --max-instances=2 \
  --memory=256Mi \
  --cpu=1

echo ""
echo "=== Deploy complete ==="
URL=$(gcloud run services describe "${SERVICE_NAME}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --format="value(status.url)")
echo "Public Preview URL: ${URL}"
echo "Demo page         : ${URL}/fk-omiya-console.html"
echo "Health check      : ${URL}/healthz"
