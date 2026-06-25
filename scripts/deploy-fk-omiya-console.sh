#!/usr/bin/env bash
# =============================================================================
# FK Omiya Console — Cloud Run コンソール単体デプロイ
# =============================================================================
#
# 使い方:
#   npm run deploy:fk-omiya:console          # DEPLOY_APPROVED=yes で自動実行
#   bash scripts/deploy-fk-omiya-console.sh  # 直接実行（同じく自動承認）
#
# このスクリプトは fk-omiya-console のみデプロイし、LINE Botには触れない。
# Safety Stop条件: .env読み取り / force push / rm -rf/ は禁止（設定で管理）
# =============================================================================

set -euo pipefail

PROJECT="${GCP_PROJECT:-kosame-prod-2026}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"
REPO="${REGION}-docker.pkg.dev/${PROJECT}/kosame"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"
SERVICE="fk-omiya-console"
IMAGE="${REPO}/${SERVICE}:${IMAGE_TAG}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║  FK Omiya Console — Cloud Run デプロイ               ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════╝${NC}"
echo -e "  Project : ${PROJECT}"
echo -e "  Region  : ${REGION}"
echo -e "  Image   : ${IMAGE}"
echo ""

# [1] Cloud Build でイメージビルド・プッシュ
echo -e "${BOLD}[1/2] Cloud Build: ビルド & プッシュ...${NC}"
cat > /tmp/cloudbuild-console-only.yaml << CBEOF
steps:
  - name: 'gcr.io/cloud-builders/docker'
    args: ['build', '-f', 'Dockerfile.fk-omiya-console', '-t', '${IMAGE}', '.']
images: ['${IMAGE}']
CBEOF

gcloud builds submit "${ROOT}" \
  --project="${PROJECT}" \
  --config=/tmp/cloudbuild-console-only.yaml \
  --quiet
echo -e "  ${GREEN}✓ イメージ Push 完了: ${IMAGE}${NC}"

# [2] Cloud Run デプロイ
echo ""
echo -e "${BOLD}[2/2] Cloud Run デプロイ...${NC}"
gcloud run deploy "${SERVICE}" \
  --image="${IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --port=8080 \
  --min-instances=0 \
  --max-instances=3 \
  --memory=256Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="NODE_ENV=production" \
  --quiet

URL=$(gcloud run services describe "${SERVICE}" \
  --platform=managed --region="${REGION}" --project="${PROJECT}" \
  --format="value(status.url)" 2>/dev/null || echo "")

echo -e "  ${GREEN}✓ デプロイ完了${NC}"
echo ""
echo -e "${GREEN}${BOLD}✅ 完了${NC}"
echo -e "  URL: ${CYAN}${URL}${NC}"
echo -e "  Console: ${CYAN}${URL}/fk-omiya-console.html${NC}"
echo ""
