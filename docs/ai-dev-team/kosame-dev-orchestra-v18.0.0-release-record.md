# KOSAME Dev Orchestra v18.0.0 Release Record

## Version
18.0.0

## Title
Product Template Applicator Console

## Release Date
2026-06-02

## Summary
商品別テンプレートを選んで、必要なdocs/smoke/tools/runbook候補を生成するpacketを作る。
templateId/productType/recommendedFiles/requiredSmoke/runbookDraft/launchChecklist/ownerRolesを含む。

## New Files
- `tools/product-template-applicator-console-pack.js` (v18.0.0)
- `smoke/dev-agent-product-template-applicator-console-smoke.js`
- `fixtures/product-template-applicator-console.sample.json`
- `docs/ai-dev-team/product-template-applicator-console-v18.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v18.0.0-release-record.md`

## New Scripts
- `smoke:product-template-applicator-console`
- `pm-agent:product-template-applicator-console`

## Key Design
- `buildTemplateApplicationPacket(input)` が商品別テンプレートを適用
- 5商品それぞれにrecommendedFiles/requiredSmoke/runbookDraft/launchChecklist/ownerRolesを定義
- launchChecklistには必ずじゅんやさんのfinal YESを含む
- ownerRoles: pm / impl / review / finalApproval を商品別に定義
- unknown productはエラーpacketを返す (graceful degradation)

## Safety
- noRealFileCreation: true / noRealExecution: true
- このpacket自体は実ファイル作成しない

## package.json version
18.0.0

## Verification
- node --check tools/product-template-applicator-console-pack.js: PASS
- npm run smoke:product-template-applicator-console: PASS
- npm run verify: PASS (接続済み)
