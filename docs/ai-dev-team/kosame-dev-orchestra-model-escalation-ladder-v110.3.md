# KOSAME Dev Orchestra — Model Escalation Ladder Pack v110.3.0

## Purpose

Define when to move from cheap/default models to stronger/more expensive models.

## Tiers

`cheap_default` → `standard` → `higher_tier` → `premium_last_resort`

## Escalation Rules

| Issue | Action |
|---|---|
| Routine work | Stay on `cheap_default` — no escalation |
| `context_too_large` | Use failure snapshot / split input / Gemini preprocessing FIRST |
| `provider_timeout` | Try fallback provider FIRST — do not escalate tier |
| `repeated_code_repair` (≥2 failures) | Allow higher tier with human approval |
| Budget over cap | Block escalation entirely |
| Budget near cap (≥85%) | Escalation requires human approval |
| `ambiguous_output` | Try different provider before escalating tier |

## Key Rules

- Default to cheap capable models
- Do not escalate silently — always record reason
- Expensive escalation requires human approval
- Never escalate for routine local implementation

## Integration

Conceptually integrates with Budget Governor (v110.1).

## Tool

`tools/dev-agent-model-escalation-ladder-pack.js`
