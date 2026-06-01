# KOSAME Dev Orchestra v12.5.0 Release Record

## Version
12.5.0

## Title
Claude Execution Prompt Exporter

## Release Date
2026-06-01

## Summary
v12.0.0 の docs task packet から、Claude Code に貼れる実装用プロンプトを生成する。
生成するのはプロンプトだけ。Claude を自動実行しない。実ファイル編集もしない。

## New Files
- `tools/claude-execution-prompt-exporter-pack.js` (v12.5.0)
- `smoke/dev-agent-claude-execution-prompt-exporter-pack-smoke.js`
- `fixtures/claude-execution-prompt-exporter.sample.json`
- `docs/ai-dev-team/claude-execution-prompt-exporter-v12.5.0.md`
- `docs/ai-dev-team/kosame-dev-orchestra-v12.5.0-release-record.md`

## New Scripts
- `smoke:claude-execution-prompt-exporter-pack`
- `pm-agent:claude-execution-prompt-exporter`

## claudePrompt 必須内容
- 触ってよいファイル (allowedFiles)
- 触ってはいけないファイル (deniedFiles)
- 実装範囲 (Implementation Scope)
- 検証コマンド (verifyCommands)
- 完了条件 (doneCriteria)
- 禁止事項 (forbiddenActions)
- 報告形式 (Report Format: JSON)
- git add / git commit / git push / git tag はしない
- Secret / .env / API key は読まない
- 実 API 呼び出し禁止

## Key Design
- `docsTaskPacket` から `normalizedDocsTask.taskGoal` を取得してプロンプトに埋め込む
- `exportPassed`: claudePrompt が 100 文字以上の文字列の場合のみ true
- `dryRun: true` / `humanApprovalRequired: true` 常時
- Claude を自動実行しない

## Verification
- node --check tools/claude-execution-prompt-exporter-pack.js: PASS
- npm run smoke:claude-execution-prompt-exporter-pack: PASS
- npm run verify: PASS (接続済み)
