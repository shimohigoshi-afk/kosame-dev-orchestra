# Approval Packet Practical Review Runner v14.5.0

## 目的
v14で生成された Human Approval Packet を Claude 実装前の最終レビューに通す。
approve / revise / reject / hold、dangerousActionGates、missingApprovalItems、safeNextAction を整理する。

## 入力
| フィールド | 必須 | 説明 |
|-----------|------|------|
| approvalPacket | ○ | v14.0.0 buildApprovalConsole の出力オブジェクト |
| riskLevel | - | 'low' / 'medium' / 'high' (デフォルト: packet内の値か 'low') |

## 出力
| フィールド | 説明 |
|-----------|------|
| checklist | 12項目のレビューチェックリスト |
| checklistPassed | 全項目 true か |
| dangerousActionsFound | packet内で検出された危険文字列の一覧 |
| missingApprovalItems | 欠落している必須項目の一覧 |
| finalDecision | approve / revise / reject / hold |
| finalDecisionOptions | 選択肢一覧 |
| dangerousActionGates | ブロック対象文字列一覧 |
| safeNextAction | finalDecision に応じた安全な次アクション |
| noRealApiExecution | true (固定) |
| noRealExecution | true (固定) |

## チェックリスト項目
1. dryRun is true
2. humanApprovalRequired
3. taskGoal present
4. targetFiles present
5. rollbackNote present
6. verificationPlan ready
7. claudePrompt ready
8. approveToDeploy is false
9. approveToReadSecrets is false
10. approveToUseRealApi is false
11. noRealApiExecution
12. noRealFileEdit

## Final Decision ロジック
- dangerousActionsFound > 3 → reject
- missingApprovalItems > 2  → revise
- checklistPassed = false   → revise
- riskLevel = 'high'        → hold
- それ以外                  → approve

## 安全ルール
- このツール自体は実行・編集・commit・push・tagを行わない
- じゅんやさんの明示的YES後にのみ実行に進む
