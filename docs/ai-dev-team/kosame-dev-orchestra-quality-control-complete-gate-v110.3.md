# KOSAME Dev Orchestra — Quality Control Complete Gate Pack v110.3.0

## Purpose

Integrate all five v110.3 packs and classify the current operation into a single gate decision.

## Gate Decisions

| Decision | Meaning |
|---|---|
| `QUALITY_READY` | Default healthy route — proceed automatically |
| `USE_DEFAULT_ROUTE` | Operational — proceed with default provider |
| `USE_FALLBACK_ROUTE` | Primary route degraded — use fallback |
| `ESCALATION_NEEDS_APPROVAL` | Tier escalation needs human YES |
| `BLOCKED_REDACTION_FAILED` | Sensitive data detected — blocked |
| `BLOCKED_PROVIDER_UNHEALTHY` | Provider unavailable or on HOLD |
| `HUMAN_BURDEN_TOO_HIGH` | Too many asks — auto-compress or reset |
| `HUMAN_GATE_REQUIRED` | Danger gate active — one YES/NO needed |

## Decision Priority

1. `dangerGateActive` → HUMAN_GATE_REQUIRED
2. Provider UNAVAILABLE → BLOCKED_PROVIDER_UNHEALTHY
3. Redaction failed → BLOCKED_REDACTION_FAILED
4. Burden TOO_MUCH → HUMAN_BURDEN_TOO_HIGH
5. Escalation allowed + humanApprovalRequired → ESCALATION_NEEDS_APPROVAL
6. Provider HOLD → BLOCKED_PROVIDER_UNHEALTHY
7. GPT PM/judge taskType → USE_FALLBACK_ROUTE
8. Reliability AVOID → USE_FALLBACK_ROUTE
9. Health HEALTHY + Reliability STRONG → QUALITY_READY
10. Otherwise → USE_DEFAULT_ROUTE

## Integrated Packs

- Provider Health Check (pack 6)
- Model Escalation Ladder (pack 7)
- Redaction Test (pack 8)
- Agent Reliability Score (pack 9)
- Human Burden Meter (pack 10)

## Tool

`tools/dev-agent-quality-control-complete-gate-pack.js`
