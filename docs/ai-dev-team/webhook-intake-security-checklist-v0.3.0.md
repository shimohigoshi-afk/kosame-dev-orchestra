# Webhook Intake Security Checklist — v0.3.0

## 概要

Cloud Run PM Agent の webhook intake セキュリティチェックリスト。

v0.3.0 では設計・事前確認のみ。v0.4.0 deploy 後に実際のチェックを実施する。
Human Approval のもとで deploy し、接続確認後にセキュリティ設定を強化する。

---

## deploy 前セキュリティチェック

### HTTPS / TLS

- [ ] Cloud Run は自動で HTTPS エンドポイントを提供する（設定不要）
- [ ] HTTP → HTTPS リダイレクト（Cloud Run デフォルト）

### 認証・認可（v0.4.0 初回設定）

- [ ] `--allow-unauthenticated` で初回 deploy（n8n 接続確認用）
- [ ] 接続確認後: Cloud Run Invoker ロールで n8n Service Account を認証することを検討
- [ ] API キー認証は v0.5.0 以降の候補

### Secret Manager

- [ ] API キーは Secret Manager に登録（コード内 hardcode 禁止）
- [ ] Cloud Run Service Account に `Secret Manager Secret Accessor` 権限のみ付与
- [ ] `secretKeyRef` 参照のみ使用
- [ ] Secret の値を webhook request/response に含めない

### 入力バリデーション

- [ ] Task Packet のスキーマバリデーション実装済み（`task-packet-schema.js`）
- [ ] 必須フィールド（id / title / kind / riskLevel）の存在チェック
- [ ] kind の許可値チェック
- [ ] riskLevel の許可値チェック
- [ ] JSON パースエラー → 400 レスポンス

---

## n8n からの送信ルール

**許可:**

```json
{
  "id": "TASK-001",
  "title": "タスクタイトル",
  "kind": "implementation",
  "riskLevel": "low",
  "targetRepo": "kosame-dev-orchestra",
  "context": "説明（任意）"
}
```

**禁止（絶対に含めない）:**

- API キー値
- Secret Manager の値
- 認証トークン
- 個人情報

---

## deploy 後セキュリティ確認

```bash
# webhook コントラクト生成（確認用）
node tools/pm-agent-webhook-contract-generator.js

# ローカル smoke で動作確認
node tools/pm-agent-post-deploy-smoke.js https://SERVICE_URL
```

- [ ] HTTPS 接続確認
- [ ] 不正な JSON → 400 を確認
- [ ] riskLevel: critical タスク → blocked: true を確認
- [ ] Secret 値が response に漏れていないことを確認

---

## 参考

- `tools/pm-agent-webhook-contract-generator.js` — コントラクト生成
- `docs/ai-dev-team/n8n-cloud-run-connection-readiness-v0.3.0.md` — n8n 接続ガイド
- `docs/ai-dev-team/external-caller-contract-v0.3.0.md` — 外部呼び出しコントラクト
