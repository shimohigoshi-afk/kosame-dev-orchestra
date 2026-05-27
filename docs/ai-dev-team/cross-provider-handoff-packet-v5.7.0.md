# Cross-Provider Handoff Packet v5.7.0

## Overview

A handoff packet is the structured record passed from one provider to the next when delegating or continuing a task.

## Packet Schema

| Field           | Required | Description                              |
|-----------------|----------|------------------------------------------|
| fromProvider    | Yes      | Provider sending the handoff             |
| toProvider      | Yes      | Provider receiving the handoff           |
| taskSummary     | Yes      | Plain-text summary of the task           |
| dataLevel       | Yes      | A / B / C                                |
| completedSteps  | Yes      | List of steps already finished           |
| remainingSteps  | Yes      | List of steps still to be done           |
| handoffAt       | Auto     | ISO timestamp set at creation            |
| humanApprovalRequired | Auto | Always true                          |

## Validation

`validateHandoff(packet)` checks:
1. All required fields are present.
2. Level C data is not being sent to an external provider.
3. `taskSummary` does not contain blocked keywords for external providers.

## Blocked Keywords (for external providers)

.env, API key, Secret, customer data, insurance policy, health check, personal name

## Safety Invariants

- Invalid packets are rejected before dispatch — they are never silently degraded.
- Human approval is required for all cross-provider handoffs.
