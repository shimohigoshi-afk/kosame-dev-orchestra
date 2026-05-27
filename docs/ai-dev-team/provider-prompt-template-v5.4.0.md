# Provider Prompt Template v5.4.0

## Overview

Each provider in KOSAME Dev Orchestra has a standardized prompt template that wraps task descriptions with role framing and safety suffixes.

## Template Structure

```
{prefix}

{taskDescription}

{suffix}
```

- **prefix**: Establishes the provider's role.
- **taskDescription**: Injected by the caller — must be pre-sanitized.
- **suffix**: Reiterates data boundary rules for the provider.

## Data Level Enforcement

`renderTemplate(provider, taskDescription, dataLevel)` rejects:
- Any data level not in the provider's `allowedDataLevels`.
- Task descriptions should be pre-screened for blocked keywords before rendering.

## Safety Invariants

- No template is rendered for an unknown provider.
- Level C data may only be rendered for kosame.
- Human approval is required before rendered prompts are dispatched externally.
