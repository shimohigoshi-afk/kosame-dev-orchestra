# External Caller Contract — v0.3.0

## 概要

Cloud Run PM Agent の外部呼び出しコントラクト（contract）。

n8n や将来の外部クライアントが PM Agent を呼び出す際のインターフェース定義。
v0.3.0 では設計のみ。Human Approval のもと v0.4.0 deploy 後に実接続テストを実施する。

---

## コントラクト生成

```bash
# コントラクト JSON を出力（外部呼び出しなし・設計確認用）
node tools/pm-agent-webhook-contract-generator.js
```

---

## エンドポイント定義

### GET /health

- 目的: ヘルスチェック・n8n connection check
- 認証: 不要（--allow-unauthenticated 設定下）
- レスポンス: `{ "status": "ok", "version": "...", "mode": "http-dry-run-intake" }`

### GET /info

- 目的: PM Agent メタ情報取得
- 認証: 不要
- レスポンス: `{ "dryRunOnly": true, "deployStatus": "deployed", ... }`

### POST /dry-run-task

- 目的: タスクルーティング判定
- 認証: 不要（初回）
- Content-Type: `application/json`
- リクエスト: Task Packet JSON

```json
{
  "id": "string",
  "title": "string",
  "kind": "docs | implementation | deploy | ...",
  "riskLevel": "low | medium | high | critical",
  "targetRepo": "string (任意)",
  "context": "string (任意)"
}
```

- レスポンス（成功）:

```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "recommendedOwner": "gemini | claude_code | kosame_pm | human",
    "blocked": false,
    "humanApprovalRequired": false
  }
}
```

- レスポンス（blocked）:

```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "recommendedOwner": "human",
    "blocked": true,
    "humanApprovalRequired": true
  }
}
```

---

## エラーレスポンス

| HTTP Status | 条件 |
|---|---|
| 400 | JSON パースエラー |
| 404 | 未対応ルート |
| 405 | メソッド不一致 |

---

## n8n 呼び出し設定

| 項目 | 設定値 |
|---|---|
| Method | POST |
| URL | `https://pm-agent-HASH-an.a.run.app/dry-run-task` |
| Header | `Content-Type: application/json` |
| Timeout | 30000ms |

### blocked: true 時の n8n 分岐

```
decision.blocked === true
  → n8n workflow を停止
  → じゅんやさんへ Slack/Discord 通知
```

---

## バージョニング方針

- v0.4.0 初回: `dryRunOnly: true` のまま
- v0.5.0 以降: `dryRunOnly: false` 移行（Human Approval 後）
- コントラクト変更時は本ドキュメントを更新する

---

## 参考

- `tools/pm-agent-webhook-contract-generator.js` — contract JSON 生成
- `docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md` — n8n 接続ガイド
- `docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md` — セキュリティチェック
