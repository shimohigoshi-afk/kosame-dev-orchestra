# KOSAME Dev Orchestra — CLI Agent Status Board v110.4.0

## Purpose

Show the current development state as a compact "cockpit" display in Cloud Shell.
Junya can see all agent states, the active gate, budget, next action, and burden band at a glance — without opening a chat or waiting for a summary.

## Display Format

```
===== KOSAME Operation Board =====
TARGET: [current product / task]
STAGE : [implementing / verify / gate_wait / done]
AGENTS :
  claude_code : healthy
  gemini      : healthy
  gpt         : execution_assistant_only
  grok        : breakthrough_standby
  deepseek    : HOLD sanitized_only
  kimi        : HOLD sanitized_only
  human       : approval_owner
GATE  : [none / commit_wait / push_wait / blocked]
BUDGET: [$used / $limit]
NEXT  : [next action]
BURDEN: [LOW / WATCH / HIGH / TOO_MUCH]
==================================
```

## Stages

| Stage | Meaning |
|---|---|
| `implementing` | Local tool / smoke / fixture / doc work in progress |
| `verify` | Running `npm run verify` or smoke tests |
| `gate_wait` | Waiting for human YES on commit / push / deploy |
| `done` | Current task complete, ready for next |

## Gate States

| Gate | Meaning | humanApprovalRequired |
|---|---|---|
| `none` | No gate active | false |
| `commit_wait` | Waiting for `git commit` approval | true |
| `push_wait` | Waiting for `git push` approval | true |
| `blocked` | Dangerous action or redaction failure | true |

## Agent Default Status

| Agent | Default Status |
|---|---|
| claude_code | healthy |
| gemini | healthy |
| gpt | execution_assistant_only |
| grok | breakthrough_standby |
| deepseek | HOLD sanitized_only |
| kimi | HOLD sanitized_only |
| human | approval_owner |

## API

```javascript
const { buildBoard, renderBoard } = require('./tools/dev-agent-cli-operation-board');

// Build data object
const board = buildBoard({
  target:     'v110.4.0 CLI Board',
  stage:      'implementing',
  gate:       'none',
  budgetUsed:  0.12,
  budgetLimit: 10,
  next:       'run smoke → verify',
  burden:     'LOW'
});

// Render as text
console.log(renderBoard(board));
```

## Integration with v110.1–v110.3

- Gate states correspond to `GATE_SUPERVISED` autopilot approval gates (v110.2).
- Agent status reflects Provider Health Check outputs (v110.3).
- Burden band comes from Human Burden Meter (v110.3).
- Budget display aligns with Budget Governor (v110.1).

## Tool

`tools/dev-agent-cli-operation-board.js`
`smoke/dev-agent-cli-operation-board-smoke.js`
`fixtures/dev-agent-cli-operation-board.fixture.json`
