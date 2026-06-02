# KOSAME Dev Orchestra v25.0.0 Release Record

## Version
25.0.0

## Title
First Product Repo Work Order Console

## Release Date
2026-06-02

## Summary
実プロダクトrepoへ渡す「作業指示書」を生成する。
Claude Codeへ渡せる実務寄りのwork orderとして、taskGoal / businessContext / productContext /
implementationScope / filesAllowedToTouch / filesForbiddenToTouch / commandsAllowed /
commandsForbidden / verificationCommands / expectedDeliverables / reportFormat /
rollbackInstruction を含む。

## New Files
- `tools/first-product-repo-work-order-console-pack.js` (v25.0.0)
- `smoke/dev-agent-first-product-repo-work-order-console-smoke.js`
- `fixtures/first-product-repo-work-order-console.sample.json`
- `docs/ai-dev-team/first-product-repo-work-order-console-v25.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v25.0.0-release-record.md`

## New Scripts
- `smoke:first-product-repo-work-order-console`
- `pm-agent:first-product-repo-work-order-console`

## Key Design
- `buildWorkOrder(input)` が実務寄りの作業指示書を生成
- productContext: 商品別の注意事項 (ANESTY=保険/健康禁止、sales_dx=リードPII禁止等)
- commandsAllowed: 8種類の安全コマンド
- commandsForbidden: 12種類の禁止コマンド (git add/commit/push/tag/deploy含む)
- reportFormat: 8フィールド必須 + Stop instruction
- expectedDeliverables: 商品別の期待成果物リスト
- rollbackInstruction: 3段階のロールバック手順

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealRepoEdit: true / noRealExecution: true
- dangerousActionsDenied: 13種類

## package.json version
25.0.0

## Verification
- node --check tools/first-product-repo-work-order-console-pack.js: PASS
- npm run smoke:first-product-repo-work-order-console: PASS
- npm run verify: PASS (接続済み)
