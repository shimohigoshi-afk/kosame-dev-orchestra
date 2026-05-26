# Operator Handoff CLI v1.0.5

## Purpose
- Automate the creation of handoff documentation from the current operator state.
- Ensure consistent communication during agent/operator transitions.

## Features
- Reads current state from `fixtures/operator-state.sample.json`.
- Uses `fixtures/operator-handoff.sample.md` as a template or reference.
- Generates a markdown report including:
  - currentVersion
  - lastCommit
  - completedWork
  - pendingWork
  - risk
  - nextAction
  - approvalGate

## Constraints
- Always include a risk assessment (e.g., "Risk: High").
- Focus on actionable data for the next operator.
