# Operator Next Action Engine v1.0.3

## Purpose
- Automatically determine the next best step for the operator based on the current state.
- Reduce cognitive load for the human operator (Junya-san).

## Engine Logic
The engine evaluates the state and returns a recommended action.

### Decision Matrix (Simplified)
- If `workflowStatus` is `Verifying` and results are `failed`: Suggest `send_to_claude`.
- If `workflowStatus` is `Idle` and changes are pending: Suggest `run_verify`.
- If `workflowStatus` is `Passed` and not committed: Suggest `commit_candidate`.
- If `riskLevel` is `High` or `Critical`: Suggest `human_approval_required`.

## Outputs
- `nextAction`: A descriptive string of the suggested task.
- `reasoning`: A brief explanation of why this action was suggested.
- `requiredTool`: The tool suggested to execute this action.
