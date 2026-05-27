# Provider Prompt Router CLI v6.5.0

## Overview

The Provider Prompt Router CLI generates a complete routing decision and prompt packet from structured task parameters.

## Provider Capabilities

| Provider  | Task Types                              | Max Data Level | Tier     |
|-----------|-----------------------------------------|----------------|----------|
| claude    | implementation, bugfix, refactor, review| B              | primary  |
| gemini    | draft, document, bulk, expand, summarize| A              | primary  |
| grok      | strategy, breakthrough, alternative     | A              | secondary|
| deepseek  | code_proposal, fallback_code           | A              | fallback |
| kimi      | long_context, handoff_summary          | A              | fallback |
| kosame    | decision, pm, routing, level_c         | C              | internal |
| human     | approval, irreversible                 | C              | approval |

## Routing Logic

1. If `dataLevel === 'C'` → kosame (internal only)
2. If `riskLevel === 'critical'` → kosame (review required)
3. If `preferredProvider` is set and matches task type and safety → use preferred
4. Match `taskType` against capability lists:
   - implementation/bugfix/refactor/review → claude (if dataLevel ≤ B)
   - draft/document/bulk/summarize/expand → gemini
   - strategy/breakthrough/stuck → grok
   - long_context/handoff_summary → kimi
5. Default → kosame triage

## Safety Boundary Check

`checkSafetyBoundary(goal, dataLevel, provider)` blocks if:
- `dataLevel` exceeds the provider's `maxDataLevel`
- `goal` contains blocked keywords for non-internal providers

## Blocked Keywords

.env, API key, Secret, customer data, insurance policy, health check, personal name, private contract

## Blocked Actions (always require Human Approval)

git commit, git push, git tag, deploy, docker build, gcloud run deploy, rm -rf, git reset --hard, git clean, Secret/API key/customer data/insurance/health check/personal name sharing

## Prompt Packet

Each provider has a role-framed prompt template. The `goal` is injected into the template. The prompt is never dispatched automatically — it requires human approval.

## Safety Invariants

- `dryRun: true` — no live dispatch
- `humanApprovalRequired: true` — always
- Level C and critical risk always route to kosame
- DeepSeek and Kimi accept Level A only
- じゅんやさんは最終YESのみ — 作業員に戻さない
- このシステムはv6.5.0で完成 — v7.0.0には進まない
