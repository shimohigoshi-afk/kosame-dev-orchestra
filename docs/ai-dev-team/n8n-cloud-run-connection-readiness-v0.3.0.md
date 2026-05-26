# n8n Cloud Run Connection Readiness — v0.3.0

## 概要

n8n から Cloud Run PM Agent への接続設計と準備ガイド。

v0.3.0 では設計のみ。実際の n8n 接続は v0.4.0 deploy 後に Human Approval を得て実施する。

---

## n8n 接続のアーキテクチャ

```
n8n workflow
  ↓
HTTP Request node (POST /dry-run-task)
  ↓
Cloud Run PM Agent (pm-agent service)
  ↓
routing decision (recommendedOwner / blocked)
  ↓
n8n: decision に応じてワークフロー分岐
```

---

## 接続設定（v0.4.0 deploy 後）

### n8n HTTP Request node の設定

| 項目 | 値 |
|---|---|
| Method | POST |
| URL | `https://SERVICE_URL/dry-run-task` |
| Content-Type | `application/json` |
| Body | Task Packet JSON |

### webhook URL 確認

```bash
# Cloud Run URL 取得（deploy 後）
gcloud run services describe pm-agent \
  --region asia-northeast1 \
  --project PROJECT_ID \
  --format "value(status.url)"
```

---

## Task Packet サンプル（n8n から送信）

```json
{
  "id": "N8N-TASK-001",
  "title": "実装タスク例",
  "kind": "implementation",
  "riskLevel": "low",
  "targetRepo": "kosame-dev-orchestra",
  "context": "n8n から送信されたタスク"
}
```

---

## レスポンス処理（n8n workflow 分岐）

```json
{
  "success": true,
  "dryRun": true,
  "decision": {
    "recommendedOwner": "claude_code",
    "blocked": false,
    "humanApprovalRequired": false
  }
}
```

| `recommendedOwner` | n8n での分岐 |
|---|---|
| `claude_code` | Claude Code へタスク転送 |
| `gemini` | Gemini Agent へタスク転送 |
| `kosame_pm` | PM Agent でレビュー |
| `human` | じゅんやさんに通知 |

`blocked: true` の場合は n8n workflow を停止してじゅんやさんに通知する。

---

## 接続準備チェックリスト

```bash
# webhook contract 生成（設計確認）
node tools/pm-agent-webhook-contract-generator.js
```

- [ ] Cloud Run URL が確定済み（v0.4.0 deploy 後）
- [ ] n8n HTTP Request node の設定を確認済み
- [ ] blocked: true 時の n8n ワークフロー分岐を設計済み
- [ ] Human Approval: n8n 接続テストの承認を得た

---

## セキュリティ注意事項

- n8n から送信する body に Secret や API キーを含めない
- Task Packet のみ送信する（id / title / kind / riskLevel / context）
- v0.4.0 初回は `--allow-unauthenticated`（接続確認後に認証追加を検討）

---

## 参考

- `tools/pm-agent-webhook-contract-generator.js` — webhook コントラクト生成
- `docs/ai-dev-team/external-caller-contract-v0.3.0.md` — 外部呼び出しコントラクト
- `docs/ai-dev-team/webhook-intake-security-checklist-v0.3.0.md` — セキュリティチェック
