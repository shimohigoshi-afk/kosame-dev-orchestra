# Verify Result Recorder CLI v1.0.6

## Purpose
- Provide a standardized way to record the outcome of `npm run verify`.
- Enable the system to react to verification passes or failures.

## Features
- Record status: `pass`, `fail`, `error`.
- Capture `failedSmoke` tests.
- Provide `errorSummary`.
- Suggest `nextRepairOwner` (e.g., Gemini, Claude, Human).
- Determine if `commitAllowed`.

## Workflow
1. Human or Agent runs `npm run verify` (externally).
2. Result is piped or manually entered into this tool.
3. Tool generates a record and suggests the next action.
