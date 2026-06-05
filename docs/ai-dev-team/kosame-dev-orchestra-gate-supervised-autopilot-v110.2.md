# KOSAME Dev Orchestra — Gate-Supervised Autopilot Pack v110.2.0

## Design Principle

This is NOT "Chat-Supervised Autopilot."

**Gate-Supervised Autopilot** means:

- Normal work proceeds without asking Junya.
- AI does not ask "which option do you want?"
- AI does not ask for routine implementation approval.
- AI only stops at approval gates.

## Autopilot Mode

`GATE_SUPERVISED`

## Normal Actions (auto-proceed, no human needed)

- create local tool files
- create smoke tests
- create fixtures
- create docs
- update package scripts
- update verify script
- run node --check
- run smoke tests
- run npm run verify
- inspect git status
- prepare commit candidate report
- generate next command suggestions

## Approval Gate Actions (must stop and ask)

- git add / commit / tag / push
- deploy
- docker build
- gcloud commands
- npm publish
- read secrets / edit .env
- access customer / insurance / health data
- send email / Discord / SNS / live external messages
- billing / contract / payment actions
- expensive model escalation
- destructive operations

## Gate Behavior

If no approval gate detected:
- `shouldProceedAutomatically: true`
- `shouldAskUser: false`

If approval gate detected:
- `shouldProceedAutomatically: false`
- `shouldAskUser: true`
- `humanApprovalRequired: true`
- `approvalMessage` — one short sentence only

## GPT Constraint Policy

**GPT may** (execution assistant only):
- summarize logs
- format commands
- clean Claude prompts
- explain errors
- classify small text
- prepare handoff snippets

**GPT must not**:
- decide task order
- change the agreed sequence
- move from v110.2 to another task
- suggest ANESTY Board work
- say "too early" or "let's reconsider" without a dangerous gate
- act as PM / court / judge

## Claude Load Policy

- Claude must NOT receive full long logs by default.
- Claude receives Failure Snapshot or summarized context.
- Use Gemini for long reading and preprocessing.
- Use Grok for breakthrough or stuck-state alternatives.
- Use DeepSeek/Kimi only as sanitized last-resort advisory.

## Gemini Preprocess Policy

- Use Gemini for all long inputs before Claude receives them.
- Purpose: reduce Claude context load and cost.

## Tool

`tools/dev-agent-gate-supervised-autopilot-pack.js`  
`smoke/dev-agent-gate-supervised-autopilot-pack-smoke.js`  
`fixtures/dev-agent-gate-supervised-autopilot-pack.fixture.json`
