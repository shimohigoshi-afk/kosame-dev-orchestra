# First Product Repo Handoff & Result Import Pack v26.0.0

## 目的
実プロダクトrepoでClaudeが作業した後、その報告をKOSAME Dev Orchestra側で受け取り整理する。

## 入力フィールド
| フィールド | 説明 |
|-----------|------|
| targetProduct | 商品タイプ |
| taskGoal | タスクの目的 |
| claudeReportSummary | Claude報告のサマリーテキスト |
| changedFilesReported | 変更されたファイルリスト |
| verificationResultsRaw | npm run verify の出力 |
| nodeCheckRaw | node --check の出力 |
| gitStatusReported | git status の出力 |
| risksReported | 残リスクリスト |
| rollbackNote | ロールバック手順 |
| allowedFileZones | 許可ゾーン |
| deniedFileZones | 禁止ゾーン |

## sensitiveContent 検出パターン (14種)
api key / api_key / secret / .env / password / token / credential / insurance / health record / patient / policyholder / employee salary / financial record / personal info / pii

## commitCandidateReady の条件 (全て満たす場合)
1. verificationResultsReported.passed = true
2. fileZoneCheck.clean = true (changed files in allowed zones only)
3. hasSensitiveContent = false
4. dangerousOpsInReport.length = 0
5. blockedItems.length = 0

## needsHumanApproval の条件
- rejectedItems.length > 0 OR dangerousOpsInReport.length > 0 OR hasSensitiveContent = true

## 安全ルール
- noRealCommit / noRealPush / noRealTag / noRealDeploy: true 固定
- 実commit/push/tag は一切しない
- hasSensitiveContent = true の場合は importReady = false
