'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');

const tool = require('../tools/dev-agent-budget-governor-pack.js');
const pkg  = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-budget-governor-pack smoke ===');

// version
function semverGte(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}
assert.ok(semverGte(pkg.version, '110.1.0'), 'package version must be 110.1.0 or later');
console.log('  PASS: package version');

// script exists
assert.ok(pkg.scripts['smoke:budget-governor-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-budget-governor-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// TOOL_META
assert.strictEqual(tool.TOOL_META.version, '110.1.0');
console.log('  PASS: tool meta version');

// 0% spent — OK, cheap model allowed without human approval
const r0 = tool.evaluateBudget({ spentJpy: 0, requestedModel: 'gemini-flash' });
assert.strictEqual(r0.budgetStatus, 'OK');
assert.strictEqual(r0.escalationAllowed, true);
assert.strictEqual(r0.humanApprovalRequired, false);
assert.strictEqual(r0.fallbackToCheapModels, false);
assert.strictEqual(r0.dryRun, true);
assert.strictEqual(r0.realProductActionsExecuted, false);
assert.strictEqual(r0.dangerousActionsDenied, true);
console.log('  PASS: 0% budget, cheap model → OK, no human approval');

// 0% spent but expensive model requested — human approval required
const rExp = tool.evaluateBudget({ spentJpy: 0, requestedModel: 'claude-opus' });
assert.strictEqual(rExp.budgetStatus, 'OK');
assert.strictEqual(rExp.humanApprovalRequired, true);
assert.ok(rExp.approvalMessage.includes('claude-opus'));
console.log('  PASS: 0% budget, expensive model → human approval required');

// 80% spent — WARNING
const r80 = tool.evaluateBudget({ spentJpy: 1600, requestedModel: 'gemini-flash' });
assert.strictEqual(r80.budgetStatus, 'WARNING');
assert.strictEqual(r80.escalationAllowed, true);   // cheap model still allowed
assert.strictEqual(r80.humanApprovalRequired, false);
console.log('  PASS: 80% budget, cheap model → WARNING but allowed');

// 80% spent, expensive model → human approval required
const r80exp = tool.evaluateBudget({ spentJpy: 1600, requestedModel: 'gpt-4o' });
assert.strictEqual(r80exp.budgetStatus, 'WARNING');
assert.strictEqual(r80exp.escalationAllowed, false);
assert.strictEqual(r80exp.humanApprovalRequired, true);
console.log('  PASS: 80% budget, expensive model → human approval required');

// 90% spent — NEAR_CAP, expensive models locked
const r90 = tool.evaluateBudget({ spentJpy: 1800, requestedModel: 'claude-sonnet' });
assert.strictEqual(r90.budgetStatus, 'NEAR_CAP');
assert.strictEqual(r90.escalationAllowed, false);
assert.strictEqual(r90.humanApprovalRequired, true);
assert.strictEqual(r90.fallbackToCheapModels, true);
assert.ok(r90.blockedModels.length > 0);
console.log('  PASS: 90% budget → NEAR_CAP, expensive models locked');

// 100% spent — OVER_BUDGET
const r100 = tool.evaluateBudget({ spentJpy: 2000, requestedModel: 'gemini-flash' });
assert.strictEqual(r100.budgetStatus, 'OVER_BUDGET');
assert.strictEqual(r100.escalationAllowed, false);
assert.strictEqual(r100.humanApprovalRequired, true);
assert.strictEqual(r100.fallbackToCheapModels, true);
console.log('  PASS: 100% budget → OVER_BUDGET, all escalation blocked');

// detectModelTier
assert.strictEqual(tool.detectModelTier('gemini-flash'), 'cheap');
assert.strictEqual(tool.detectModelTier('claude-opus'), 'expensive');
assert.strictEqual(tool.detectModelTier('claude-haiku'), 'standard');
assert.strictEqual(tool.detectModelTier(''), 'cheap');
console.log('  PASS: detectModelTier returns correct tiers');

// custom thresholds respected
const rCustom = tool.evaluateBudget({
  spentJpy: 500,
  requestedModel: 'gemini-flash',
  thresholds: { projectBudgetTargetJpy: 500, projectBudgetHardCapJpy: 500, warningAtPercent: 80, lockExpensiveModelsAtPercent: 90, requireHumanApprovalAtPercent: 100 }
});
assert.strictEqual(rCustom.budgetStatus, 'OVER_BUDGET');
console.log('  PASS: custom thresholds respected');

console.log('PASS: dev-agent-budget-governor-pack');
