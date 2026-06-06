'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-quality-control-complete-gate-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-quality-control-complete-gate-pack smoke ===');

// 1. package version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.3.0'), 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. default healthy route → QUALITY_READY or USE_DEFAULT_ROUTE
const r1 = tool.classifyQuality({ provider: 'claude_code', taskType: 'implementation' });
assert.ok(
  r1.gateDecision === tool.GATE_DECISIONS.QUALITY_READY ||
  r1.gateDecision === tool.GATE_DECISIONS.USE_DEFAULT_ROUTE,
  `expected QUALITY_READY or USE_DEFAULT_ROUTE, got ${r1.gateDecision}`
);
assert.strictEqual(r1.shouldProceedAutomatically, true);
assert.strictEqual(r1.shouldAskUser, false);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log(`  PASS: claude_code implementation → ${r1.gateDecision}`);

// 4. GPT PM/judge route downgraded → USE_FALLBACK_ROUTE
const r2 = tool.classifyQuality({ provider: 'gpt', taskType: 'pm_decision' });
assert.strictEqual(r2.gateDecision, tool.GATE_DECISIONS.USE_FALLBACK_ROUTE);
console.log('  PASS: GPT pm_decision → USE_FALLBACK_ROUTE');

// 5. GPT execution assistant allowed (log_summarization → not blocked)
const r3 = tool.classifyQuality({ provider: 'gpt', taskType: 'log_summarization' });
assert.ok(
  r3.gateDecision === tool.GATE_DECISIONS.QUALITY_READY ||
  r3.gateDecision === tool.GATE_DECISIONS.USE_DEFAULT_ROUTE,
  `expected QUALITY_READY or USE_DEFAULT_ROUTE for gpt log_summarization, got ${r3.gateDecision}`
);
console.log(`  PASS: GPT log_summarization (execution assistant) → ${r3.gateDecision}`);

// 6. DeepSeek without redaction → BLOCKED_PROVIDER_UNHEALTHY
const r4 = tool.classifyQuality({ provider: 'deepseek', taskType: 'implementation' });
assert.strictEqual(r4.gateDecision, tool.GATE_DECISIONS.BLOCKED_PROVIDER_UNHEALTHY);
assert.strictEqual(r4.humanApprovalRequired, true);
console.log('  PASS: deepseek implementation → BLOCKED_PROVIDER_UNHEALTHY');

// 7. redaction failed → BLOCKED_REDACTION_FAILED
const r5 = tool.classifyQuality({
  provider: 'gemini',
  taskType: 'implementation',
  redactionInput: {
    targetProvider: 'deepseek',
    content: 'api_key=sk-abc123',
    sanitized: false
  }
});
assert.strictEqual(r5.gateDecision, tool.GATE_DECISIONS.BLOCKED_REDACTION_FAILED);
assert.strictEqual(r5.humanApprovalRequired, true);
console.log('  PASS: redaction failed → BLOCKED_REDACTION_FAILED');

// 8. high burden → HUMAN_BURDEN_TOO_HIGH
const r6 = tool.classifyQuality({
  provider: 'claude_code',
  taskType: 'implementation',
  burdenInput: {
    preferenceQuestions: 10,
    repeatedConfirmations: 10,
    chatConsultations: 10,
    unnecessaryDetours: 5
  }
});
assert.strictEqual(r6.gateDecision, tool.GATE_DECISIONS.HUMAN_BURDEN_TOO_HIGH);
console.log('  PASS: high burden → HUMAN_BURDEN_TOO_HIGH');

// 9. danger gate → HUMAN_GATE_REQUIRED
const r7 = tool.classifyQuality({ provider: 'claude_code', taskType: 'implementation', dangerGateActive: true });
assert.strictEqual(r7.gateDecision, tool.GATE_DECISIONS.HUMAN_GATE_REQUIRED);
assert.strictEqual(r7.humanApprovalRequired, true);
assert.strictEqual(r7.shouldAskUser, true);
console.log('  PASS: danger gate → HUMAN_GATE_REQUIRED');

// 10. no danger gate → shouldAskUser:false for healthy route
assert.strictEqual(r1.shouldAskUser, false);
console.log('  PASS: no danger gate → shouldAskUser:false');

// 11. escalation needs approval → ESCALATION_NEEDS_APPROVAL
const r8 = tool.classifyQuality({
  provider: 'claude_code',
  taskType: 'implementation',
  escalationInput: {
    currentTier: 'cheap_default',
    issueType: 'repeated_code_repair',
    repeatFailCount: 3,
    budgetUsedPct: 10,
    budgetCapPct: 100
  }
});
assert.strictEqual(r8.gateDecision, tool.GATE_DECISIONS.ESCALATION_NEEDS_APPROVAL);
assert.strictEqual(r8.humanApprovalRequired, true);
console.log('  PASS: escalation repeated_code_repair → ESCALATION_NEEDS_APPROVAL');

// 12. dryRun / realProductActionsExecuted
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-quality-control-complete-gate-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-quality-control-complete-gate-pack');
