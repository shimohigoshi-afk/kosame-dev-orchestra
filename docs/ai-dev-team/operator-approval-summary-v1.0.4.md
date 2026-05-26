# Operator Approval Summary v1.0.4

## Purpose
- Minimize the cognitive load for Junya-san when making approval decisions.
- Provide all necessary context for a quick "yes/no/escalate" decision.

## Core Features
- Summarize pending changes.
- Highlight risk factors.
- Provide a clear recommendation.
- Offer actionable options (Approve, Hold, Send to Claude, Send to Gemini, Reject).

## Decision Options
- `approve`: Proceed with the action.
- `hold`: Pause and wait for more info.
- `send_to_claude`: Ask Claude for technical review or fix.
- `send_to_gemini`: Ask Gemini for clarification or revision.
- `reject`: Cancel the action.
