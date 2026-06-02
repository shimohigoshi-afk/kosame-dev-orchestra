# KOSAME Dev Orchestra v14.5.0 Release Record

## Version
14.5.0

## Title
Approval Packet Practical Review Runner

## Release Date
2026-06-02

## Summary
v14で生成された Human Approval Packet を、Claude実装前の最終レビューに通すツール。
approve / revise / reject / hold、dangerousActionGates、missingApprovalItems、safeNextAction を整理する。

## New Files
- `tools/approval-packet-practical-review-runner-pack.js` (v14.5.0)
- `smoke/dev-agent-approval-packet-practical-review-runner-smoke.js`
- `fixtures/approval-packet-practical-review.sample.json`
- `docs/ai-dev-team/approval-packet-practical-review-runner-v14.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v14.5.0-release-record.md`

## New Scripts
- `smoke:approval-packet-practical-review-runner`
- `pm-agent:approval-packet-practical-review-runner`

## Key Design
- `buildReviewRunner(input)` が approval packet を受け取りレビューを実行
- `checklistPassed`: 12項目チェックリスト全通過で true
- `dangerousActionsFound`: packet本文に危険文字列が含まれるか検出
- `missingApprovalItems`: taskGoal / targetFiles / rollbackNote / verificationPlan / claudePrompt の欠落を収集
- `finalDecision`: approve / revise / reject / hold を自動判定
- `safeNextAction`: finalDecision に応じた安全な次アクション文字列

## Final Decision Logic
- dangerousActionsFound > 3 → reject
- missingApprovalItems > 2  → revise
- checklistPassed = false   → revise
- riskLevel = high          → hold
- それ以外                  → approve

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealApiExecution: true / noRealExecution: true
- git add / git commit / git push / git tag は実行しない

## package.json version
14.5.0

## Verification
- node --check tools/approval-packet-practical-review-runner-pack.js: PASS
- npm run smoke:approval-packet-practical-review-runner: PASS
- npm run verify: PASS (接続済み)
