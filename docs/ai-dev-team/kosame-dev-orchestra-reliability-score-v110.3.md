# KOSAME Dev Orchestra — Agent Reliability Score Pack v110.3.0

## Purpose

Score each agent/provider's reliability for a given task type.

## Score Bands

`STRONG` (≥75) → `OK` (55–74) → `LIMITED` (35–54) → `AVOID` (<35) → `HUMAN_GATE` (human only)

## Provider Baselines

| Provider | Task | Baseline |
|---|---|---|
| claude_code | implementation | 85 |
| gemini | long_preprocessing | 90 |
| gpt | log_summarization | 80 |
| gpt | pm_decision | 15 |
| grok | breakthrough | 78 |
| deepseek | implementation | 20 |
| kimi | implementation | 20 |
| human | irreversible_approval | 100 |

## Penalties

| Factor | Penalty |
|---|---|
| recent_failure | -8 per failure (max 3) |
| verify_failed | -12 |
| smoke_failed | -10 |
| detour_detected | -20 |
| conservative_brake | -18 |
| context_overload | -15 |
| cost_risk_high | -10 |
| data_risk_high | -25 |
| unsafe_external_handoff | -30 |

## Key Rules

- GPT PM/judge → AVOID regardless of penalties
- DeepSeek/Kimi non-advisory → AVOID
- Human irreversible → HUMAN_GATE

## Tool

`tools/dev-agent-reliability-score-pack.js`
