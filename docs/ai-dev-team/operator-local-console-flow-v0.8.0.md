# Operator Local Console Flow (v0.8.0)

## 基本フロー
1. **Intake**: 最新の状態ファイル、検証結果、Actions結果を読み込む。
2. **Analysis**: 状態を解析し、ダッシュボードデータや承認分類を生成。
3. **Display**: ターミナルに現在の状況と「推奨される次の一手」を表示。
4. **Export**: 必要に応じて Handoff Markdown をファイル出力。

## ユーザー体験 (CLI)
```bash
node tools/operator-local-console-pack.js
```
上記を実行すると、現在のサマリーが表示され、最後に「Next Action: ...」が強調される。
