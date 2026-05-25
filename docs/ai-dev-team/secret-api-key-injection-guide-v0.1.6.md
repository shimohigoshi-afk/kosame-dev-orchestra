# v0.1.6 Secret / APIキー注入ガイド

## 目的

v0.1.5 で実装した OpenAI / Gemini live-call コードを、安全に one-shot 実行できる状態に持ち込む。
APIキー値をAIや外部ログに一切露出させずに、環境変数として注入する手順を定義する。

---

## 絶対禁止ルール

### AIチャットにAPIキー値を貼らない

- Claude Code / Gemini / ChatGPT などのAIチャット画面にAPIキー値を貼り付けない
- AIとのやり取りのログにAPIキー値が含まれないように注意する
- issue / PR のコメントにAPIキー値を書かない
- Slack / Discord にAPIキー値を貼らない

### APIキー値をログに出さない

- `console.log(process.env.OPENAI_API_KEY)` のような出力をしない
- アプリケーションのログファイルにAPIキー値が記録されないように確認する
- デバッグ出力にAPIキー値が含まれていないことを確認してから実行する
- APIキー値の存在確認は `boolean` 判定（`openaiKeyPresent`）のみで行う

### .env ファイルを使わない

- プロジェクトルートに `.env` ファイルを作らない
- `require('dotenv')` は使用禁止
- `.env.*` ファイルをgitリポジトリに置かない
- 一時的であっても `.env` に書いてコミットしない

---

## APIキー注入の手順

### Cloud Shell（推奨・一時設定）

Cloud Shell のターミナルで一時的に環境変数をセットする。
**シェルを閉じると消える**（安全）。

```bash
export KOSAME_AGENT_LIVE_CALLS_ENABLED=true
export KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL=true
export OPENAI_API_KEY=<OPENAI_API_KEY_VALUE>
export GEMINI_API_KEY=<GEMINI_API_KEY_VALUE>
export KOSAME_AGENT_MODEL_OPENAI=gpt-4o-mini
export KOSAME_AGENT_MODEL_GEMINI=gemini-1.5-flash
export KOSAME_AGENT_MAX_TOKENS=300
export KOSAME_AGENT_TIMEOUT_MS=15000
```

実行後は以下で解除する：

```bash
unset OPENAI_API_KEY
unset GEMINI_API_KEY
unset KOSAME_AGENT_LIVE_CALLS_ENABLED
unset KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL
```

### PowerShell（Windows / Windows Terminal・一時設定）

PowerShell セッション内でのみ有効。**セッションを閉じると消える**（安全）。

```powershell
$env:KOSAME_AGENT_LIVE_CALLS_ENABLED = "true"
$env:KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL = "true"
$env:OPENAI_API_KEY = "<OPENAI_API_KEY_VALUE>"
$env:GEMINI_API_KEY = "<GEMINI_API_KEY_VALUE>"
$env:KOSAME_AGENT_MODEL_OPENAI = "gpt-4o-mini"
$env:KOSAME_AGENT_MODEL_GEMINI = "gemini-1.5-flash"
$env:KOSAME_AGENT_MAX_TOKENS = "300"
$env:KOSAME_AGENT_TIMEOUT_MS = "15000"
```

実行後は以下で解除する：

```powershell
Remove-Item Env:OPENAI_API_KEY
Remove-Item Env:GEMINI_API_KEY
Remove-Item Env:KOSAME_AGENT_LIVE_CALLS_ENABLED
Remove-Item Env:KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL
```

---

## GitHub Secrets への登録（CI/CD用）

**注意**: GitHub Secrets はCI/CDでの利用のみ。ローカル実行には使わない。
**さらに注意**: `KOSAME_AGENT_LIVE_CALLS_ENABLED=true` を GitHub Secrets に登録すると、
CI が自動的に live call を試みる可能性がある。**登録しないこと。**

GitHub Secrets への登録が必要な場合の手順（Human Approval 必要）：

1. GitHub リポジトリの Settings → Secrets and variables → Actions
2. "New repository secret" をクリック
3. 以下の名前で登録する（値はAIに見せない）
   - `OPENAI_API_KEY`
   - `GEMINI_API_KEY`
4. `.github/workflows/*.yml` でのみ参照する
5. ワークフロー内で `echo` やログ出力しない

---

## GCP Secret Manager への登録（本番運用候補）

**今回（v0.1.6）は Secret Manager 操作を実行しない。**
v0.1.7 以降での対応を想定する。

基本方針（参考）：

- `gcloud secrets create OPENAI_API_KEY --data-file=-` などで登録
- アプリケーションからは `@google-cloud/secret-manager` SDK で取得
- IAM によるアクセス制御を必ず設定する
- ローカル開発環境では `GOOGLE_APPLICATION_CREDENTIALS` を使った認証が必要
- Secret Manager の値を `console.log` しない
- 取得した値は変数に入れてすぐ使い、ログに残さない

---

## 必要な環境変数一覧

| 変数名 | 役割 | 設定例 |
|---|---|---|
| `KOSAME_AGENT_LIVE_CALLS_ENABLED` | live call の大元スイッチ | `true` |
| `KOSAME_AGENT_ALLOW_ONE_SHOT_LIVE_CALL` | 1回限定 live call 許可 | `true` |
| `OPENAI_API_KEY` | OpenAI API キー | `<OPENAI_API_KEY_VALUE>` |
| `GEMINI_API_KEY` | Gemini API キー | `<GEMINI_API_KEY_VALUE>` |
| `KOSAME_AGENT_MODEL_OPENAI` | OpenAI モデル名 | `gpt-4o-mini` |
| `KOSAME_AGENT_MODEL_GEMINI` | Gemini モデル名 | `gemini-1.5-flash` |
| `KOSAME_AGENT_MAX_TOKENS` | 最大トークン数（上限 1000） | `300` |
| `KOSAME_AGENT_TIMEOUT_MS` | タイムアウト ms（上限 30000） | `15000` |

「設定例」列の `<...>` はプレースホルダーです。実際の値はドキュメントに書かないでください。

---

## APIキー値の確認方法

APIキー値そのものを確認・表示してはいけない。
確認は以下の方法のみ：

```bash
# キーが設定されているかどうかだけ確認（値は出さない）
node tools/agent-one-shot-preflight.js --provider=gpt
node tools/agent-one-shot-preflight.js --provider=gemini
```

出力は `providerKeyPresent: true/false` の boolean のみ。
APIキー値は絶対に出力しない。

---

## one-shot 実行の流れ（Human Approval 必要）

1. `node tools/agent-one-shot-preflight.js --provider=gpt` でpreflight確認
2. preflight が `readyForOneShot: true` を返すことを確認
3. じゅんやさんが承認
4. `node tools/agent-live-call-one-shot.js --provider=gpt --live` を1回だけ実行
5. 実行後に環境変数を解除
6. ログにAPIキー値が含まれていないことを確認
