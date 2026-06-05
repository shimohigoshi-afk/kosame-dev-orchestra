'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-ai-fallback-sanitized-budget-gate-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-ai-fallback-sanitized-budget-gate-pack smoke ===');

// version
assert.ok(pkg.version >= '110.1.0', 'package version must be 110.1.0 or later');
console.log('  PASS: package version');

// script exists
assert.ok(pkg.scripts['smoke:ai-fallback-sanitized-budget-gate-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-ai-fallback-sanitized-budget-gate-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// TOOL_META
assert.strictEqual(tool.TOOL_META.version, '110.1.0');
console.log('  PASS: tool meta version');

// GATE_STATUSES contains all required states
const requiredStatuses = [
  'READY', 'NEEDS_HUMAN_APPROVAL', 'BLOCKED_UNSANITIZED_HANDOFF',
  'BLOCKED_BUDGET', 'BLOCKED_DANGEROUS_ACTION'
];
requiredStatuses.forEach(s => assert.ok(tool.GATE_STATUSES.includes(s), `GATE_STATUSES must include ${s}`));
console.log('  PASS: all required gate statuses present');

// Invariants: dryRun, realProductActionsExecuted, dangerousActionsDenied always enforced
function assertInvariants(result) {
  assert.strictEqual(result.dryRun, true, 'dryRun must be true');
  assert.strictEqual(result.realProductActionsExecuted, false, 'realProductActionsExecuted must be false');
  assert.strictEqual(result.dangerousActionsDenied, true, 'dangerousActionsDenied must be true');
  assert.strictEqual(result.humanApprovalRequired, true, 'humanApprovalRequired must be true');
}

// Gate 1: dangerous action → BLOCKED_DANGEROUS_ACTION
const r1 = tool.runGate({ isDangerousAction: true, operation: 'deploy' });
assert.strictEqual(r1.status, 'BLOCKED_DANGEROUS_ACTION');
assertInvariants(r1);
console.log('  PASS: dangerous action → BLOCKED_DANGEROUS_ACTION');

// Gate 2: deepseek unsanitized → BLOCKED_UNSANITIZED_HANDOFF
const r2 = tool.runGate({ targetProvider: 'deepseek', sanitized: false, spentJpy: 0, requestedModel: 'gemini-flash' });
assert.strictEqual(r2.status, 'BLOCKED_UNSANITIZED_HANDOFF');
assertInvariants(r2);
console.log('  PASS: deepseek + sanitized:false → BLOCKED_UNSANITIZED_HANDOFF');

// Gate 2: kimi + denied content type → BLOCKED_UNSANITIZED_HANDOFF
const r3 = tool.runGate({
  targetProvider: 'kimi',
  sanitized: true,
  contentTypes: ['apiKey'],
  spentJpy: 0,
  requestedModel: 'gemini-flash'
});
assert.strictEqual(r3.status, 'BLOCKED_UNSANITIZED_HANDOFF');
assertInvariants(r3);
console.log('  PASS: kimi + apiKey content → BLOCKED_UNSANITIZED_HANDOFF');

// Gate 3: over budget + expensive model → BLOCKED_BUDGET
const r4 = tool.runGate({
  spentJpy: 2000,
  requestedModel: 'claude-opus',
  targetProvider: null,
  isDangerousAction: false
});
assert.strictEqual(r4.status, 'BLOCKED_BUDGET');
assertInvariants(r4);
console.log('  PASS: over budget + expensive model → BLOCKED_BUDGET');

// Gate 4: gemini fails → grok fallback, low budget, safe → NEEDS_HUMAN_APPROVAL
const r5 = tool.runGate({
  failedProvider: 'gemini',
  requestedFallback: 'grok',
  targetProvider: null,
  sanitized: true,
  contentTypes: [],
  operation: 'bulk-review',
  spentJpy: 500,
  requestedModel: 'gemini-flash',
  isDangerousAction: false
});
assert.ok(['READY', 'NEEDS_HUMAN_APPROVAL'].includes(r5.status), `Expected READY or NEEDS_HUMAN_APPROVAL, got ${r5.status}`);
assertInvariants(r5);
assert.ok(r5.routeResult, 'routeResult must be present');
console.log('  PASS: gemini fail → grok, low budget → READY or NEEDS_HUMAN_APPROVAL');

// deepseek sanitized + safe content → NEEDS_HUMAN_APPROVAL (finalDecisionAllowed:false via handoff guard)
const r6 = tool.runGate({
  targetProvider: 'deepseek',
  sanitized: true,
  contentTypes: ['abstractedErrorSummary'],
  spentJpy: 0,
  requestedModel: 'gemini-flash',
  isDangerousAction: false
});
assert.strictEqual(r6.status, 'NEEDS_HUMAN_APPROVAL');
assertInvariants(r6);
console.log('  PASS: deepseek + sanitized + safe content → NEEDS_HUMAN_APPROVAL (not final-decision)');

// inputSummary is always returned
assert.ok(r5.inputSummary, 'inputSummary must be present');
assert.strictEqual(r5.inputSummary.failedProvider, 'gemini');
assert.strictEqual(r5.inputSummary.requestedFallback, 'grok');
console.log('  PASS: inputSummary present and correct');

console.log('PASS: dev-agent-ai-fallback-sanitized-budget-gate-pack');
