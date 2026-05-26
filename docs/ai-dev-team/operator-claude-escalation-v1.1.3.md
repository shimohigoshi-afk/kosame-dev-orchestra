# Operator Claude Escalation v1.1.3

## Purpose
- Provide a standardized, high-context request for Claude technical support.
- Ensure Claude has all the information needed to fix a verification failure without side effects.

## Escalation Components
- `failedSmoke`: Which tests exactly failed.
- `errorLog`: The error message or log.
- `safeFiles`: Files Claude is encouraged to edit.
- `protectedFiles`: Files Claude MUST NOT modify.
- `verificationCommand`: The command Claude should use to verify the fix.
- `emotionalHandoff`: A polite and encouraging transition message.

## Workflow
1. Gemini (or Human) detects a failure.
2. This tool is used to package the failure context.
3. The resulting packet is sent to Claude.
