# KOSAME Dev Orchestra v10.5.0 Release Record

## Version
10.5.0

## Title
Runtime Probe / Usage Console

## Release Date
2026-06-01

## Summary
v10.0.0 Full Orchestra Agent Runtime の `buildPacket` を公式に呼び出し、
planningPacket / parallelWorkPacket / mergedReviewPacket / repairRetryPacket / finalRuntimePacket / finalApprovalPacket
の生成状態を確認できる dry-run probe console を実装した。

## New Files
- `tools/full-orchestra-runtime-probe-console-pack.js` (v10.5.0)
- `smoke/dev-agent-full-orchestra-runtime-probe-console-pack-smoke.js`
- `fixtures/full-orchestra-runtime-probe-console.sample.json`
- `docs/ai-dev-team/full-orchestra-runtime-probe-console-v10.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v10.5.0-release-record.md`

## New Scripts
- `smoke:full-orchestra-runtime-probe-console-pack`
- `pm-agent:full-orchestra-runtime-probe-console`

## Key Design
- `full-orchestra-agent-runtime-pack.js` を require し `buildPacket` を呼び出す
- `buildPacket` が存在しない場合は安全に失敗 (safeFail)
- `packetPresence` で 7 つの必須パケットの有無を確認
- `probePassed` は全パケット存在 && buildError なし の場合のみ true
- `dryRun: true` / `humanApprovalRequired: true` 常時
- 実 API 実行なし / 実ファイル編集なし

## Required packetPresence Keys
- orchestraId
- planningPacket
- parallelWorkPacket
- mergedReviewPacket
- repairRetryPacket
- finalRuntimePacket
- finalApprovalPacket

## Safety
- blockedDangerousActions: git push / git tag / deploy / gcloud deploy / docker build / secret / .env / api key / customer data / destructive action / rm -rf
- approvalGateSummary: commit / push / tag / deploy すべて human YES 必須

## Verification
- node --check tools/full-orchestra-runtime-probe-console-pack.js: PASS
- npm run smoke:full-orchestra-runtime-probe-console-pack: PASS
- npm run verify: PASS (接続済み)
