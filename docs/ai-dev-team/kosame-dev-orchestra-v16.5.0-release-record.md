# KOSAME Dev Orchestra v16.5.0 Release Record

## Version
16.5.0

## Title
Repo Task Intake Console

## Release Date
2026-06-02

## Summary
じゅんやさんが「営業DXのこの機能を作りたい」などと言ったときに、作業要求をintake packetに正規化する。
対象商品判定・riskLevel・dataLevel・rejectedIfIncludesSecrets・recommendedNextActionを含める。

## New Files
- `tools/repo-task-intake-console-pack.js` (v16.5.0)
- `smoke/dev-agent-repo-task-intake-console-smoke.js`
- `fixtures/repo-task-intake-console.sample.json`
- `docs/ai-dev-team/repo-task-intake-console-v16.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v16.5.0-release-record.md`

## New Scripts
- `smoke:repo-task-intake-console`
- `pm-agent:repo-task-intake-console`

## Key Design
- `buildIntakePacket(input)` が作業要求をintake packetに正規化
- 5商品タイプ: sales_dx / anesty_board / backoffice_agent / email_reply_bot / cloud_run_pm_agent
- riskLevel: request内容からinfer (low/medium/high)
- dataLevel: request内容からinfer (A/B/C)
- rejectedIfIncludesSecrets: true 固定
- rejectedItems: 危険ワード検出 (secret/.env/api key/customer data/personal info等)
- recommendedNextAction: intake結果に応じた次アクション

## Safety
- dryRun: true / humanApprovalRequired: true 常時
- noRealRepoAccess: true / noRealExecution: true
- 危険ワード含む要求は intakeValid: false

## package.json version
16.5.0

## Verification
- node --check tools/repo-task-intake-console-pack.js: PASS
- npm run smoke:repo-task-intake-console: PASS
- npm run verify: PASS (接続済み)
