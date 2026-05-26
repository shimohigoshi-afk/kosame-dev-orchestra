# GitHub Actions Recorder CLI v1.0.7

## Purpose
- Manually record and classify GitHub Actions workflow results.
- Determine the next step based on the workflow status.

## Features
- Record statuses: `success`, `running`, `failed`, `cancelled`.
- Categorize the failure if applicable.
- Suggest next steps (e.g., Release, Wait, Repair, Re-run).

## Workflow
1. Operator checks `gh run list` or GitHub UI.
2. Result is recorded using this tool.
3. System suggests the next operational step.
