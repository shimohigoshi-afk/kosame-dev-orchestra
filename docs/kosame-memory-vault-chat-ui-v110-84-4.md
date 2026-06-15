# v110.84.4 Memory Vault Bootstrap + Chat UI Polish

## 目的
- `KOSAME Console` の記憶領域を bootstrap し、チャット欄を見やすく使いやすくする。

## 実装範囲
- `Memory Vault Bootstrap`
- `Chat UI Polish`
- `Memory` 状態の Console 表示
- `smoke / verify`

## 危険ゲート
- read-only を維持する
- `git add / commit / tag / push` はしない
- Secret / API key / `.env` / credentials は保存・表示しない
- `kosame-sales-dx` と `transcriber` は変更しない
- DeepSeek / opencode は使わない

## 保存対象
- 作業記憶
- 状態記憶
- やりたいこと記憶
- handoff
- `current-state.json`
- `memory-summary.json`

## 保存禁止データ
- API key
- Secret
- `.env`
- credentials
- 顧客情報
- 音声データ
- 営業DXの独自プロンプト全文
- transcriber の機密中身

## smoke項目
- bootstrap で必要ファイルが作られる
- `~/.kosame` を汚さない
- `memory-summary.json` が作られる
- Chat UI に bubble / quick action / status badge がある
- context summary に memoryVault が入る
