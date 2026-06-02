# KOSAME Dev Orchestra v15.0.0 Release Record

## Version
15.0.0

## Title
First Safe Docs Edit Execution Pack

## Release Date
2026-06-02

## Summary
README.mdなど低リスクdocs編集に限定して、Claude編集用の安全実行packetを生成する。
まだ実ファイル編集・commit・push・tagは自動実行しない。
allowedFiles / deniedFiles / editScope / verifyCommands / doneCriteria / rollbackHint を含める。

## New Files
- `tools/first-safe-docs-edit-execution-pack.js` (v15.0.0)
- `smoke/dev-agent-first-safe-docs-edit-execution-pack-smoke.js`
- `fixtures/first-safe-docs-edit-execution.sample.json`
- `docs/ai-dev-team/first-safe-docs-edit-execution-pack-v15.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v15.0.0-release-record.md`

## New Scripts
- `smoke:first-safe-docs-edit-execution`
- `pm-agent:first-safe-docs-edit-execution`

## Key Design
- `buildSafeDocsEditPack(input)` が安全実行packetを生成
- `allowedFiles`: デフォルトは `./docs/ai-dev-team/**` と `./README.md` のみ
- `deniedFiles`: .env / secrets / credentials / tools / smoke / fixtures / package.json
- `editScope`: targetFiles ごとに isAllowed / isDenied を判定
- `verifyCommands`: node --check / npm run verify / git status
- `doneCriteria`: 完了判定条件リスト
- `rollbackHint`: ロールバック手順
- `readyToPresent`: allAllowed && !anyDenied

## Safety
- noRealFileEdit: true
- noRealCommit: true / noRealPush: true / noRealTag: true
- dangerousActionsDenied: git add/commit/push/tag / deploy / docker build / rm -rf
- じゅんやさんのYESなしに実行しない

## package.json version
15.0.0

## Verification
- node --check tools/first-safe-docs-edit-execution-pack.js: PASS
- npm run smoke:first-safe-docs-edit-execution: PASS
- npm run verify: PASS (接続済み)
