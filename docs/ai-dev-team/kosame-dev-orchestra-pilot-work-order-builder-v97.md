# KOSAME Dev Orchestra Pilot Work Order Builder v97.0.0

## Purpose
Generate a pilot work order for Claude Code / GPT Agent / Gemini / Grok / Human.

## Work Order Structure
- **allowedFiles**: tools/**, smoke/**, fixtures/**, docs/**, package.json
- **forbiddenFiles**: .env, *.key, *.pem, secrets/**, customer_data/**, gmail_data/**
- **verificationCommands**: node --check, npm run verify
- **doneCriteria**: smoke test passes, dryRun: true confirmed, humanApprovalRequired: true confirmed
- **humanApprovalRequired**: true
- **dangerousActionsDenied**: real data, real send, deploy, secret read
- **irreversibleActionsRequireHumanGate**: deploy, git push/tag, real send, real billing, secret access

## Agent Roles
| Agent | Role |
|-------|------|
| ClaudeCode | implementation, file edits, smoke tests, verification |
| GPTAgent | planning, PM review, design decisions |
| Gemini | bulk reading, summarization, doc review |
| Grok | breakthrough review, weakness detection |
| **Human (Junya)** | **final YES only for irreversible actions** |

## Key Principle
Junya must not become a copy-paste worker. Human role = final YES only for irreversible actions.

## Tool
`tools/dev-agent-pilot-work-order-builder-pack.js`

## Version
97.0.0
