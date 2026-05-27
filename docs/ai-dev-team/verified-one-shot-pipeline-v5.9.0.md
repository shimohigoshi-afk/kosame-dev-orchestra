# Verified One-shot Pipeline v5.9.0

## Overview

The Verified One-shot Pipeline provides a structured execution path for single AI tasks, with mandatory safety checks and human approval gates.

## Stage Definitions

| Stage           | Status on Start         | Human Approval Required |
|-----------------|-------------------------|-------------------------|
| intake          | ok                      | No                      |
| safety_check    | ok / failed             | No (aborts if failed)   |
| provider_select | ok                      | No                      |
| dispatch        | pending_human_approval  | Yes                     |
| verify          | pending                 | No                      |
| report          | pending_human_approval  | Yes                     |

## Safety Check Details

`runSafetyCheck(task)` blocks if:
- `task.dataLevel` is C and `task.provider` is not kosame/human.
- `task.description` contains any of: `.env`, `API key`, `Secret`, `customer data`.

## Verification

`runVerification(output)` requires:
- Output is a non-null object.
- Output contains a `result` field.

## Safety Invariants

- `abortOnSafetyFailure`: true — no stage runs after a failed safety check.
- `verificationRequired`: true — dispatch output must be verified before report.
- `dryRunDefault`: true — never dispatches live without explicit override.
- Human approval gates at dispatch and report stages cannot be bypassed.
