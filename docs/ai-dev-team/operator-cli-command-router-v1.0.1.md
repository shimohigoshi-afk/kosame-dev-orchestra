# Operator CLI Command Router v1.0.1

## Purpose
- Centralize the entry point for the Operator CLI.
- Route commands to their respective logic packs.
- Ensure safe execution by only allowing pre-defined commands.

## Architecture
- `operator-cli-command-router.js` acts as the dispatcher.
- It parses CLI arguments and calls the corresponding tool module.
- It provides a safe help message for unknown commands.

## Command Definitions
- `status`: Show current system/operator status (delegates to `operator-cli-status.js`).
- `next`: Determine the next action (delegates to `operator-next-action-engine.js`).
- `approval`: Manage approval gates (delegates to `operator-approval-summary.js`).
- `handoff`: Generate handoff markdown (delegates to `operator-handoff-cli.js`).
- `verify-record`: Record verification results (delegates to `verify-result-recorder-cli.js`).
- `actions-record`: Record GitHub Actions results (delegates to `github-actions-recorder-cli.js`).
- `dashboard`: Show dashboard summary (delegates to `operator-local-console-cli.js`).

## Constraints
- No direct shell execution.
- No direct secret access.
- Dry-run only by default.
