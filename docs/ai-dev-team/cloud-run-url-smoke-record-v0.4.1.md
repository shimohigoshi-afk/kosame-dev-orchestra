# Cloud Run URL Smoke Record — v0.4.1

## 概要

v0.4.0 deploy 後の Cloud Run URL 疎通 smoke 結果記録。

**実行者: じゅんやさん（Human Approval 後に実行）**
**smoke 失敗時は即時 rollback を検討する。**

smoke コマンド生成: `node tools/pm-agent-cloud-run-url-smoke-pack.js`

---

## 実行環境

| 項目 | 値 |
|---|---|
| smoke 対象 URL | https://SERVICE_URL_PLACEHOLDER |
| 実行日時 | YYYY-MM-DD HH:MM:SS |
| 実行者 | じゅんやさん |
| smoke スクリプト | node tools/pm-agent-post-deploy-smoke.js |

---

## smoke 結果一覧

| チェック | 結果 | 詳細 |
|---|---|---|
| GET /health → 200 | PENDING | — |
| GET /health body.status === ok | PENDING | — |
| GET /info → 200 | PENDING | — |
| GET /info body.dryRunOnly === true | PENDING | — |
| POST /dry-run-task (implementation) → claude_code | PENDING | — |
| POST /dry-run-task (critical) → blocked: true | PENDING | — |

smoke 全体: `PENDING (all pass / fail あり)`

---

## 手動確認コマンド

```bash
# health check
curl -s https://SERVICE_URL/health | jq .

# info チェック
curl -s https://SERVICE_URL/info | jq .

# dry-run-task (implementation)
curl -s -X POST https://SERVICE_URL/dry-run-task \
  -H "Content-Type: application/json" \
  -d '{"id":"SMOKE-URL-001","title":"URL smoke","kind":"implementation","riskLevel":"low","targetRepo":"kosame-dev-orchestra"}' | jq .

# dry-run-task (critical — blocked になることを確認)
curl -s -X POST https://SERVICE_URL/dry-run-task \
  -H "Content-Type: application/json" \
  -d '{"id":"SMOKE-URL-002","title":"URL smoke critical","kind":"deploy","riskLevel":"critical","targetRepo":"kosame-dev-orchestra"}' | jq .
```

---

## smoke PASS 後の次ステップ

smoke が全 PASS したら v0.4.2 作業へ進む:

1. `docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md` — n8n 接続設定
2. `docs/ai-dev-team/cloud-run-secret-manager-readiness-v0.4.2.md` — Secret Manager 準備
3. `docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md` — 本番移行メモ

---

## rollback 判断基準

smoke 失敗の場合は rollback を検討する:

- smoke fail 1 件でも → 即時 rollback 検討
- `/health` が 200 を返さない → Cloud Run revision 確認
- `dryRunOnly: true` が返らない → アプリ設定確認

rollback 手順: `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` 参照

```bash
# rollback コマンド（Human Approval 後に実行）
gcloud run services update-traffic pm-agent \
  --to-revisions PREVIOUS_REVISION=100 \
  --region asia-northeast1 \
  --project PROJECT_ID
```

---

## 参考

- `tools/pm-agent-cloud-run-url-smoke-pack.js` — smoke コマンド生成
- `tools/pm-agent-post-deploy-smoke.js` — smoke スクリプト
- `docs/ai-dev-team/first-cloud-run-deploy-result-record-v0.4.1.md` — deploy 結果記録
- `docs/ai-dev-team/cloud-run-incident-response-v0.3.0.md` — インシデント対応
