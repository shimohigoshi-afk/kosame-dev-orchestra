# Agent Live Call Gate v0.1.4

KOSAME Dev Orchestra における実 API 呼び出し安全ゲート定義。

---

## 目的

OpenAI / Gemini の実 API 接続へ進む直前の安全ゲートを実装する。
接続の構造・設定名・ON/OFF 制御を確立し、誤った実 API 呼び出しを防止する。

---

## v0.1.4 の状態

`liveCallsActuallyEnabled` は **常に `false`** に固定されている。
環境変数 `KOSAME_AGENT_LIVE_CALLS_ENABLED=true` が設定され、APIキーが存在しても、
v0.1.4 では実 API 呼び出しは行われない。

| 項目 | v0.1.4 の値 |
|---|---|
| `liveCallsActuallyEnabled` | `false`（固定） |
| 実 API 呼び出し | disabled |
| gpt / gemini provider | dry-run エラー返却 |

---

## live call ON の条件（v0.1.5 以降）

以下すべてが揃い、Human Approval を得た後に `liveCallsActuallyEnabled = true` に変更する：

1. `KOSAME_AGENT_LIVE_CALLS_ENABLED === "true"`（環境変数）
2. 対象プロバイダーの APIキーが存在する（`openaiKeyPresent` / `geminiKeyPresent` が `true`）
3. じゅんやさんの Human Approval が得られている
4. `npm run verify` が全 passed

---

## 参照する環境変数

| 変数名 | 用途 |
|---|---|
| `KOSAME_AGENT_LIVE_CALLS_ENABLED` | live call 要求フラグ（"true" で要求） |
| `OPENAI_API_KEY` | OpenAI APIキー存在確認（boolean のみ） |
| `GEMINI_API_KEY` | Gemini APIキー存在確認（boolean のみ） |

---

## APIキー値の取り扱いルール

- APIキー値は絶対に出力しない（`console.log` / `JSON.stringify` 禁止）
- boolean（存在するかどうか）のみ扱う
- `providers/provider-config.js` がこのルールを集約する

---

## .env / Secret Manager / GitHub Secrets のルール

- `.env` / `.env.*` ファイルは読まない（`require('dotenv')` 禁止）
- Secret Manager の値は読まない
- GitHub Secrets は直接参照しない
- `process.env` の参照は許可するが、値の出力は禁止

---

## Human Approval が必要な操作

- `liveCallsActuallyEnabled = true` への変更
- APIキーの環境変数設定・ローテーション
- 実 API 呼び出しの有効化
- 課金が発生するすべての操作
- deploy（Cloud Run / Railway）

---

## 次のステップ（v0.1.5 以降）

v0.1.5 では、じゅんやさんの Human Approval を得た上で以下を実施する：

1. `liveCallsActuallyEnabled = true` への変更
2. OpenAI / Gemini SDK の実装（npm install を伴う）
3. 実 API 呼び出しの検証
4. `npm run verify` で回帰確認
5. じゅんやさんの承認後に deploy

---

## 関連ドキュメント

- `agent-interface-v0.1.2.md` — provider インターフェース定義
- `agent-api-wiring-v0.1.3.md` — API Wiring 設計
- `providers/provider-config.js` — ゲート判定実装
- `tools/agent-live-gate-check.js` — ゲート状態確認ツール
