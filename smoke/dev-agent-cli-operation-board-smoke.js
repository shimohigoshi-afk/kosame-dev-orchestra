'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-cli-operation-board.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-cli-operation-board smoke ===');

// 1. package version (numeric semver compare: major.minor.patch)
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.4.0'), 'package version must be 110.4.0 or later');
console.log('  PASS: package version >= 110.4.0');

// 2. script exists
assert.ok(pkg.scripts['smoke:v110-op-board'], 'smoke:v110-op-board script must exist');
console.log('  PASS: smoke:v110-op-board script exists');

// 3. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.4.0');
console.log('  PASS: tool meta version is 110.4.0');

// 4. fixture file exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-cli-operation-board.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// ── buildBoard defaults ──────────────────────────────────────────────────────
const board = tool.buildBoard({});

// 5. dryRun:true
assert.strictEqual(board.dryRun, true);
console.log('  PASS: dryRun is true');

// 6. realProductActionsExecuted:false
assert.strictEqual(board.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted is false');

// 7. dangerousActionsDenied:true
assert.strictEqual(board.dangerousActionsDenied, true);
console.log('  PASS: dangerousActionsDenied is true');

// 8. default stage is implementing
assert.strictEqual(board.stage, tool.STAGES.IMPLEMENTING);
console.log('  PASS: default stage is implementing');

// 9. default gate is none — humanApprovalRequired false
assert.strictEqual(board.gate, tool.GATE_STATES.NONE);
assert.strictEqual(board.humanApprovalRequired, false);
console.log('  PASS: gate=none → humanApprovalRequired:false');

// 10. commit_wait gate sets humanApprovalRequired:true
const gateBoard = tool.buildBoard({ gate: tool.GATE_STATES.COMMIT_WAIT });
assert.strictEqual(gateBoard.humanApprovalRequired, true);
console.log('  PASS: commit_wait → humanApprovalRequired:true');

// 11. push_wait gate sets humanApprovalRequired:true
const pushBoard = tool.buildBoard({ gate: tool.GATE_STATES.PUSH_WAIT });
assert.strictEqual(pushBoard.humanApprovalRequired, true);
console.log('  PASS: push_wait → humanApprovalRequired:true');

// 12. blocked gate sets humanApprovalRequired:true
const blockedBoard = tool.buildBoard({ gate: tool.GATE_STATES.BLOCKED });
assert.strictEqual(blockedBoard.humanApprovalRequired, true);
console.log('  PASS: blocked → humanApprovalRequired:true');

// 13. GPT shown as execution_assistant_only
assert.strictEqual(board.agents.gpt, 'execution_assistant_only');
console.log('  PASS: gpt is execution_assistant_only');

// 14. deepseek shown as HOLD sanitized_only
assert.strictEqual(board.agents.deepseek, 'HOLD sanitized_only');
console.log('  PASS: deepseek is HOLD sanitized_only');

// 15. kimi shown as HOLD sanitized_only
assert.strictEqual(board.agents.kimi, 'HOLD sanitized_only');
console.log('  PASS: kimi is HOLD sanitized_only');

// 16. grok shown as breakthrough_standby
assert.strictEqual(board.agents.grok, 'breakthrough_standby');
console.log('  PASS: grok is breakthrough_standby');

// 17. claude_code shown as healthy by default
assert.strictEqual(board.agents.claude_code, 'healthy');
console.log('  PASS: claude_code is healthy by default');

// 18. gemini shown as healthy by default
assert.strictEqual(board.agents.gemini, 'healthy');
console.log('  PASS: gemini is healthy by default');

// 19. human shown as approval_owner
assert.strictEqual(board.agents.human, 'approval_owner');
console.log('  PASS: human is approval_owner');

// 20. budget display includes used and limit
const budgetBoard = tool.buildBoard({ budgetUsed: 1.23, budgetLimit: 10 });
assert.strictEqual(budgetBoard.budget.display, '$1.23 / $10');
assert.strictEqual(budgetBoard.budget.used, 1.23);
assert.strictEqual(budgetBoard.budget.limit, 10);
console.log('  PASS: budget.display format correct');

// 21. target is preserved
const targeted = tool.buildBoard({ target: 'v110.4.0 CLI Board' });
assert.strictEqual(targeted.target, 'v110.4.0 CLI Board');
console.log('  PASS: target field preserved');

// 22. next is preserved
const nexted = tool.buildBoard({ next: 'run npm run verify' });
assert.strictEqual(nexted.next, 'run npm run verify');
console.log('  PASS: next field preserved');

// 23. burden LOW / WATCH / HIGH / TOO_MUCH accepted
for (const band of ['LOW', 'WATCH', 'HIGH', 'TOO_MUCH']) {
  const b = tool.buildBoard({ burden: band });
  assert.strictEqual(b.burden, band);
}
console.log('  PASS: all four burden bands accepted');

// 24. agentStatus override merges with defaults
const overridden = tool.buildBoard({ agentStatus: { gemini: 'degraded' } });
assert.strictEqual(overridden.agents.gemini, 'degraded');
assert.strictEqual(overridden.agents.claude_code, 'healthy');
console.log('  PASS: agentStatus override merges correctly');

// ── renderBoard ──────────────────────────────────────────────────────────────
const rendered = tool.renderBoard(board);

// 25. rendered output contains header
assert.ok(rendered.includes('===== KOSAME Operation Board ====='));
console.log('  PASS: rendered board has header');

// 26. rendered output contains footer
assert.ok(rendered.includes('=================================='));
console.log('  PASS: rendered board has footer');

// 27. rendered output contains TARGET
assert.ok(rendered.includes('TARGET'));
console.log('  PASS: rendered board has TARGET');

// 28. rendered output contains STAGE
assert.ok(rendered.includes('STAGE'));
console.log('  PASS: rendered board has STAGE');

// 29. rendered output contains AGENTS
assert.ok(rendered.includes('AGENTS'));
console.log('  PASS: rendered board has AGENTS');

// 30. rendered output contains GATE
assert.ok(rendered.includes('GATE'));
console.log('  PASS: rendered board has GATE');

// 31. rendered output contains BUDGET
assert.ok(rendered.includes('BUDGET'));
console.log('  PASS: rendered board has BUDGET');

// 32. rendered output contains NEXT
assert.ok(rendered.includes('NEXT'));
console.log('  PASS: rendered board has NEXT');

// 33. rendered output contains BURDEN
assert.ok(rendered.includes('BURDEN'));
console.log('  PASS: rendered board has BURDEN');

// 34. rendered output contains execution_assistant_only for gpt
assert.ok(rendered.includes('execution_assistant_only'));
console.log('  PASS: rendered board shows gpt as execution_assistant_only');

// 35. rendered output contains HOLD for deepseek
assert.ok(rendered.includes('HOLD sanitized_only'));
console.log('  PASS: rendered board shows HOLD sanitized_only');

// 36. all stages accepted without throwing
for (const stage of Object.values(tool.STAGES)) {
  const sb = tool.buildBoard({ stage });
  assert.strictEqual(sb.stage, stage);
}
console.log('  PASS: all STAGES values accepted');

// 37. all gate states accepted without throwing
for (const gate of Object.values(tool.GATE_STATES)) {
  assert.doesNotThrow(() => tool.buildBoard({ gate }));
}
console.log('  PASS: all GATE_STATES values accepted');

console.log('PASS: dev-agent-cli-operation-board');
