# KOSAME Dev Orchestra — Failure Snapshot + Gate-Supervised Autopilot Integrated Gate v110.2.0

## Purpose

Integrate Failure Snapshot Pack and Gate-Supervised Autopilot Pack into a single gate classifier.

## Gate Decisions

| Decision | Meaning |
|---|---|
| `AUTO_PROCEED` | Routine local action — proceed automatically |
| `NEEDS_HUMAN_APPROVAL` | Approval gate detected — wait for Junya |
| `SNAPSHOT_REQUIRED` | Provider failed — compact snapshot generated |
| `BLOCKED_DANGEROUS_ACTION` | Sensitive data or destructive operation — blocked |
| `BLOCKED_CONTEXT_OVERLOAD` | Context too large — use snapshot, `shouldReadFullLog:false` |
| `BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF` | DeepSeek/Kimi handoff without sanitized content — blocked |

## Decision Logic

1. If `contextOverloaded:true` or `failureType: context_too_large` → `BLOCKED_CONTEXT_OVERLOAD`
2. If `failureType` is a known provider/verification failure → `SNAPSHOT_REQUIRED`
3. If `targetProvider` is deepseek/kimi and `sanitized:false` → `BLOCKED_UNSANITIZED_EXTERNAL_HANDOFF`
4. If action contains sensitive data keyword → `BLOCKED_DANGEROUS_ACTION`
5. If action is in approval gate list → `NEEDS_HUMAN_APPROVAL`
6. If action is in normal list → `AUTO_PROCEED`
7. Otherwise → `NEEDS_HUMAN_APPROVAL` (unknown action defaults to safe)

## Verification Checklist

- [x] routine local implementation → `AUTO_PROCEED`
- [x] git commit/tag/push → `NEEDS_HUMAN_APPROVAL`
- [x] deploy → `NEEDS_HUMAN_APPROVAL`
- [x] secret/.env/customer/insurance/health data → `BLOCKED_DANGEROUS_ACTION` or `NEEDS_HUMAN_APPROVAL`
- [x] provider timeout → `SNAPSHOT_REQUIRED`
- [x] context too large → `BLOCKED_CONTEXT_OVERLOAD`, `shouldReadFullLog:false`
- [x] GPT conservative/detour role → constrained to execution assistant
- [x] Claude full-log load → discouraged, snapshot preferred
- [x] Gemini → recommended for preprocessing long inputs
- [x] DeepSeek/Kimi → requires sanitized handoff
- [x] `dryRun:true` always
- [x] `realProductActionsExecuted:false` always

## Tool

`tools/dev-agent-failure-snapshot-gate-autopilot-pack.js`  
`smoke/dev-agent-failure-snapshot-gate-autopilot-pack-smoke.js`  
`fixtures/dev-agent-failure-snapshot-gate-autopilot-pack.fixture.json`
