# Anthropic API Key 設定手順

## Claude APIを使うために必要なキー

### 1. APIキーを取得する
- https://console.anthropic.com/ にアクセス
- Account → API Keys → Create Key
- キー名: `kosame-dev-orchestra`
- 作成されたキーをコピー

### 2. .envに追加する
```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxx
```

### 3. サーバーを再起動する
```bash
pkill -f "node tools/" || true
node tools/kosame-live-cockpit-server.js
```

### 4. 確認
```bash
node -e "console.log('ANTHROPIC key:', !!process.env.ANTHROPIC_API_KEY)"
```
→ `true` が出ればOK

## フォールバックチェーン
1. **Claude (Anthropic)**: `claude-sonnet-4-6` — プライマリ
2. **Gemini (Google)**: `gemini-2.0-flash` — ANTHROPICキーがない場合
3. **Llama (Groq)**: `llama-3.3-70b` — Geminiキーもない場合

どのキーも設定されていない場合は dry-run モードになる。
