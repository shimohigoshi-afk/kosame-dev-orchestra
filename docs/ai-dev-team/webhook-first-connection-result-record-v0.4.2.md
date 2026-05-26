# Webhook / n8n First Connection Result Record — v0.4.2

## 概要

v0.4.2 Cloud Run PM Agent への webhook および n8n 初回接続結果記録。

**Human Approval 後にじゅんやさんが接続を実施し、このファイルに結果を記録する。**
**AIは接続しない。**

接続設定生成: `node tools/pm-agent-n8n-first-connection-pack.js`

---

## 接続基本情報

| 項目 | 値 |
|---|---|
| 接続バージョン | v0.4.2 |
| Cloud Run URL | https://SERVICE_URL_PLACEHOLDER |
| 接続実施日時 | YYYY-MM-DD HH:MM:SS |
| 実施者 | じゅんやさん |
| 承認者 | じゅんやさん（Human Approval） |
| n8n インスタンス | N8N_INSTANCE_PLACEHOLDER |

---

## 接続テスト結果

| テスト | 結果 | 詳細 |
|---|---|---|
| Cloud Run health check | PENDING (pass / fail) | — |
| n8n → Cloud Run HTTP Request 疎通 | PENDING (pass / fail) | — |
| POST /dry-run-task (implementation) | PENDING (pass / fail) | — |
| POST /dry-run-task (blocked — critical) | PENDING (pass / fail) | — |
| n8n workflow 分岐 (claude_code ルート) | PENDING (pass / fail) | — |
| n8n workflow 分岐 (blocked ルート) | PENDING (pass / fail) | — |

全体結果: `PENDING (success / failed)`

---

## 使用した Authentication

- 認証方式: `PENDING (none / Cloud Run Invoker)`
- 初回 v0.4.0: `--allow-unauthenticated` (公開エンドポイント)
- v0.5.0 候補: Cloud Run Invoker 認証追加

---

## webhook エンドポイント確認

| エンドポイント | 状態 |
|---|---|
| GET /health | PENDING |
| GET /info | PENDING |
| POST /dry-run-task | PENDING |

---

## n8n ワークフロー設定記録

```json
{
  "nodeType": "n8n-nodes-base.httpRequest",
  "method": "POST",
  "url": "https://SERVICE_URL_PLACEHOLDER/dry-run-task",
  "contentType": "application/json",
  "timeoutMs": 30000,
  "retryOnFail": true,
  "retryCount": 1
}
```

---

## 問題・備考

PENDING (none / 問題があれば記録)

---

## 次アクション

PENDING (接続成功後の次ステップ):

候補:
- `dryRunOnly: false` 移行設計（v0.5.0 候補）
- Secret Manager 本格接続（v0.5.0 候補）
- Cloud Run Invoker 認証追加（v0.5.0 候補）
- n8n workflow 本格稼働

---

## rollback 判断

接続失敗時:
- Cloud Run 設定確認 → 必要に応じて rollback
- n8n ワークフロー停止
- `docs/ai-dev-team/cloud-run-rollback-runbook-v0.2.3.md` 参照

---

## 参考

- `tools/pm-agent-n8n-first-connection-pack.js` — 接続設定生成
- `docs/ai-dev-team/cloud-run-n8n-first-connection-v0.4.2.md` — 接続手順
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — smoke 記録
- `docs/ai-dev-team/cloud-run-production-cutover-notes-v0.4.2.md` — 本番移行メモ
