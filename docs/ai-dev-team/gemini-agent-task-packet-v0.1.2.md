# Gemini Agent Task Packet v0.1.2

KOSAME Dev Orchestra における Gemini エージェントへのタスク指示形式。
v0.1.0 の方針定義を引き継ぎ、v0.1.2 で実装形式に更新。

---

## 概要

Gemini（Google AI API）に渡すタスクパケットの形式と運用方針を定義する。
v0.1.2 時点では Gemini provider は disabled。実API呼び出しは行わない。

---

## taskPacket 形式

```js
{
  id: "task-gemini-001",
  type: "review",           // "review" | "summarize" | "generate"
  input: "...",             // Gemini への指示文（日本語可）
  options: {
    language: "ja",
    maxTokens: 1024,
    model: "gemini-1.5-pro",  // 将来の実接続時に使用
  }
}
```

---

## type 別の用途

| type | 用途 |
|---|---|
| review | GCP コスト観点レビュー・Cloud Run 設定確認 |
| summarize | ドキュメント要約・長文下読み |
| generate | タスクパケット生成・議事録ドラフト |

---

## 現在の挙動（v0.1.2）

Gemini provider は `LIVE_CALL_ENABLED = false` のため、以下を返す：

```js
{
  success: false,
  provider: "gemini",
  response: null,
  error: "gemini provider: live call disabled — API key not configured",
  dryRun: true
}
```

---

## Human Approval が必要な操作

- Gemini API キーの設定
- `LIVE_CALL_ENABLED` の有効化
- 実 API 呼び出しの開始
- Gemini への課金が発生する操作すべて
- Secret Manager への API キー登録

---

## 実接続有効化フロー（v0.1.4 以降）

1. じゅんやさんが Secret Manager に Gemini API キーを設定
2. `gemini-provider.js` の `LIVE_CALL_ENABLED` を `true` に変更（Human Approval 必要）
3. npm run verify 実行
4. 承認後 deploy

---

## 関連ドキュメント

- `agent-interface-v0.1.2.md` — 共通インターフェース定義
- `agent-api-wiring-v0.1.3.md` — API Wiring 設計
- `gemini-agent-task-packet-v0.1.0.md` — v0.1.0 方針定義（原典）
- `providers/gemini-provider.js` — Gemini provider 実装
