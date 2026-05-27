# Fallback Routing Decision v5.3.0

## Overview

This document defines how KOSAME Dev Orchestra selects an alternative provider when the primary provider is unavailable.

## Fallback Chain Definitions

Each provider has a predefined fallback chain. The system tries each candidate in order until it finds one that is not `down`.

```
claude   → grok → deepseek → kosame
gemini   → grok → kimi     → kosame
grok     → claude → deepseek → kosame
deepseek → claude → grok   → kosame
kimi     → gemini → grok   → kosame
kosame   → human
```

## Decision Algorithm

1. Check if the primary provider is `up`. If yes, route to primary (depth 0).
2. If primary is `down`, iterate through the fallback chain.
3. The first candidate that is not `down` is selected (depth 1 or 2).
4. If all candidates are `down`, route to `kosame` as final fallback.
5. If depth reaches `maxFallbackDepth` (2), force final fallback to `kosame`.

## Policy Constraints

- `maxFallbackDepth`: 2 — prevents infinite fallback loops.
- `alwaysHumanApprovalRequired`: true — human approval is required at every fallback level.
- `finalFallback`: kosame — こさめ副社長 reviews any unresolvable routing situation.
- Blocked operations are never passed through fallback chains.

## Safety Invariants

- Fallback routing does not bypass data boundary or safety boundary checks.
- Human approval is required before any external provider receives a task, regardless of fallback depth.
- こさめ副社長 has final authority on all routing decisions.
