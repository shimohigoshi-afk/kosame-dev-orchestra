# Gemini Bulk Work Boundary (v0.5.5)

## 境界線定義
Gemini による大量生成がプロジェクトを破壊しないよう、以下の境界線を設ける。

### 編集禁止対象 (No-Touch Zone)
- `.git/` ディレクトリ
- `node_modules/`
- 既存のロジックが詰まった `bot.js` や `BOARD_CANON.js` 等のコアファイル（明示的な指示がある場合を除く）
- 本番環境の `.env` ファイル

### 動作制限
- **npm install 禁止**: package.json の scripts 追加は許可するが、パッケージ追加は PM 承認を必要とする。
- **git push 禁止**: 生成物はローカルディレクトリに留める。

### 推奨作業
- スケルトンコードの生成
- 大量のドキュメント（Markdown）作成
- テストケース（smoke test）の量産
- ログの要約・分析
