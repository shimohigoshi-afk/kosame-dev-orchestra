# Operator Gemini Next Work v1.1.4

## Purpose
- Standardize the task packets for Gemini agents in the next 25% phase.
- Ensure strict adherence to the "no-shell-execution" policy.

## Pack Components
- `phase`: The next version range (e.g., v1.2.1-v1.4.0).
- `scope`: Specific modules to create or edit.
- `prohibitedActions`: Explicit list of forbidden commands (git push, etc.).
- `verificationProtocol`: How the work will be verified (Cloud Shell by Human).
- `reportingFormat`: The required structure for the final report.

## Constraints
- Focus on file creation and editing only.
- No shell execution in the task instructions.
