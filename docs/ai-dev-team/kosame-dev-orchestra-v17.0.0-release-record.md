# KOSAME Dev Orchestra v17.0.0 Release Record

## Version
17.0.0

## Title
Cross-Repo Claude Execution Prompt Builder

## Release Date
2026-06-02

## Summary
intake packetからClaude Codeへ渡す実装promptを生成する。
実際の外部repo編集はしない。
allowedFiles/deniedFiles/implementationScope/forbiddenActions/verifyCommands/doneCriteria/reportFormat/rollbackPolicy/claudePromptを含む。

## New Files
- `tools/cross-repo-claude-execution-prompt-builder-pack.js` (v17.0.0)
- `smoke/dev-agent-cross-repo-claude-execution-prompt-builder-smoke.js`
- `fixtures/cross-repo-claude-execution-prompt-builder.sample.json`
- `docs/ai-dev-team/cross-repo-claude-execution-prompt-builder-v17.0.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v17.0.0-release-record.md`

## New Scripts
- `smoke:cross-repo-claude-execution-prompt-builder`
- `pm-agent:cross-repo-claude-execution-prompt-builder`

## Key Design
- `buildPrompt(input)` がintake packetからClaude実装promptを生成
- productTypeに応じてallowedFiles/deniedFilesを自動選択
- forbiddenActions: git add/commit/push/tag/deploy/docker build等を明示
- claudePrompt: 構造化テキストとして生成 (Target Repo / Allowed / Denied / Forbidden / Verify / Done Criteria / Rollback)
- reportFormat: 結果回収用フォーマット定義

## Safety
- noRealRepoEdit: true / noRealExecution: true
- prompt内にもforbiddenActions明示

## package.json version
17.0.0

## Verification
- node --check tools/cross-repo-claude-execution-prompt-builder-pack.js: PASS
- npm run smoke:cross-repo-claude-execution-prompt-builder: PASS
- npm run verify: PASS (接続済み)
