# Orchestra Result Merger v9.0.0

## 概要

Gemini/Grok/Claudeの結果テキストを取り込み、こさめ副社長が採否判定できる
merge decision packetを生成する。実ファイルへの自動適用は一切しない。

## 入力

| フィールド | 説明 |
|-----------|------|
| geminiResult | Geminiの結果テキスト |
| grokResult | Grokの結果テキスト |
| claudeResult | Claudeの実装・verify結果 |
| originalTask | 元のタスク目標 |
| safetyBoundary | v8.0.0の安全境界 |
| verificationSummary | npm run verify結果 |

## 出力

| フィールド | 説明 |
|-----------|------|
| mergerId | ユニークID |
| normalizedResults | 各AI結果の正規化 |
| adoptedItems | 採用候補 |
| rejectedItems | 却下候補 |
| unresolvedItems | 未解決（人間レビュー必要） |
| mergeDecisionPacket | 採用判断packet |
| reviewDecision | 最終判断 |
| humanReviewRequired | humanレビュー要否 |
| recommendedNextAction | 次アクション推奨 |
| dryRun | true (常に) |

## reviewDecision 分類

| 判断 | 条件 |
|------|------|
| adopted | 全結果採用、verify PASS |
| partial_adopt | 一部採用、一部却下 |
| rejected | 全結果却下 |
| human_review | 未解決あり、またはverify不明 |
| escalate | 重大問題、こさめへ即時エスカレ |
