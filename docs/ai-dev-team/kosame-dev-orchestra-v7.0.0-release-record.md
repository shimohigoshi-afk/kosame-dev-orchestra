# KOSAME Dev Orchestra v7.0.0 Release Record

## Release Info

- **Version**: 7.0.0
- **Title**: Practical Dev Factory Runtime
- **Release Date**: 2026-05-28
- **Status**: RELEASED
- **Previous Version**: v6.5.0 Provider Prompt Router CLI

## Summary

v7.0.0 connects v6.0.0 Dev Factory MVP and v6.5.0 Provider Prompt Router CLI into a single Practical Dev Factory Runtime. A real small development task can now be dispatched end-to-end through intake → design → implementation → verify → release with proper provider routing, repair loops, and human approval gates.

## New Files

| File | Purpose |
|------|---------|
| `tools/practical-dev-factory-runtime-pack.js` | Core runtime tool (v7.0.0) |
| `smoke/dev-agent-practical-dev-factory-runtime-pack-smoke.js` | Smoke verification |
| `fixtures/practical-dev-factory-runtime.sample.json` | Sample output fixture |
| `docs/ai-dev-team/kosame-dev-orchestra-v7.0.0-release-record.md` | This file |
| `docs/ai-dev-team/practical-dev-factory-runtime-v7.0.0.md` | Design document |

## Changed Files

| File | Change |
|------|--------|
| `package.json` | version 6.5.0 → 7.0.0; added smoke and pm-agent scripts |

## New Scripts

- `smoke:practical-dev-factory-runtime-pack` — `node smoke/dev-agent-practical-dev-factory-runtime-pack-smoke.js`
- `pm-agent:practical-dev-factory-runtime` — `node tools/practical-dev-factory-runtime-pack.js`

## Runtime Input / Output

### Input
```
projectName, repoPath, taskGoal, productLine, taskType, riskLevel, dataLevel, preferredProvider, currentStatus
```

### Output
```
runtimeId, normalizedTask, realStatusSummary, workBreakdown, providerRoute,
executionPackets, verificationPlan, repairLoopPlan, humanApprovalPacket,
blockedDangerousActions, recommendedNextAction, dryRun, humanApprovalRequired
```

## Safety Gates (Mandatory)

- `dryRun: true` — always on
- `humanApprovalRequired: true` — always on
- Level C data → kosame/human only
- critical riskLevel → kosame/human only
- git push / git tag / deploy / secret → blocked in dangerous actions
- DeepSeek / Kimi → anonymized Level A only
- じゅんやさんは最終YESのみ。作業員に戻さない。

## Provider Routing

| taskType | provider |
|----------|---------|
| implementation | claude |
| repair | claude |
| draft / bulk / docs | gemini |
| strategy / breakthrough | grok |
| review / final / safety | kosame |
| release | kosame → human approval |
| Level C data | kosame or human |
| critical risk | kosame or human |

## Smoke Results

```
PASS: package version 7.0.0 or later
PASS: script exists
PASS: pm-agent script exists
PASS: release record exists
PASS: fixture exists
PASS: tool meta version 7.0.0
PASS: dryRun true
PASS: humanApprovalRequired true
PASS: runtimeId present
PASS: normalizedTask present
PASS: realStatusSummary present
PASS: workBreakdown has phases
PASS: providerRoute selectedProvider present
PASS: executionPackets includes prompt packets
PASS: verificationPlan has steps
PASS: repairLoopPlan present
PASS: humanApprovalPacket includes commit/push/tag gates
PASS: blockedDangerousActions includes git push / git tag / deploy / secret
PASS: implementation routes to claude
PASS: draft routes to gemini
PASS: strategy routes to grok
PASS: Level C routes to kosame/human
PASS: critical risk routes to kosame/human
PASS: product lines include sales_dx and anesty_board
PASS: recommendedNextAction present
PASS: secret/customer data blocked for external provider
PASS: anesty_board packet builds correctly
PASS: practical-dev-factory-runtime-pack
```

## Verify Result

- `npm run smoke:practical-dev-factory-runtime-pack` — PASS
- `npm run verify` — PASS (all prior smokes retained)

## Risks

- None introduced. All dangerous actions blocked. dryRun forced.
- ANESTY Board本体は変更なし。
- v6.0.0 Dev Factory MVP・v6.5.0 Provider Prompt Router CLI は破壊なし。
