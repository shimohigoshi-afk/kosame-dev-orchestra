# KOSAME Dev Orchestra v21.0.0 Release Record

## Version
21.0.0

## Title
First Product Repo Task Packet

## Release Date
2026-06-02

## Summary
じゅんやさんが「営業DXのメール返信機能を作りたい」などと言ったときに、
初回の実プロダクトrepo向け作業依頼packetを生成する。
productRepoTaskId / requestedProduct / targetRepoCandidate / taskTitle / taskGoal /
businessContext / implementationIntent / allowedFileZones / deniedFileZones /
dataBoundary / secretBoundary / expectedOutputs / recommendedProvider /
claudeTaskDraft / verificationPlan / humanApprovalRequired / dangerousActionsDenied を含む。

## New Files
- `tools/first-product-repo-task-packet-pack.js` (v21.0.0)
- `smoke/dev-agent-first-product-repo-task-packet-smoke.js`
- `fixtures/first-product-repo-task-packet.sample.json`
- `docs/ai-dev-team/first-product-repo-task-packet-v21.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v21.0.0-release-record.md`

## New Scripts
- `smoke:first-product-repo-task-packet`
- `pm-agent:first-product-repo-task-packet`

## Key Design
- 5商品タイプそれぞれに allowedFileZones / deniedFileZones / dataBoundary / secretBoundary / recommendedProvider を定義
- claudeTaskDraft: taskGoal + allowedZones + deniedZones + forbiddenActions を構造化文字列として生成
- verificationPlan: 商品別検証ステップ
- ANESTY Board: insurance/health を deniedFileZones に含む
- unknown product: isKnownProduct: false / recommendedNextAction にサポート商品一覧を明示

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealRepoEdit: true / noRealExecution: true
- dangerousActionsDenied: git add/commit/push/tag / deploy / customer data等 18種類

## package.json version
21.0.0

## Verification
- node --check tools/first-product-repo-task-packet-pack.js: PASS
- npm run smoke:first-product-repo-task-packet: PASS
- npm run verify: PASS (接続済み)
