# KOSAME Dev Orchestra — Provider Health Check Pack v110.3.0

## Purpose

Dry-run local health assessment for each AI provider role. No live API calls.

## Provider Status Table

| Provider | Status | Role |
|---|---|---|
| claude_code | HEALTHY | implementation (context must be guarded) |
| gemini | HEALTHY | long_preprocessing / bulk work |
| gpt | DEGRADED | execution_assistant only — PM/court/judge blocked |
| grok | HEALTHY | breakthrough_alternative / stuck state |
| deepseek | HOLD | last_resort_advisory — sanitized handoff required |
| kimi | HOLD | last_resort_advisory — sanitized handoff required |
| human | HUMAN_GATE_ONLY | approval_owner for irreversible actions |

## Key Rules

- `claude_code` HEALTHY but must NOT receive full logs (`receive_full_logs` blocked)
- `gemini` is the recommended preprocessor for long inputs
- `gpt` execution assistant allowed; PM/court/judge role blocked
- `deepseek`/`kimi` require sanitized handoff and human approval before use
- `human` is approval owner, not copy-paste worker

## Tool

`tools/dev-agent-provider-health-check-pack.js`
