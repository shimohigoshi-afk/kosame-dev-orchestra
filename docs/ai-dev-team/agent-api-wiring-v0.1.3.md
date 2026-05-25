# Agent API Wiring Preparation v0.1.3

KOSAME Dev Orchestra における GPT / Gemini API 接続準備ドキュメント。
現時点では実API呼び出しは disabled。APIキー・Secret は一切読まない。

---

## 概要

v0.1.3 では API 接続のための「配線設計」だけを確立する。
実際の API 呼び出しは v0.1.4 以降で Human Approval を得てから行う。

---

## 現在の状態

| provider | 実API呼び出し | APIキー要否 | 現在の挙動 |
|---|---|---|---|
| mock | なし | 不要 | ローカル固定応答（常に成功） |
| GPT | disabled | 未設定 | dry-run エラー返却 |
| Gemini | disabled | 未設定 | dry-run エラー返却 |

---

## 将来の接続方式（設計のみ / 未実装）

### GPT（OpenAI API）

```
エンドポイント: https://api.openai.com/v1/chat/completions
認証: Bearer ${OPENAI_API_KEY}
モデル例: gpt-4o
APIキー管理: Secret Manager（GCP） または GitHub Secrets
実接続有効化: Human Approval 必要
```

### Gemini（Google AI API）

```
エンドポイント: https://generativelanguage.googleapis.com/v1beta/models/...
認証: APIキー または Service Account
モデル例: gemini-1.5-pro
APIキー管理: Secret Manager（GCP）
実接続有効化: Human Approval 必要
```

---

## 有効化手順（v0.1.4 以降）

1. Secret Manager にAPIキーを登録（じゅんやさんが実施）
2. provider の `LIVE_CALL_ENABLED` フラグを `true` に変更
3. npm run verify で回帰確認
4. じゅんやさんの承認後に deploy

---

## 禁止事項

- .env / .env.* の読み取り
- Secret Manager の値閲覧
- GitHub Secrets の直接参照
- v0.1.3 時点での外部API呼び出し

---

## Human Approval が必要な操作

- `LIVE_CALL_ENABLED = true` への変更
- APIキーの設定・ローテーション
- 外部API通信の有効化
- deploy（Cloud Run / Railway）

---

## 関連ドキュメント

- `agent-interface-v0.1.2.md` — provider インターフェース仕様
- `permission-policy-v0.1.0.md` — Claude Code 権限方針
- `gpt-agent-task-packet-v0.1.2.md` — GPT タスクパケット形式
- `gemini-agent-task-packet-v0.1.2.md` — Gemini タスクパケット形式
