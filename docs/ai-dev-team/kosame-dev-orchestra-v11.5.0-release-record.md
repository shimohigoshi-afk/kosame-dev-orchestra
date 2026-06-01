# KOSAME Dev Orchestra v11.5.0 Release Record

## Version
11.5.0

## Title
Task Runner Usage Console

## Release Date
2026-06-01

## Summary
v11.0.0 First Practical Orchestra Task Runner を公式に呼び出し、
低リスク実タスクを投入した時に providerPromptPackets / verificationPlan / approvalPacket / rollbackNote が
生成されることを確認できる dry-run usage console を実装した。

## New Files
- `tools/task-runner-usage-console-pack.js` (v11.5.0)
- `smoke/dev-agent-task-runner-usage-console-pack-smoke.js`
- `fixtures/task-runner-usage-console.sample.json`
- `docs/ai-dev-team/task-runner-usage-console-v11.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v11.5.0-release-record.md`

## New Scripts
- `smoke:task-runner-usage-console-pack`
- `pm-agent:task-runner-usage-console`

## Key Design
- `first-practical-orchestra-task-runner-pack.js` を require して `buildRunner` を呼び出す
- `runnerPacketPresence` で 7 つの主要フィールドの存在を確認
- `providerPacketSummary` で 5 プロバイダー分のpacketの存在を確認
- `verificationSummary` で検証計画の存在を確認
- `usagePassed`: runner が成功した場合のみ true
- `dryRun: true` / `humanApprovalRequired: true` 常時
- `noRealApiExecution: true` / `noRealFileEdit: true`

## Safety
- blockedDangerousActions: git push / git tag / deploy / gcloud deploy / docker build / secret / .env / api key / customer data / destructive action / rm -rf
- approvalGateSummary: commit / push / tag / deploy すべて human YES 必須

## Verification
- node --check tools/task-runner-usage-console-pack.js: PASS
- npm run smoke:task-runner-usage-console-pack: PASS
- npm run verify: PASS (接続済み)
