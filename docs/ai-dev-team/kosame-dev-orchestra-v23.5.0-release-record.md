# KOSAME Dev Orchestra v23.5.0 Release Record

## Version
23.5.0

## Title
Product Repo Safety Gate Review Pack

## Release Date
2026-06-02

## Summary
実プロダクトrepoへ作業を流す前に、危険操作・Secret境界・顧客情報境界・
保険/健診/個人情報境界・deploy/commit/push/tagの承認条件をレビューする。
safetyChecklist / secretBoundaryReview / customerDataBoundaryReview /
regulatedDataBoundaryReview / deployRiskReview / gitOperationReview /
allowedActions / blockedActions / humanApprovalGates / safetyGatePassed を含む。

## New Files
- `tools/product-repo-safety-gate-review-pack.js` (v23.5.0)
- `smoke/dev-agent-product-repo-safety-gate-review-smoke.js`
- `fixtures/product-repo-safety-gate-review.sample.json`
- `docs/ai-dev-team/product-repo-safety-gate-review-pack-v23.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v23.5.0-release-record.md`

## New Scripts
- `smoke:product-repo-safety-gate-review`
- `pm-agent:product-repo-safety-gate-review`

## Key Design
- `buildSafetyGateReview(input)` が13項目のsafetyChecklistを評価
- regulatedDataBoundaryReview: ANESTY(保険/健康) / backoffice_agent(財務/HR) は applicable: true
- deployRiskReview: ANESTY/backoffice = high, sales_dx/email_reply_bot = medium, cloud_run = low
- gitOperationReview: requiresHumanYes / autoApproved を明示
- blockedActions: 9種類の自動禁止アクション
- allowedActions: 7種類の許可アクション
- humanApprovalGates: 4段階 (こさめPM → Claude impl → こさめdiff → じゅんやさんYES)
- finalDecision: blockers > 3 → reject / > 0 → hold / deployRisk high → hold / else → approve

## Safety
- noRealRepoAccess: true / noRealExecution: true
- Secret / .env / API key は読まない
- 顧客情報・保険証券・健診情報・個人名入り議事録は読まない

## package.json version
23.5.0

## Verification
- node --check tools/product-repo-safety-gate-review-pack.js: PASS
- npm run smoke:product-repo-safety-gate-review: PASS
- npm run verify: PASS (接続済み)
