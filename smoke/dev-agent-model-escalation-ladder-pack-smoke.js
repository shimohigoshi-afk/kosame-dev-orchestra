'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-model-escalation-ladder-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-model-escalation-ladder-pack smoke ===');

// 1. package version
assert.ok(pkg.version >= '110.3.0', 'package version must be 110.3.0 or later');
console.log('  PASS: package version >= 110.3.0');

// 2. tool meta version
assert.strictEqual(tool.TOOL_META.version, '110.3.0');
console.log('  PASS: tool meta version is 110.3.0');

// 3. cheap default routine — no escalation
const r1 = tool.evaluateEscalation({ currentTier: tool.TIERS.CHEAP_DEFAULT, issueType: 'none' });
assert.strictEqual(r1.escalationAllowed, false);
assert.strictEqual(r1.humanApprovalRequired, false);
assert.strictEqual(r1.currentTier, tool.TIERS.CHEAP_DEFAULT);
assert.strictEqual(r1.recommendedTier, tool.TIERS.CHEAP_DEFAULT);
assert.strictEqual(r1.dryRun, true);
assert.strictEqual(r1.realProductActionsExecuted, false);
console.log('  PASS: routine work does not escalate');

// 4. expensive escalation requires human approval
const r2 = tool.evaluateEscalation({
  currentTier: tool.TIERS.CHEAP_DEFAULT,
  issueType: 'repeated_code_repair',
  repeatFailCount: 3,
  budgetUsedPct: 10,
  budgetCapPct: 100
});
assert.strictEqual(r2.escalationAllowed, true);
assert.strictEqual(r2.humanApprovalRequired, true);
assert.ok(r2.approvalMessage, 'approvalMessage must be present');
console.log('  PASS: expensive escalation requires human approval');

// 5. context_too_large — recommends snapshot/split/preprocess before premium
const r3 = tool.evaluateEscalation({ currentTier: tool.TIERS.CHEAP_DEFAULT, issueType: 'context_too_large' });
assert.strictEqual(r3.escalationAllowed, false);
assert.ok(r3.cheaperAlternatives.includes('use_failure_snapshot'));
assert.ok(r3.cheaperAlternatives.includes('gemini_preprocessing'));
console.log('  PASS: context_too_large recommends snapshot/split/preprocess');

// 6. budget over cap — blocks escalation
const r4 = tool.evaluateEscalation({
  currentTier: tool.TIERS.STANDARD,
  issueType: 'repeated_code_repair',
  repeatFailCount: 3,
  budgetUsedPct: 100,
  budgetCapPct: 100
});
assert.strictEqual(r4.escalationAllowed, false);
assert.ok(r4.escalationReason.includes('budget_over_cap'));
console.log('  PASS: budget over cap blocks escalation');

// 7. provider timeout — recommends fallback first
const r5 = tool.evaluateEscalation({ currentTier: tool.TIERS.CHEAP_DEFAULT, issueType: 'provider_timeout' });
assert.strictEqual(r5.escalationAllowed, false);
assert.ok(r5.cheaperAlternatives.includes('try_fallback_provider_first'));
console.log('  PASS: provider timeout recommends fallback before escalation');

// fixture exists
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-model-escalation-ladder-pack.fixture.json')));
console.log('  PASS: fixture exists');

console.log('PASS: dev-agent-model-escalation-ladder-pack');
