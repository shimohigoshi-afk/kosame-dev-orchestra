# KOSAME Task Vault & Auto Save 作業票

> バージョン: 110.83.0  
> 作業名: v110.83 KOSAME Task Vault & Auto Save  
> 方針: ローカル保存のみ、read/write は Task Vault 配下に限定

## 目的

現在のミッション・タスク・判断・次の一手・危険ゲート・verify結果・引継ぎメモをローカルに自動保存し、チャット消失や 60 分タイムアウト後でも次の AI が現在地を復旧できるようにする。

## 実装範囲

- Task Vault の保存/読込ロジック
- Auto Save の snapshot 生成ロジック
- Cockpit snapshot への `autosave` / `taskVault` 表示
- API COST METER の概算表示
- 10分 autosave / 50分 checkpoint の設計値
- 常駐 daemon / cron 化はしない

## 変更予定ファイル

- `tools/kosame-task-vault.js`
- `tools/kosame-autosave-state.js`
- `tools/kosame-cost-meter.js`
- `tools/kosame-live-cockpit-server.js`
- `public/kosame-live-cockpit.html`
- `smoke/v110-83-task-vault-autosave-smoke.js`
- `config/provider-pricing-estimates.json`
- `package.json`

## 危険ゲート

- `git add / commit / push / tag` は実行しない
- 外部 API / DB / Gmail / Cloud Run / GCS は使わない
- `OPENAI_API_KEY` / `.env` / `credentials` は値を読まない
- `kosame-sales-dx` と `transcriber` は触らない
- DeepSeek / opencode は使わない

## 保存対象

- 現在のミッション
- 未完了タスク / 完了タスク / 保留タスク
- じゅんやさんの判断
- 次にやること
- 直近の危険ゲート
- 対象 repo
- 担当 AI
- 変更予定ファイル
- 最後の git status
- 最後の verify 結果
- 次チャット引継ぎメモ
- 最終保存時刻
- 最新 checkpoint 時刻

## 保存禁止データ

- API key
- Secret
- `.env` の中身
- credentials
- 顧客情報
- 音声データ
- 営業 DX の独自プロンプト全文
- transcriber の機密中身
- 保険ロジック
- 価格戦略
- 温度判定詳細

## smoke 項目

- Task Vault ディレクトリを作れる
- `current-state.json` を書ける
- `tasks.jsonl` に追記できる
- `decisions.jsonl` に追記できる
- `autosaves/` に snapshot を保存できる
- `checkpoints/` に checkpoint を保存できる
- `handoff/latest-handoff.md` を生成できる
- `KOSAME_TASK_VAULT_DIR` を使える
- `~/.kosame` を直接汚さない
- 禁止データを raw 保存しない
- Cockpit snapshot に `taskVault` / `autoSave` 状態が入る
- Cockpit snapshot に `apiCost.total / byProvider / byModel` が入る
- Codex への自動応答送信がない
- `npm run smoke:v110-83` が PASS
- `npm run verify` が PASS
