# KOSAME Dev Orchestra v9.5.0 Release Record

## Release: v9.5.0 Autonomous Repair & Retry Board

**Date:** 2026-05-30
**Status:** Released

## Summary

失敗時に、Claude修正/Gemini整理/Grok突破案/こさめ裁定/Human Approvalのどこへ
戻すべきかをrepair retry packetとして生成する。
自動修正を実行しない。実ファイルを書き換えない。repair instruction packetを生成するだけ。

## New Files

- `tools/autonomous-repair-retry-board-pack.js` — v9.5.0 Autonomous Repair & Retry Board
- `smoke/dev-agent-autonomous-repair-retry-board-pack-smoke.js` — smoke test
- `fixtures/autonomous-repair-retry-board.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v9.5.0-release-record.md` — this record
- `docs/ai-dev-team/autonomous-repair-retry-board-v9.5.0.md` — feature doc

## Failure Routing

| failureType | → agent |
|-------------|---------|
| syntax_error | claude |
| verify_failure | claude |
| missing_file | claude |
| provider_unavailable | fallback chain |
| safety_block | kosame |
| unclear_spec | kosame (→ Gemini for spec) |
| human_approval_required | human |
| repeated_failure | STOP → こさめ |

## Outputs

- repairBoardId
- failureClassification
- retryTargetAgent
- repairInstructionPacket
- retryLimit
- escalationPolicy
- stopConditions
- humanApprovalRequired
- recommendedNextAction
- dryRun: true
