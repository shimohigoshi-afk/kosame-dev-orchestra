# Operator Dashboard Snapshot v1.1.1

## Purpose
- Aggregate all key operational metrics into a single, high-level view.
- Provide a data structure suitable for UI or API consumption.

## Components
- `version`: Current system version.
- `phase`: Current development phase.
- `verify`: Status of the last verification.
- `actions`: Status of the last GitHub Actions run.
- `approval`: Count and status of pending approvals.
- `agent`: Current active agent and their workload.
- `risk`: Overall project risk level.
- `nextAction`: Recommended next step.

## Security
- No Secret values or API keys are included in the snapshot.
