# KOSAME Dev Orchestra v17.5.0 Release Record

## Version
17.5.0

## Title
Product Repo Safe Edit Planner

## Release Date
2026-06-02

## Summary
営業DX/ANESTY Board/BackOffice/メール返信BOT/Cloud Run PM Agentなどの商品repo別に安全な編集計画を生成する。
productType/repoPolicy/editableAreas/deniedAreas/secretBoundary/customerDataBoundary/safeFirstStep/verificationPlan/approvalGatesを含む。

## New Files
- `tools/product-repo-safe-edit-planner-pack.js` (v17.5.0)
- `smoke/dev-agent-product-repo-safe-edit-planner-smoke.js`
- `fixtures/product-repo-safe-edit-planner.sample.json`
- `docs/ai-dev-team/product-repo-safe-edit-planner-v17.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v17.5.0-release-record.md`

## New Scripts
- `smoke:product-repo-safe-edit-planner`
- `pm-agent:product-repo-safe-edit-planner`

## Key Design
- `buildSafeEditPlan(input)` が商品別安全編集計画を生成
- 5商品それぞれに固有のeditableAreas/deniedAreas/secretBoundary/customerDataBoundary
- ANESTY Board: insurance/health関連はdeniedAreasに含む
- verificationPlan: 商品別に必要なverifyステップを生成
- unknown productはisKnownProduct: falseで graceful fallback

## Safety
- noRealRepoEdit: true / noRealExecution: true
- dangerousActionsDenied明示

## package.json version
17.5.0

## Verification
- node --check tools/product-repo-safe-edit-planner-pack.js: PASS
- npm run smoke:product-repo-safe-edit-planner: PASS
- npm run verify: PASS (接続済み)
