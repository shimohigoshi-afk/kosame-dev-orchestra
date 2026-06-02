# Product Verification & Handoff Collector v18.5.0

## 目的
Claude実装後の結果を受け取り、検証情報を整理し、次のAI担当へhandoffする。

## 入力フィールド
| フィールド | 説明 |
|-----------|------|
| taskGoal | タスクの目的 |
| productType | 商品タイプ |
| editedFiles | 編集ファイル一覧 |
| diffSummaryRaw | git diff出力 |
| nodeCheckRaw | node --check出力 |
| npmVerifyRaw | npm run verify出力 |
| productSmokeRaw | smokeテスト出力 |
| rollbackNote | ロールバック手順 |

## Pass判定ロジック
- nodeCheckResult: 'ok'/'pass'を含む場合passed
- npmVerifyResult: 'error'/'fail'/'exit code 1'/'npm err'がない場合passed
- productSmokeResult: 'pass'を含み'fail'/'error'を含まない場合passed

## Handoff先
- handoffToKosame: こさめ/GPT PM
- handoffToGemini: Gemini (bulk処理/review)
- handoffToGrok: Grok (critique/review)

## Handoff Status
- READY: allPassed = true
- NEEDS_REVIEW: allPassed = false

## 安全ルール
- noRealCommit / noRealPush / noRealDeploy: true 固定
