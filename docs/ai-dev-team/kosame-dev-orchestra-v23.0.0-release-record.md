# KOSAME Dev Orchestra v23.0.0 Release Record

## Version
23.0.0

## Title
First Real Product Repo Dispatch Plan

## Release Date
2026-06-02

## Summary
営業DX / ANESTY / BackOffice / Email Reply BOT / Cloud Run PM Agent などの実プロダクトrepoへ、
どの順番で作業を流すかを決めるdispatch planを生成する。
実repo存在確認や実ファイル読取はしない。dry-run dispatch planのみ生成する。

## New Files
- `tools/first-real-product-repo-dispatch-plan-pack.js` (v23.0.0)
- `smoke/dev-agent-first-real-product-repo-dispatch-plan-smoke.js`
- `fixtures/first-real-product-repo-dispatch-plan.sample.json`
- `docs/ai-dev-team/first-real-product-repo-dispatch-plan-v23.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v23.0.0-release-record.md`

## New Scripts
- `smoke:first-real-product-repo-dispatch-plan`
- `pm-agent:first-real-product-repo-dispatch-plan`

## Key Design
- `buildDispatchPlan(input)` が dispatch plan を生成
- dispatchOrder: 7ステップ (Connection Prep → Safety Gate → Execution Prompt → Human YES → Claude exec → Verify → RC)
- requiredInputs: taskGoal / targetProduct / taskTitle / businessContext / allowedFileZones / deniedFileZones
- missingInputs: 不足入力を自動検出
- rollbackPlan: fileLevel / repoLevel / branchLevel の3段階
- verificationPlan: 商品別検証ステップ
- ANESTY Board: deniedFileZones に insurance/health を含む

## dispatchOrder の Human step
- step 4: Human final YES — じゅんやさん (required: true)

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealRepoAccess: true / noRealExecution: true
- dangerousActionsDenied: 14種類

## package.json version
23.0.0

## Verification
- node --check tools/first-real-product-repo-dispatch-plan-pack.js: PASS
- npm run smoke:first-real-product-repo-dispatch-plan: PASS
- npm run verify: PASS (接続済み)
