# v0.1.5 OpenAI / Gemini Live-Call Implementation

## 目的

v0.1.4 で構築した Live Call Gate の上に、OpenAI / Gemini への実 API 接続コードを実装する。
ただし、**今回の Claude Code 作業中に外部 API は呼ばない**。
実呼び出しは Human Approval 後の 1 回に限定する。

---

## 実装範囲

| ファイル | 変更内容 |
|---|---|
| `providers/provider-config.js` | 新環境変数対応・model/maxTokens/timeoutMs 設定追加 |
| `providers/gpt-provider.js` | fetch による OpenAI 実接続コード実装（gate 未達時は dry-run） |
| `providers/gemini-provider.js` | fetch による Gemini 実接続コード実装（gate 未達時は dry-run） |
| `tools/agent-runner-local.js` | --live フラグ対応・options 渡し |
| `tools/agent-live-call-one-shot.js` | 人間承認後の 1 回限定 live call 専用ツール |
| `smoke/dev-agent-live-call-implementation-smoke.js` | 実装確認 smoke テスト |

---

## 実行条件（すべて満たす必要がある）

外部 API を実際に呼ぶには、以下の **すべて** が必要：

1. `--live` フラグを明示的に指定する
2. `KOSAME_AGENT_LIVE_CALLS_ENABLED=true` を環境変数に設定する
3. `KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL=true` を環境変数に設定する
4. 対象プロバイダーの API キーが環境変数に存在する
   - GPT: `OPENAI_API_KEY`
   - Gemini: `GEMINI_API_KEY`

上記のうち **1 つでも欠ければ dry-run** で安全終了する。

---

## 環境変数一覧

| 変数名 | 役割 | デフォルト |
|---|---|---|
| `KOSAME_AGENT_LIVE_CALLS_ENABLED` | live call の大元スイッチ | false 扱い |
| `KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL` | 1 回限定 live call 許可 | false 扱い |
| `OPENAI_API_KEY` | OpenAI API キー（存在チェックのみ） | — |
| `GEMINI_API_KEY` | Gemini API キー（存在チェックのみ） | — |
| `KOSAME_AGENT_MODEL_OPENAI` | OpenAI モデル名 | `gpt-4o-mini` |
| `KOSAME_AGENT_MODEL_GEMINI` | Gemini モデル名 | `gemini-1.5-flash` |
| `KOSAME_AGENT_MAX_TOKENS` | 最大トークン数（上限 1000） | `300` |
| `KOSAME_AGENT_TIMEOUT_MS` | タイムアウト ms（上限 30000） | `15000` |

---

## リソース制限

- `maxTokens`: デフォルト 300、上限 1000
- `timeoutMs`: デフォルト 15000 ms、上限 30000 ms
- `AbortController` でタイムアウト時に fetch を中断する
- 1 回のみ実行して終了（無限ループなし）

---

## 絶対禁止ルール

### APIキー値の出力禁止

- `process.env.OPENAI_API_KEY` の値を `console.log` しない
- `process.env.GEMINI_API_KEY` の値を `console.log` しない
- `openaiKeyPresent` / `geminiKeyPresent` は boolean のみ返す
- Authorization ヘッダーに API キーをセットするが、ログに出さない

### .env / Secret Manager / GitHub Secrets の不読取り

- `require('dotenv')` は使わない
- `.env` ファイルを `readFileSync` で読まない
- Secret Manager API を呼ばない
- GitHub Secrets を直接読まない

### 実行・デプロイ禁止

- この Claude Code 作業中に `--live` を付けて実行しない
- `deploy` しない
- `git push` しない
- `git tag` しない

---

## live-call 実行手順（Human Approval 後）

以下は **じゅんやさん承認後** のみ実行可能：

```bash
KOSAME_AGENT_LIVE_CALLS_ENABLED=true \
KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL=true \
OPENAI_API_KEY=<secret> \
node tools/agent-live-call-one-shot.js --provider=gpt --live
```

`--live` がなければ何も起きない（dry-run で終了）。

---

## 課金連打禁止

- live call は Human Approval ごとに 1 回のみ
- ループ・自動再試行は禁止
- CI / GitHub Actions では `--live` を絶対に付けない
- `KOSAME_AGENT_LIVE_CALLS_ENABLED` を GitHub Secrets に入れない

---

## 次ステップ候補

- v0.1.6: Secret Manager / GitHub Secrets injection guide
- v0.2.0: Cloud Run PM Agent（実 API 呼び出しを含む本格稼働）
