# Cloud Run Deploy Execution Pack — v0.3.0

## 目的

v0.3.0 Deploy Execution & Runtime Ops Pack は、v0.4.0 初回 Cloud Run deploy 実行に必要な全コンポーネントを整備するリリース。

deploy 実行そのものは v0.4.0 で Human Approval のもとじゅんやさんが実施する。

---

## v0.3.0 整備コンポーネント一覧

| コンポーネント | 役割 |
|---|---|
| `tools/pm-agent-deploy-approval-packet.js` | deploy 承認パケット生成 |
| `tools/pm-agent-deploy-readiness-final-check.js` | deploy 直前最終確認 |
| `tools/pm-agent-runtime-ops-packet.js` | runtime 運用パケット・incident response |
| `tools/pm-agent-webhook-contract-generator.js` | webhook / n8n 接続コントラクト生成 |
| `tools/pm-agent-first-deploy-command-pack.js` | v0.4.0 初回 deploy コマンドパック |
| `tools/pm-agent-first-deploy-result-template.js` | deploy 結果記録テンプレート（v0.4.1 用） |
| `smoke/dev-agent-cloud-run-deploy-execution-pack-smoke.js` | Deploy Execution Pack 全体 smoke |
| `smoke/dev-agent-runtime-ops-pack-smoke.js` | Runtime Ops Pack smoke |
| `smoke/dev-agent-webhook-connection-readiness-smoke.js` | Webhook / n8n 接続準備 smoke |
| `smoke/dev-agent-first-deploy-command-pack-smoke.js` | First Deploy Command Pack smoke |
| `docs/ai-dev-team/cloud-run-first-deploy-approval-v0.3.0.md` | 承認チェックリスト |
| `docs/ai-dev-team/cloud-run-post-deploy-verification-v0.3.0.md` | deploy 後確認手順 |
| `docs/ai-dev-team/cloud-run-runtime-ops-pack-v0.3.0.md` | runtime 運用ガイド |
| `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` | インシデント対応ガイド |
| `docs/ai-dev-team/cloud-run-redeploy-decision-guide-v0.3.0.md` | 再 deploy 判断ガイド |
| `docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md` | n8n 接続準備ガイド |
| `docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md` | webhook セキュリティチェック |
| `docs/ai-dev-team/external-caller-contract-v0.3.0.md` | 外部呼び出しコントラクト |
| `docs/ai-dev-team/first-cloud-run-deploy-execution-v0.4.0.md` | v0.4.0 初回 deploy 実行手順 |
| `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` | v0.4.1 deploy 結果記録テンプレート |

---

## v0.3.0 でやること / やらないこと

### やること

- deploy 直前の全準備（コマンドパック・承認パケット・runbook・smoke）
- runtime 運用設計（モニタリング・billing アラート・incident response）
- n8n / webhook 接続設計（コントラクト定義）
- v0.4.0 deploy 実行手順の一本化
- v0.4.1 結果記録テンプレートの準備

### やらないこと（Human Approval 必要）

- Cloud Run deploy
- docker build / push
- Secret Manager 値の読み取り
- git push / git tag
- billing API 実行

---

## smoke で確認すること

```bash
npm run smoke:cloud-run-deploy-execution-pack
npm run smoke:runtime-ops-pack
npm run smoke:webhook-connection-readiness
npm run smoke:first-deploy-command-pack
npm run verify
```

---

## v0.4.0 deploy 実行の流れ

```
npm run verify → 全 smoke PASS
npm run pm-agent:deploy-readiness-final-check → readyForHumanDeploy: true
↓
Human Approval（じゅんやさん）
↓
node tools/pm-agent-first-deploy-command-pack.js → コマンド確認
↓
Cloud Shell で gcloud builds submit → gcloud run deploy
↓
node tools/pm-agent-post-deploy-smoke.js <SERVICE_URL>
↓
v0.4.1 結果記録
```

---

## 次ステップ

| バージョン | 内容 |
|---|---|
| v0.4.0 | Human Approval → Cloud Run deploy 実行（じゅんやさん） |
| v0.4.1 | deploy 結果記録 |
| v0.4.2 以降 | n8n 接続 / `dryRunOnly: false` 移行 / Secret Manager 完全接続 |
