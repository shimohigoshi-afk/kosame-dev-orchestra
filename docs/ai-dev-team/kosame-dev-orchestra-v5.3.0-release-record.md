# KOSAME Dev Orchestra v5.3.0 Fallback Routing Decision Pack

## Purpose

This release formalizes fallback routing decisions when the primary provider is unavailable, ensuring tasks always reach a capable provider.

## Fallback Chains

| Primary  | Fallback Chain                  |
|----------|---------------------------------|
| claude   | grok → deepseek → kosame        |
| gemini   | grok → kimi → kosame            |
| grok     | claude → deepseek → kosame      |
| deepseek | claude → grok → kosame          |
| kimi     | gemini → grok → kosame          |
| kosame   | human                           |

## Fallback Policy

- Maximum fallback depth: 2
- All fallback decisions require human approval.
- Final fallback is always kosame (VP review).
- Blocked operations (Secret read, .env read, API key read) are never routed to any fallback.

## Release Value

v5.3.0 ensures that provider outages do not halt operations by providing a deterministic, safe fallback routing path for every provider.
