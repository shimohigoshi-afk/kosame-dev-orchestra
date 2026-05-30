# KOSAME Dev Orchestra v7.2.0 Release Record

## Release: v7.2.0 Task Execution Packet Generator

**Date:** 2026-05-30
**Status:** Released

## Summary

Claude / Gemini / Grok / DeepSeek / Kimi / Human Approvalにそのまま渡せる実行パケットを生成する。
触ってよいファイル、触ってはいけないファイル、検証コマンド、完了条件、禁止事項、報告形式を含める。

## New Files

- `tools/task-execution-packet-generator-pack.js` — v7.2.0 Task Execution Packet Generator
- `smoke/dev-agent-task-execution-packet-generator-pack-smoke.js` — smoke test
- `fixtures/task-execution-packet-generator.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v7.2.0-release-record.md` — this record
- `docs/ai-dev-team/task-execution-packet-generator-v7.2.0.md` — feature doc

## Key Features

- allowedFiles: productLine別に触ってよいファイルパターンを出力
- deniedFiles: .env / secrets / node_modules / .git / Dockerfile / apps/pm-agent 等を常時禁止
- verifyCommands: node --check / npm run smoke / npm run verify / git diff --stat の順番で出力
- doneCriteria: taskGoal / taskType / productLine別の完了条件
- forbiddenActions: riskLevel / dataLevel に応じた禁止アクション
- reportFormat: JSON形式の報告書フォーマット (status / summary / filesChanged / verifyResult / issues / nextAction)
- Level C: dispatch to external AI provider 禁止
- dryRun=true 固定 / humanApprovalRequired=true 固定

## smoke result

```
=== task-execution-packet-generator-pack smoke ===
  PASS: package version 7.2.0 or later
  PASS: smoke script exists
  PASS: release record exists
  PASS: fixture exists
  PASS: tool meta version 7.2.0
  PASS: dryRun true
  PASS: humanApprovalRequired true
  PASS: allowedFiles present
  PASS: deniedFiles present and includes .env
  PASS: verifyCommands include node --check and npm run verify
  PASS: doneCriteria present
  PASS: forbiddenActions includes git push / git tag / deploy / secret
  PASS: reportFormat includes required fields
  PASS: packetId present
  PASS: Level C blocks external provider dispatch
  PASS: product lines include sales_dx and anesty_board
  PASS: recommendedNextAction present
PASS: task-execution-packet-generator-pack
```
