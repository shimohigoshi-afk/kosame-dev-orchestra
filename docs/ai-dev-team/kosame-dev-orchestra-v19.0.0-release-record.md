# KOSAME Dev Orchestra v19.0.0 Release Record

## Version
19.0.0

## Title
Product Release Candidate Packet Builder

## Release Date
2026-06-02

## Summary
商品repoでの実装結果をrelease candidate packetにまとめる。
まだ実release/deploy/pushはしない。
releaseCandidateId/targetProduct/targetRepo/intendedFiles/deniedFiles/verificationSummary/
releaseNotesDraft/rollbackNote/prePushChecklist/preDeployChecklist/humanApprovalRequired/dangerousActionsDeniedを含む。

## New Files
- `tools/product-release-candidate-packet-builder-pack.js` (v19.0.0)
- `smoke/dev-agent-product-release-candidate-packet-builder-smoke.js`
- `fixtures/product-release-candidate-packet-builder.sample.json`
- `docs/ai-dev-team/product-release-candidate-packet-builder-v19.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v19.0.0-release-record.md`

## New Scripts
- `smoke:product-release-candidate-packet-builder`
- `pm-agent:product-release-candidate-packet-builder`

## Key Design
- `buildReleaseCandidatePacket(input)` がRC packetを生成
- intendedFilesのdenied file混入チェック
- releaseNotesDraft: version + taskGoal + files + verify結果から自動生成
- prePushChecklist: 8項目 (じゅんやさんYES含む)
- preDeployChecklist: 8項目 (staging/SecretManager/Actions含む)
- absolutelyForbidden: 自動git/deploy操作の明示禁止リスト

## Safety
- noRealRelease/Deploy/Push: true 固定
- git add/commit/push/tag/deploy は絶対に実行しない

## package.json version
19.0.0

## Verification
- node --check tools/product-release-candidate-packet-builder-pack.js: PASS
- npm run smoke:product-release-candidate-packet-builder: PASS
- npm run verify: PASS (接続済み)
