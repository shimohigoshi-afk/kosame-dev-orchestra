# KOSAME Dev Orchestra v8.0.0 Release Record

## Release: v8.0.0 Full Orchestra Planning Layer

**Date:** 2026-05-30
**Status:** Released

## Summary

GPT/こさめ・Gemini・Claude・Grokのフルオーケストラに対応するPlanning Layerを実装。
v7.5.0 Practical Dev Factory Loopの前段として、各AIの役割・入力・成果物・担当範囲・安全境界をplanning packetとして生成する。

## New Files

- `tools/full-orchestra-planning-layer-pack.js` — v8.0.0 Full Orchestra Planning Layer
- `smoke/dev-agent-full-orchestra-planning-layer-pack-smoke.js` — smoke test
- `fixtures/full-orchestra-planning-layer.sample.json` — fixture
- `docs/ai-dev-team/kosame-dev-orchestra-v8.0.0-release-record.md` — this record
- `docs/ai-dev-team/full-orchestra-planning-layer-v8.0.0.md` — feature doc

## Agent Roles

| Agent | Role |
|-------|------|
| kosame/GPT | PM・統合・安全ゲート・最終判断・採否判定 |
| Gemini | 仕様整理・docs・fixture・assert・候補出し |
| Claude | 実装・修正・verify・差分整理 |
| Grok | 弱点指摘・突破案・堂々巡り防止 |
| Human/じゅんやさん | commit/push/tag/deploy/Secret/課金/本番影響の最終YES |

## Outputs

- planningId
- normalizedGoal
- agentRoles
- workLanes
- safetyBoundary
- approvalGates
- blockedDangerousActions
- recommendedNextAction
- dryRun: true
- humanApprovalRequired: true

## Safety

- Level C data: Gemini/Grok/Claude blocked, kosame internal only
- repoを触るのはClaudeのみ
- じゅんやさんは最終YESのみ。作業員に戻さない。
