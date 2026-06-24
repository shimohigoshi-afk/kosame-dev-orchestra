#!/usr/bin/env bash
# =============================================================================
# FK Omiya Console + LINE Bot — Cloud Run 本番デプロイスクリプト
# =============================================================================
#
# デプロイ対象:
#   1. fk-omiya-console   … public/fk-omiya-console.html を提供する静的サービス
#   2. kosame-line-bot    … LINE Messaging API Webhook + REST API (port 8080)
#
# 使い方:
#   npm run deploy:fk-omiya          # インタラクティブ承認プロンプト
#   DEPLOY_APPROVED=yes npm run deploy:fk-omiya   # CI/自動承認
#
# 前提:
#   - gcloud CLI がインストール済み・認証済み
#   - docker がインストール済み（Artifact Registry push 権限あり）
#   - GCPプロジェクト kosame-prod-2026 でCloud Run / Artifact Registry が有効
#   - LINE秘密情報が .env または環境変数 LINE_CHANNEL_* に設定済み
#
# ⚠️  SAFETY STOP: このスクリプトは本番環境に変更を加えます。
#     必ず内容を確認してから DEPLOY を入力してください。
# =============================================================================

set -euo pipefail

# ── 設定 ──────────────────────────────────────────────────────────────────────
PROJECT="${GCP_PROJECT:-kosame-prod-2026}"
REGION="${CLOUD_RUN_REGION:-asia-northeast1}"
REPO="${ARTIFACT_REGISTRY_REPO:-${REGION}-docker.pkg.dev/${PROJECT}/kosame}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d-%H%M%S)}"

CONSOLE_SERVICE="fk-omiya-console"
BOT_SERVICE="kosame-line-bot"

CONSOLE_IMAGE="${REPO}/${CONSOLE_SERVICE}:${IMAGE_TAG}"
BOT_IMAGE="${REPO}/${BOT_SERVICE}:${IMAGE_TAG}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

# ── カラー出力 ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ── .env 読み込みユーティリティ ───────────────────────────────────────────────
read_env_var() {
  local key="$1"
  if [ -f "$ENV_FILE" ]; then
    grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- | tr -d '"' | tr -d "'" || true
  fi
}

# ── デプロイ計画の表示 ─────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║     FK Omiya — Cloud Run 本番デプロイ                        ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}GCPプロジェクト${NC} : ${PROJECT}"
echo -e "  ${CYAN}リージョン    ${NC} : ${REGION}"
echo -e "  ${CYAN}Artifact Repo ${NC} : ${REPO}"
echo -e "  ${CYAN}イメージタグ  ${NC} : ${IMAGE_TAG}"
echo ""
echo -e "  ${BOLD}デプロイサービス:${NC}"
echo -e "  ┌─ [1] ${CONSOLE_SERVICE}"
echo -e "  │       Dockerfile : Dockerfile.fk-omiya-console"
echo -e "  │       Image      : ${CONSOLE_IMAGE}"
echo -e "  │       Port       : 8080 → Cloud Run HTTPS"
echo -e "  │       Auth       : 未認証（スタッフ向けコンソール）"
echo -e "  │"
echo -e "  └─ [2] ${BOT_SERVICE}"
echo -e "          Dockerfile : Dockerfile.fk-omiya-line-bot"
echo -e "          Image      : ${BOT_IMAGE}"
echo -e "          Port       : 8080 → Cloud Run HTTPS"
echo -e "          Auth       : 未認証（LINEプラットフォームWebhook）"
echo -e "          Secrets    : LINE_CHANNEL_ID / SECRET / ACCESS_TOKEN"
echo ""

# ── LINE シークレット確認 ─────────────────────────────────────────────────────
LINE_ID="$(read_env_var LINE_CHANNEL_ID)"
LINE_SECRET="$(read_env_var LINE_CHANNEL_SECRET)"
LINE_TOKEN="$(read_env_var LINE_CHANNEL_ACCESS_TOKEN)"

HAS_LINE_KEYS=true
if [ -z "$LINE_ID" ] || [ -z "$LINE_SECRET" ] || [ -z "$LINE_TOKEN" ]; then
  HAS_LINE_KEYS=false
  echo -e "  ${YELLOW}⚠️  LINE シークレット未設定${NC}"
  echo -e "  .env に以下を追記してください（上書き禁止・>> 追記のみ）:"
  echo ""
  echo -e "  ${CYAN}echo 'LINE_CHANNEL_ID=あなたのChannelID'         >> .env${NC}"
  echo -e "  ${CYAN}echo 'LINE_CHANNEL_SECRET=あなたのSecret'        >> .env${NC}"
  echo -e "  ${CYAN}echo 'LINE_CHANNEL_ACCESS_TOKEN=アクセストークン' >> .env${NC}"
  echo ""
  echo -e "  ${YELLOW}LINE Botサービスは Secret Manager なしでデプロイします。${NC}"
  echo -e "  ${YELLOW}後で追加する場合: gcloud run services update ${BOT_SERVICE} --update-secrets ...${NC}"
  echo ""
