# First Cloud Run Deploy Execution — v0.4.0

## 概要

v0.4.0 Cloud Run PM Agent 初回 deploy 実行手順。

**実行者: じゅんやさん（Cloud Shell から実行）**
**AI はコマンド生成と確認まで。実行はじゅんやさんが行う。**

Human Approval なしに deploy は実行しない。
`npm run pm-agent:deploy-readiness-final-check` → `readyForHumanDeploy: true` を確認してから開始する。

---

## 事前確認（必須）

```bash
# 全 smoke PASS
npm run verify

# 最終 readiness チェック
npm run pm-agent:deploy-readiness-final-check
# → readyForHumanDeploy: true を確認

# deploy コマンドパック確認
node tools/pm-agent-first-deploy-command-pack.js
# → じゅんやさんが実値に置き換えたコマンドを確認
```

---

## 実行前に確認する値

| 項目 | 値 | 確認 |
|---|---|---|
| GCP project ID | PROJECT_ID_PLACEHOLDER | [ ] |
| Region | asia-northeast1 | [ ] |
| Service name | pm-agent | [ ] |
| Image tag | VERSION_PLACEHOLDER (commit hash 推奨) | [ ] |
| Container Registry | gcr.io / Artifact Registry | [ ] |
| billing enabled | 確認済み | [ ] |

---

## Step 1: gcloud project 確認

```bash
# Cloud Shell でプロジェクトを確認
gcloud config get-value project
gcloud config set project PROJECT_ID
gcloud auth list
```

---

## Step 2: Cloud Build でイメージ作成

```bash
# Cloud Shell から実行（docker build は不要）
gcloud builds submit \
  --tag gcr.io/PROJECT_ID/pm-agent:v0.4.0 \
  --project PROJECT_ID
```

- ✓ build SUCCESS を確認
- ✓ image URL をメモ

---

## Step 3: Cloud Run deploy 実行

```bash
gcloud run deploy pm-agent \
  --image gcr.io/PROJECT_ID/pm-agent:v0.4.0 \
  --platform managed \
  --region asia-northeast1 \
  --project PROJECT_ID \
  --port 8080 \
  --set-env-vars NODE_ENV=production,PORT=8080 \
  --max-instances 1 \
  --allow-unauthenticated
```

- ✓ `Service deployed to https://...` を確認
- ✓ SERVICE_URL をメモ

---

## Step 4: Service URL 取得

```bash
gcloud run services describe pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID \
  --format "value(status.url)"
```

---

## Step 5: Post-deploy smoke

```bash
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

- ✓ 全 checks PASS（`success: true`）を確認
- ✗ 失敗した場合 → `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` 参照

---

## 失敗時の rollback 候補

```bash
# revision 一覧確認
gcloud run revisions list --service pm-agent --region asia-northeast1 --project PROJECT_ID

# rollback コマンド生成（実行しない・確認用）
node tools/pm-agent-deploy-command-generator.js
```

smoke 失敗 → 即時 rollback 検討。詳細は `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` 参照。

---

## Step 6: 結果記録（v0.4.1）

```bash
# 結果記録テンプレート出力
node tools/pm-agent-first-deploy-result-template.js
```

出力を参考に `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` を更新する。

---

## billing 確認（deploy 後 24h）

- [ ] GCP billing console で課金状況を確認
- [ ] 予期しない料金スパイクがないことを確認
- [ ] Cloud Monitoring で予算アラートを設定済みか確認

---

## 参考

- `tools/pm-agent-first-deploy-command-pack.js` — deploy コマンドパック
- `tools/pm-agent-deploy-approval-packet.js` — 承認パケット
- `docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md` — 承認チェックリスト
- `docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md` — deploy 後確認
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — 障害対応

---

## v0.4.1 / v0.4.2 次ステップ

deploy 完了後は以下のドキュメントに進む:

- `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` — v0.4.0 deploy 結果記録
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — Cloud Run URL smoke 記録
- `docs/ai-dev-team/cloud-run-first-deploy-troubleshooting-v0.4.1.md` — トラブルシューティング
- `docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md` — n8n 初回接続
- `docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md` — Secret Manager 準備
- `docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md` — 本番移行メモ
