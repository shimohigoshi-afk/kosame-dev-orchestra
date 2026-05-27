# Provider Pool Policy v5.1.0

## Overview

This document defines the pool membership and concurrency policy for all providers in KOSAME Dev Orchestra.

## Pool Membership

| Tier       | Providers                          |
|------------|------------------------------------|
| primary    | kosame, claude, gemini             |
| secondary  | grok, deepseek, kimi               |
| execution  | cloudShell                         |
| approval   | human                              |

## Concurrency Rules

- `maxConcurrentExternal`: 2 — at most 2 external providers may receive tasks simultaneously.
- External providers: gemini, claude, grok, deepseek, kimi.
- Internal providers: kosame, cloudShell, human.
- Execution and approval tiers always require human approval before dispatch.

## Compliance Check

Before dispatching, run `evaluatePool(providers)` to verify the active provider list is compliant.
If `compliant` is false, reduce the active external provider set before proceeding.

## Safety Invariants

- Human approval is always required before any irreversible operation.
- Pool evaluation does not bypass data boundary or safety boundary checks.
