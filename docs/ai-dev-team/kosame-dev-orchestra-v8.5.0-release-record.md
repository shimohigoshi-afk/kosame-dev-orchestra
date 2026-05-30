# KOSAME Dev Orchestra v8.5.0 Release Record

## Release: v8.5.0 Multi-Agent Parallel Work Pack

**Date:** 2026-05-30
**Status:** Released

## Summary

Gemini/Grok/Claudeへ同時進行で仕事を振るためのParallel Work Packを実装。
実API実行は禁止。各AIに貼るためのprompt packetを生成するだけ。

## New Files

- `tools/multi-agent-parallel-work-pack.js` — v8.5.0 Multi-Agent Parallel Work Pack
- `smoke/dev-agent-multi-agent-parallel-work-pack-smoke.js` — smoke test
- `fixtures/multi-agent-parallel-work.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v8.5.0-release-record.md` — this record
- `docs/ai-dev-team/multi-agent-parallel-work-v8.5.0.md` — feature doc

## Parallel Work Rules

- 同時進行: OK (Gemini+Grok spec/weakness in parallel)
- 同時編集: NG
- repoを触るのはClaudeのみ
- Gemini/Grokは仕様整理・弱点指摘のみ (text output only)

## Outputs

- parallelWorkId
- agentTaskPackets (各AI向けprompt packet)
- executionOrder
- conflictPolicy
- deniedSharedEdits
- safetyBoundary
- humanApprovalRequired: true
- dryRun: true
