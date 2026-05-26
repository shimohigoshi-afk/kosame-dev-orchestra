# Operator State Reader Writer v1.0.2

## Purpose
- Provide a safe interface for reading and updating the operator state.
- Ensure state consistency and prevent accidental exposure of sensitive information.

## Key Functions
- `readState(filePath)`: Reads the state from a JSON file.
- `updateState(currentState, updates)`: Applies updates to the state in memory.
- `writeState(state, filePath)`: Writes the state to a JSON file (dry-run focus).

## Safe Update Fields
- `currentPhase`
- `nextAction`
- `workflowStatus`
- `activeAgent`
- `riskLevel`
- `lastCommit`
- `currentVersion`

## Constraints
- Never save Secret values or API keys in the state file.
- `writeState` should ideally output to a temporary or preview file before overwriting the main state file (Human Approval Gate).
