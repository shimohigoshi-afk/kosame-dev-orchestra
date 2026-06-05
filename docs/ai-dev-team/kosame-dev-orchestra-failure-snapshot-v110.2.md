# KOSAME Dev Orchestra — Failure Snapshot Pack v110.2.0

## Purpose

When any provider (Claude Code, Gemini, GPT, Grok, or other) stops, times out, fails, or produces unusable output, generate a compact handoff snapshot for the next agent.

The snapshot is short and structured. It prevents the next agent from needing the entire chat log, entire log file, or entire design document.

## Failure Types

| Type | Description |
|---|---|
| `provider_timeout` | Provider did not respond within the allowed window |
| `provider_unavailable` | Provider is down or not reachable |
| `context_too_large` | Input exceeded context limit |
| `verification_failed` | `npm run verify` or node --check failed |
| `smoke_failed` | Smoke test assertion failed |
| `ambiguous_output` | Provider output was unclear or contradictory |
| `budget_gate` | Cost escalation gate triggered |
| `human_gate` | Human approval required but not yet provided |
| `unknown` | Unclassified failure |

## Snapshot Fields

- `snapshotVersion` — always `110.2.0`
- `dryRun` — always `true`
- `realProductActionsExecuted` — always `false`
- `currentRepo` / `currentVersion` / `currentTask` / `taskObjective`
- `lastSuccessfulStep` — last known good step
- `failedStep` — step where failure occurred
- `failureType` — one of the types above
- `failureSummary` — short human-readable description
- `touchedFiles` / `changedFiles` — file state at failure time
- `verificationStatus` — pass / fail / partial / unknown
- `commandsRun` — commands executed before failure
- `nextRecommendedAction` — what to do next
- `blockedActions` — actions that must not proceed without approval
- `humanApprovalRequired` — true when gate is irreversible or dangerous
- `dangerousActionsDenied` — explicit list of denied operations
- `handoffTargetSuggestion` — which agent/route to use next
- `shouldReadFullLog` — always `false`
- `maxContextPolicy` — always `use_failure_snapshot_only`

## Handoff Target Logic

| Situation | Suggestion |
|---|---|
| Gemini failed on long text | GPT/Grok summary route or split input |
| Claude failed during implementation | Retry Claude with narrow scope |
| GPT produced conservative/detour output | Restrict GPT to execution assistant only |
| All primary providers failed | Sanitized DeepSeek/Kimi advisory route only |
| Dangerous action involved | Human approval required |

## Denied Operations (always)

`secret`, `.env`, `api_key`, `customer_data`, `insurance_data`, `health_data`, `deploy`, `git_push`, `git_tag`, `git_commit`, `destructive`, `live_external_send`

## Tool

`tools/dev-agent-failure-snapshot-pack.js`  
`smoke/dev-agent-failure-snapshot-pack-smoke.js`  
`fixtures/dev-agent-failure-snapshot-pack.fixture.json`
