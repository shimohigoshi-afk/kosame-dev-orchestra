# GPT Agent Task Packet v0.1.2

KOSAME Dev Orchestra における GPT エージェントへのタスク指示形式。

---

## 概要

GPT（OpenAI API）に渡すタスクパケットの形式と運用方針を定義する。
v0.1.2 時点では GPT provider は disabled。実API呼び出しは行わない。

---

## taskPacket 形式

```js
{
  id: "task-gpt-001",
  type: "review",          // "review" | "summarize" | "generate"
  input: "...",            // GPT への指示文（日本語可）
  options: {
    language: "ja",
    maxTokens: 1024,
    model: "gpt-4o",       // 将来の実接続時に使用
  }
}
```

---

## type 別の用途

| type | 用途 |
|---|---|
| review | コードレビュー・ドキュメントレビュー |
| summarize | 長文要約・会議議事録要約 |
| generate | ドキュメント生成・タスク指示文生成 |

---

## 現在の挙動（v0.1.2）

GPT provider は `LIVE_CALL_ENABLED = false` のため、以下を返す：

```js
{
  success: false,
  provider: "gpt",
  response: null,
  error: "gpt provider: live call disabled — API key not configured",
  dryRun: true
}
```

---

## Human Approval が必要な操作

- GPT API キーの設定
- `LIVE_CALL_ENABLED` の有効化
- 実 API 呼び出しの開始
- GPT への課金が発生する操作すべて

---

## 実接続有効化フロー（v0.1.4 以降）

1. じゅんやさんが Secret Manager に `OPENAI_API_KEY` を設定
2. `gpt-provider.js` の `LIVE_CALL_ENABLED` を `true` に変更（Human Approval 必要）
3. npm run verify 実行
4. 承認後 deploy

---

## 関連ドキュメント

- `agent-interface-v0.1.2.md` — 共通インターフェース定義
- `agent-api-wiring-v0.1.3.md` — API Wiring 設計
- `providers/gpt-provider.js` — GPT provider 実装