fi

# ── 前提確認 ───────────────────────────────────────────────────────────────────
echo -e "  ${BOLD}前提確認中...${NC}"

if ! command -v gcloud &> /dev/null; then
  echo -e "  ${RED}✗ gcloud CLI が見つかりません。インストールしてください。${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓ gcloud CLI : $(gcloud version 2>/dev/null | head -1)${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "  ${RED}✗ docker が見つかりません。インストールしてください。${NC}"
  exit 1
fi
echo -e "  ${GREEN}✓ docker     : $(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"

CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$PROJECT" ]; then
  echo -e "  ${YELLOW}⚠️  現在の gcloud プロジェクト: ${CURRENT_PROJECT}${NC}"
  echo -e "  ${YELLOW}   設定先: ${PROJECT}${NC}"
fi

echo ""

# ════════════════════════════════════════════════════════════════════
#  ⚠️  SAFETY STOP — HUMAN APPROVAL GATE
# ════════════════════════════════════════════════════════════════════
if [ "${DEPLOY_APPROVED:-}" != "yes" ]; then
  echo -e "${RED}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}${BOLD}║  ⚠️  SAFETY STOP: 本番デプロイには人間の承認が必要です       ║${NC}"
  echo -e "${RED}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "  上記の内容（プロジェクト・イメージ・サービス名）を確認してください。"
  echo -e "  続行するには ${BOLD}'DEPLOY'${NC} と入力してください（その他の入力は中止）:"
  echo ""
  read -r CONFIRM
  if [ "$CONFIRM" != "DEPLOY" ]; then
    echo -e "${YELLOW}❌ デプロイを中止しました。${NC}"
    exit 1
  fi
  echo ""
  echo -e "${GREEN}✓ 承認されました。デプロイを開始します...${NC}"
  echo ""
fi

# ── [0] gcloud プロジェクト設定 ───────────────────────────────────────────────
echo -e "${BOLD}[0/6] gcloud プロジェクト設定...${NC}"
gcloud config set project "${PROJECT}" --quiet
echo -e "  ${GREEN}✓ Project: ${PROJECT}${NC}"

# ── [1] Artifact Registry リポジトリ作成（存在しない場合） ─────────────────────
echo ""
echo -e "${BOLD}[1/6] Artifact Registry リポジトリ確認...${NC}"
REGISTRY_REPO="${REGION}-docker.pkg.dev/${PROJECT}/kosame"
if ! gcloud artifacts repositories describe kosame \
    --location="${REGION}" \
    --project="${PROJECT}" &>/dev/null; then
  echo -e "  リポジトリ 'kosame' を作成中..."
  gcloud artifacts repositories create kosame \
    --repository-format=docker \
    --location="${REGION}" \
    --project="${PROJECT}" \
    --description="KOSAME Docker images"
  echo -e "  ${GREEN}✓ リポジトリ作成完了${NC}"
else
  echo -e "  ${GREEN}✓ リポジトリ既存: ${REGISTRY_REPO}${NC}"
fi

# Docker 認証設定
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
echo -e "  ${GREEN}✓ Docker 認証設定完了${NC}"

# ── [2] コンソールイメージ Build & Push ───────────────────────────────────────
echo ""
echo -e "${BOLD}[2/6] fk-omiya-console イメージ Build & Push...${NC}"
echo -e "  Image: ${CONSOLE_IMAGE}"
docker build \
  --file "${ROOT}/Dockerfile.fk-omiya-console" \
  --tag "${CONSOLE_IMAGE}" \
  --label "git-commit=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
  "${ROOT}"
docker push "${CONSOLE_IMAGE}"
echo -e "  ${GREEN}✓ コンソールイメージ Push 完了${NC}"

# ── [3] コンソールサービス デプロイ ───────────────────────────────────────────
echo ""
echo -e "${BOLD}[3/6] fk-omiya-console Cloud Run デプロイ...${NC}"
gcloud run deploy "${CONSOLE_SERVICE}" \
  --image="${CONSOLE_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=0 \
  --max-instances=3 \
  --memory=256Mi \
  --cpu=1 \
  --timeout=60s \
  --set-env-vars="NODE_ENV=production" \
  --labels="managed-by=kosame-dev-orchestra,component=fk-omiya-console"
echo -e "  ${GREEN}✓ fk-omiya-console デプロイ完了${NC}"

