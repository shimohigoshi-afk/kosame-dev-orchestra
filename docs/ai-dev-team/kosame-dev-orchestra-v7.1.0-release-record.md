# KOSAME Dev Orchestra v7.1.0 Release Record

## Release: v7.1.0 Provider Prompt Router Real Use Pack

**Date:** 2026-05-30
**Status:** Released

## Summary

v7.0.0 Practical Dev Factory Runtimeの内部で使われているprovider routingロジックを、実タスクで直接使いやすいパックとして切り出した。
taskType / productLine / riskLevel / dataLevel から、実用的なprovider routeと貼り付け用prompt packetを生成する。

## New Files

- `tools/provider-prompt-router-real-use-pack.js` — v7.1.0 Provider Prompt Router Real Use Pack
- `smoke/dev-agent-provider-prompt-router-real-use-pack-smoke.js` — smoke test
- `fixtures/provider-prompt-router-real-use.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v7.1.0-release-record.md` — this record
- `docs/ai-dev-team/provider-prompt-router-real-use-v7.1.0.md` — feature doc

## Key Features

- taskType / productLine / riskLevel / dataLevel からprovider routeを自動選択
- ProductLine別のcontextual guidanceを含むprompt packetを生成
- Level C dataは自動的にkosameまたはhuman onlyへルーティング
- critical riskは自動的にkosameへルーティング
- 全外部provider dispatching前に humanApprovalRequired=true を保証
- dryRun=true 固定

## Routing Rules

| taskType | provider |
|---|---|
| implementation / bugfix / repair | claude |
| draft / docs / bulk | gemini |
| strategy / breakthrough | grok |
| review / safety / final / critical | kosame |
| Level C data | kosame or human only |

## Safety

- BLOCKED_DANGEROUS_ACTIONS: git push, git tag, deploy, Secret value read, etc.
- dryRun: true (always)
- humanApprovalRequired: true (always)
- DeepSeek/Kimi: Level A + anonymized only

## smoke result

```
=== provider-prompt-router-real-use-pack smoke ===
  PASS: package version 7.1.0 or later
  PASS: smoke script exists
  PASS: release record exists
  PASS: fixture exists
  PASS: tool meta version 7.1.0
  PASS: dryRun true
  PASS: humanApprovalRequired true
  PASS: providerRoute selectedProvider present
  PASS: promptPacket prompt present
  PASS: safetyCheck and contextualGuidance present
  PASS: implementation routes to claude
  PASS: draft routes to gemini
  PASS: strategy routes to grok
  PASS: review routes to kosame/human
  PASS: Level C blocks external provider
  PASS: product lines include sales_dx and anesty_board
  PASS: recommendedNextAction present
  PASS: blockedDangerousActions includes git push / git tag / deploy / secret
  PASS: anesty_board contextualGuidance present
PASS: provider-prompt-router-real-use-pack
```
