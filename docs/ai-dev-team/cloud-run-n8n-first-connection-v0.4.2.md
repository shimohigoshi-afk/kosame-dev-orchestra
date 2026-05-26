# Cloud Run n8n First Connection — v0.4.2

## 概要

v0.4.2 Cloud Run PM Agent への n8n 初回接続手順。

**Human Approval なしに n8n 接続を実行しない。**
**接続はじゅんやさんが n8n インスタンスで設定・実行する。AIは接続しない。**

n8n 接続設定生成: `node tools/pm-agent-n8n-first-connection-pack.js`

---

## 前提条件

- [ ] Cloud Run PM Agent が deploy 済み（v0.4.0 完了）
- [ ] Cloud Run URL が確定済み
- [ ] smoke 全 PASS（v0.4.1 確認済み）
- [ ] n8n インスタンスが Cloud Run URL へのアクセス可能なネットワーク設定
- [ ] じゅんやさんの承認（Human Approval）

---

## n8n HTTP Request Node 設定

n8n ワークフローで以下の設定を使用する:

| 項目 | 値 |
|---|---|
| Node Type | HTTP Request |
| Method | POST |
| URL | https://SERVICE_URL/dry-run-task |
| Content-Type | application/json |
| Timeout | 30000 ms |
| Retry on fail | ON (1回, 2000ms delay) |
| Authentication | None (初回 v0.4.0) |

設定詳細: `node tools/pm-agent-n8n-first-connection-pack.js` で JSON 出力確認

---

## テスト用 Payload

```json
{
  "id": "N8N-TEST-001",
  "title": "n8n connection test",
  "kind": "implementation",
  "riskLevel": "low",
  "targetRepo": "kosame-dev-orchestra",
  "context": "n8n first connection test"
}
```

**注意:** `id` は一意にする。Secret / API キー値を payload に含めない。

---

## 期待されるレスポンス

```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "recommendedOwner": "claude_code",
    "blocked": false
  }
}
```

`blocked: true` の場合 (deploy/critical タスク) → n8n workflow を停止してじゅんやさんへ通知する。

---

## n8n Workflow 分岐設計

```
[n8n trigger] → [HTTP Request: POST /dry-run-task]
  → [decision.blocked === true]?
      YES → [Stop + Notify じゅんやさん]
      NO  → [decision.recommendedOwner]?
              claude_code → [Claude Code へ転送]
              gemini      → [Gemini Agent へ転送]
              human       → [じゅんやさんへ通知]
```

---

## 接続テスト手順

1. n8n ワークフローを手動トリガー
2. HTTP Request node が Cloud Run URL にアクセスできることを確認
3. レスポンスが `{ success: true, dryRun: true }` であることを確認
4. `blocked: true` 分岐が正しく動作することを確認
5. `docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md` に結果を記録

---

## 認証（v0.5.0 候補）

初回 v0.4.0 では `--allow-unauthenticated` で公開エンドポイント。
v0.5.0 以降で Cloud Run Invoker 認証追加を検討:

```bash
# 認証追加（v0.5.0 候補 — Human Approval 後）
gcloud run services update pm-agent \
  --no-allow-unauthenticated \
  --region asia-northeast1 \
  --project PROJECT_ID
```

n8n から OIDC token を取得して `Authorization: Bearer TOKEN` ヘッダーを追加する。

---

## 参考

- `tools/pm-agent-n8n-first-connection-pack.js` — n8n 接続設定生成
- `docs/ai-dev-team/webhook-first-connection-result-record-v0.4.2.md` — 接続結果記録
- `docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md` — 接続準備ガイド
- `docs/ai-dev-team/cloud-run-url-smoke-record-v0.4.1.md` — smoke 記録
