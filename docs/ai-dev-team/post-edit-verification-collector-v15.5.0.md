# Post-Edit Verification Collector v15.5.0

## 目的
Claude編集後に、人間が貼った結果またはdry-run結果から検証情報を回収・整理する。
commit候補パケット (v16.0.0) に進む前の最終確認ゲート。

## 入力
| フィールド | 必須 | 説明 |
|-----------|------|------|
| taskGoal | ○ | 編集タスクの目的 |
| editedFiles | - | 編集したファイル一覧 |
| diffSummaryRaw | - | git diff の出力文字列 |
| nodeCheckRaw | - | node --check の出力文字列 |
| verifyRaw | - | npm run verify の出力文字列 |
| smokeRaw | - | smoke テストの出力文字列 |
| rollbackNote | - | ロールバック手順 |

## 出力
| フィールド | 説明 |
|-----------|------|
| diffSummary | { present, raw } |
| nodeCheckResult | { passed, raw } |
| verifyResult | { passed, raw } |
| smokeResult | { passed, raw } |
| remainingRisks | 未通過項目から生成されたリスク一覧 |
| allPassed | 全検証通過か |
| readyForCommitReview | commit候補作成準備完了か |
| recommendedNextAction | 推奨次アクション |

## Pass判定ロジック
- nodeCheckResult.passed: raw が 'ok' または 'pass' を含む場合
- verifyResult.passed: 'error' / 'fail' / 'exit code 1' / 'npm err' を含まない場合
- smokeResult.passed: 'pass' を含み 'fail'/'error' を含まない場合
- diffSummary.present: raw が null でない場合

## 残リスク生成ルール
- node --check 未通過 → 'node --check did not pass — syntax issue may remain'
- npm verify 未通過 → 'npm run verify did not pass — regressions possible'
- smoke 不明/未通過 → 'smoke test result unclear or not passed'
- diff なし → 'diff summary not provided — change scope unknown'
- rollbackNote なし → 'rollbackNote not provided'

## 安全ルール
- noRealCommit / noRealPush / noRealTag: true 固定
- このツール自体は git 操作を行わない
