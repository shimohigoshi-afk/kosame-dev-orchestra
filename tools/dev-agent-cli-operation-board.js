'use strict';

const TOOL_META = {
  version: '110.4.0',
  title: 'CLI Agent Status Board',
  slug: 'dev-agent-cli-operation-board'
};

// ── Stage labels ────────────────────────────────────────────────────────────
const STAGES = {
  IMPLEMENTING: 'implementing',
  VERIFY:       'verify',
  GATE_WAIT:    'gate_wait',
  DONE:         'done'
};

// ── Gate states ─────────────────────────────────────────────────────────────
const GATE_STATES = {
  NONE:        'none',
  COMMIT_WAIT: 'commit_wait',
  PUSH_WAIT:   'push_wait',
  BLOCKED:     'blocked'
};

// ── Burden bands (mirrors human-burden-meter-pack) ──────────────────────────
const BURDEN_BANDS = { LOW: 'LOW', WATCH: 'WATCH', HIGH: 'HIGH', TOO_MUCH: 'TOO_MUCH' };

// ── Default agent status table ───────────────────────────────────────────────
const DEFAULT_AGENT_STATUS = {
  claude_code: 'healthy',
  gemini:      'healthy',
  gpt:         'execution_assistant_only',
  grok:        'breakthrough_standby',
  deepseek:    'HOLD sanitized_only',
  kimi:        'HOLD sanitized_only',
  human:       'approval_owner'
};

/**
 * Build the operation board data object.
 *
 * @param {object} input
 * @param {string}  input.target         Current product / task label.
 * @param {string}  input.stage          One of STAGES values.
 * @param {object}  input.agentStatus    Map of provider → status string.
 * @param {string}  input.gate           One of GATE_STATES values.
 * @param {number}  input.budgetUsed     Budget used in USD (or tokens, same unit).
 * @param {number}  input.budgetLimit    Budget limit.
 * @param {string}  input.next           Next recommended action.
 * @param {string}  input.burden         One of BURDEN_BANDS values.
 * @returns {object}
 */
function buildBoard(input) {
  const {
    target      = '(not set)',
    stage       = STAGES.IMPLEMENTING,
    agentStatus = {},
    gate        = GATE_STATES.NONE,
    budgetUsed  = 0,
    budgetLimit = 10,
    next        = '(not set)',
    burden      = BURDEN_BANDS.LOW
  } = input || {};

  const agents = Object.assign({}, DEFAULT_AGENT_STATUS, agentStatus);

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun:  true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired: gate !== GATE_STATES.NONE,
    target,
    stage,
    agents,
    gate,
    budget: {
      used:    budgetUsed,
      limit:   budgetLimit,
      display: `$${budgetUsed} / $${budgetLimit}`
    },
    next,
    burden
  };
}

/**
 * Render a board object as the display string shown in Cloud Shell.
 *
 * @param {object} board  Return value of buildBoard().
 * @returns {string}
 */
function renderBoard(board) {
  const pad = (label, value, width) => {
    const lbl = label.padEnd(width || 8);
    return `${lbl}: ${value}`;
  };

  const agentLines = Object.entries(board.agents)
    .map(([name, status]) => `  ${name.padEnd(12)}: ${status}`)
    .join('\n');

  return [
    '===== KOSAME Operation Board =====',
    pad('TARGET', board.target,  6),
    pad('STAGE',  board.stage,   6),
    'AGENTS :',
    agentLines,
    pad('GATE',   board.gate,    6),
    pad('BUDGET', board.budget.display, 6),
    pad('NEXT',   board.next,    6),
    pad('BURDEN', board.burden,  6),
    '=================================='
  ].join('\n');
}

function main() {
  const board = buildBoard({
    target:     'KOSAME Dev Orchestra v110.4.0 — CLI Operation Board',
    stage:      STAGES.IMPLEMENTING,
    gate:       GATE_STATES.NONE,
    budgetUsed: 0.12,
    budgetLimit: 10,
    next:       'run smoke tests → npm run verify',
    burden:     BURDEN_BANDS.LOW
  });
  console.log(renderBoard(board));
  console.log('');
  console.log(JSON.stringify(board, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  STAGES,
  GATE_STATES,
  BURDEN_BANDS,
  DEFAULT_AGENT_STATUS,
  buildBoard,
  renderBoard
};
