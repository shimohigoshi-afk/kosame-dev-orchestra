# Operator CLI Command Map (v0.7.3)

## 主要コマンド（将来像）
- `status`: 現在の状態を表示。
- `next`: 次のアクションを表示。
- `handoff`: 引継ぎ資料を生成。
- `approve`: 項目を承認。

## 実装方針
現時点では、`tools/operator-cli-status.js` 内に関数として定義し、引数によって出力を切り替える。
```bash
node tools/operator-cli-status.js --mode=summary
node tools/operator-cli-status.js --mode=next
```