# ── [4] LINEシークレット Secret Manager 登録 ─────────────────────────────────
echo ""
echo -e "${BOLD}[4/6] LINE シークレット Secret Manager 登録...${NC}"
if [ "$HAS_LINE_KEYS" = "true" ]; then
  for SECRET_NAME in LINE_CHANNEL_ID LINE_CHANNEL_SECRET LINE_CHANNEL_ACCESS_TOKEN; do
    VAL="$(read_env_var ${SECRET_NAME})"
    if gcloud secrets describe "${SECRET_NAME}" --project="${PROJECT}" &>/dev/null; then
      echo -e "  既存シークレットに新バージョン追加: ${SECRET_NAME}"
      echo -n "$VAL" | gcloud secrets versions add "${SECRET_NAME}" \
        --project="${PROJECT}" --data-file=-
    else
      echo -e "  シークレット新規作成: ${SECRET_NAME}"
      echo -n "$VAL" | gcloud secrets create "${SECRET_NAME}" \
        --project="${PROJECT}" --data-file=-
    fi
  done
  echo -e "  ${GREEN}✓ LINE シークレット登録完了${NC}"
  LINE_SECRET_FLAGS="--set-secrets=LINE_CHANNEL_ID=LINE_CHANNEL_ID:latest,LINE_CHANNEL_SECRET=LINE_CHANNEL_SECRET:latest,LINE_CHANNEL_ACCESS_TOKEN=LINE_CHANNEL_ACCESS_TOKEN:latest"
else
  echo -e "  ${YELLOW}⚠️  LINE シークレットスキップ（.envにキーなし）${NC}"
  LINE_SECRET_FLAGS=""
fi

# ── [5] LINE Bot イメージ Build & Push ────────────────────────────────────────
echo ""
echo -e "${BOLD}[5/6] kosame-line-bot イメージ Build & Push...${NC}"
echo -e "  Image: ${BOT_IMAGE}"
docker build \
  --file "${ROOT}/Dockerfile.fk-omiya-line-bot" \
  --tag "${BOT_IMAGE}" \
  --label "git-commit=$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo 'unknown')" \
  "${ROOT}"
docker push "${BOT_IMAGE}"
echo -e "  ${GREEN}✓ LINE Bot イメージ Push 完了${NC}"

# ── [6] LINE Botサービス デプロイ ─────────────────────────────────────────────
echo ""
echo -e "${BOLD}[6/6] kosame-line-bot Cloud Run デプロイ...${NC}"
# Cloud Run の Service Account に Secret Manager アクセス権を付与（初回のみ必要）
SA_EMAIL="$(gcloud run services describe ${BOT_SERVICE} \
  --platform=managed --region="${REGION}" --project="${PROJECT}" \
  --format="value(spec.template.spec.serviceAccountName)" 2>/dev/null || echo "")"
if [ -z "$SA_EMAIL" ]; then
  SA_EMAIL="${PROJECT}@appspot.gserviceaccount.com"
fi

gcloud run deploy "${BOT_SERVICE}" \
  --image="${BOT_IMAGE}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT}" \
  --allow-unauthenticated \
  --port=8080 \
  --min-instances=1 \
  --max-instances=2 \
  --memory=512Mi \
  --cpu=1 \
  --timeout=30s \
  --set-env-vars="NODE_ENV=production" \
  ${LINE_SECRET_FLAGS} \
  --labels="managed-by=kosame-dev-orchestra,component=line-bot"
echo -e "  ${GREEN}✓ kosame-line-bot デプロイ完了${NC}"

# ── URL 取得 ──────────────────────────────────────────────────────────────────
echo ""
CONSOLE_URL=$(gcloud run services describe "${CONSOLE_SERVICE}" \
  --platform=managed --region="${REGION}" --project="${PROJECT}" \
  --format="value(status.url)" 2>/dev/null || echo "（取得失敗）")

BOT_URL=$(gcloud run services describe "${BOT_SERVICE}" \
  --platform=managed --region="${REGION}" --project="${PROJECT}" \
  --format="value(status.url)" 2>/dev/null || echo "（取得失敗）")

# ── 結果サマリー ──────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║  ✅ デプロイ完了                                             ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}FK Console URL:${NC}"
echo -e "  ${CYAN}${CONSOLE_URL}${NC}"
echo -e "  ${CYAN}${CONSOLE_URL}/fk-omiya-console.html${NC}"
echo ""
echo -e "  ${BOLD}LINE Bot Webhook URL:${NC}"
echo -e "  ${CYAN}${BOT_URL}/webhook${NC}"
echo -e "  ↑ LINE Developers Console の Webhook URL にこれを設定してください"
echo ""
echo -e "  ${BOLD}LINE Bot API URL（コンソール設定用）:${NC}"
echo -e "  ${CYAN}${BOT_URL}${NC}"
echo -e "  ↑ FK Console の 設定タブ → LINE API設定 → LINE Bot サーバーURL に設定"
echo ""
if [ "$HAS_LINE_KEYS" = "false" ]; then
  echo -e "  ${YELLOW}⚠️  LINE シークレット未設定のため、Botは未認証状態です。${NC}"
  echo -e "  ${YELLOW}   .envにキー追記後、以下で更新できます:${NC}"
  echo -e "  ${YELLOW}   npm run deploy:fk-omiya${NC}"
fi
echo ""
echo -e "  ${BOLD}次のステップ:${NC}"
echo -e "  1. FK Console にアクセスし、設定タブで LINE Bot サーバーURL を設定"
echo -e "  2. LINE Developers Console で Webhook URL を ${BOT_URL}/webhook に更新"
echo -e "  3. Webhook 接続テストを実行"
echo ""
