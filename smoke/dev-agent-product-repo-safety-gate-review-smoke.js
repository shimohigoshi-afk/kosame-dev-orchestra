'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/product-repo-safety-gate-review-pack.js');
const dispatchTool = require('../tools/first-real-product-repo-dispatch-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-repo-safety-gate-review-pack smoke ===');

assert.ok(compareVersion(pkg.version, '23.5.0') >= 0, `pkg version must be >= 23.5.0, got ${pkg.version}`);
console.log('  PASS: package version 23.5.0 or later');

assert.ok(pkg.scripts['smoke:product-repo-safety-gate-review'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-repo-safety-gate-review'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v23.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-repo-safety-gate-review.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '23.5.0', 'tool version must be 23.5.0');
console.log('  PASS: tool meta version 23.5.0');

const dispatchPlan = dispatchTool.buildDispatchPlan({
  targetProduct: 'sales_dx', taskTitle: 'test', taskGoal: 'test', businessContext: 'ctx'
});

const review = tool.buildSafetyGateReview({ targetProduct: 'sales_dx', dispatchPlan });

assert.strictEqual(review.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(review.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(review.safetyGateReviewId, 'safetyGateReviewId must be present');
console.log('  PASS: safetyGateReviewId present');

assert.ok(review.safetyChecklist, 'safetyChecklist must be present');
assert.ok(typeof review.safetyChecklist === 'object', 'safetyChecklist must be object');
console.log('  PASS: safetyChecklist present');

assert.ok(review.secretBoundaryReview, 'secretBoundaryReview must be present');
assert.ok(review.secretBoundaryReview.rule, 'secretBoundaryReview.rule must be present');
console.log('  PASS: secretBoundaryReview valid');

assert.ok(review.customerDataBoundaryReview, 'customerDataBoundaryReview must be present');
assert.ok(review.customerDataBoundaryReview.rule, 'customerDataBoundaryReview.rule must be present');
console.log('  PASS: customerDataBoundaryReview valid');

assert.ok(review.regulatedDataBoundaryReview, 'regulatedDataBoundaryReview must be present');
assert.ok(typeof review.regulatedDataBoundaryReview.applicable === 'boolean', 'applicable must be boolean');
console.log('  PASS: regulatedDataBoundaryReview valid');

assert.ok(review.deployRiskReview, 'deployRiskReview must be present');
assert.ok(review.deployRiskReview.riskLevel, 'deployRiskReview.riskLevel must be present');
console.log('  PASS: deployRiskReview valid');

assert.ok(review.gitOperationReview, 'gitOperationReview must be present');
assert.ok(review.gitOperationReview.requiresHumanYes, 'requiresHumanYes must be present');
assert.ok(review.gitOperationReview.requiresHumanYes.includes('git commit'), 'must include git commit');
assert.ok(review.gitOperationReview.requiresHumanYes.includes('git push'),   'must include git push');
assert.ok(review.gitOperationReview.requiresHumanYes.includes('git tag'),    'must include git tag');
console.log('  PASS: gitOperationReview valid');

assert.ok(Array.isArray(review.allowedActions) && review.allowedActions.length > 0, 'allowedActions must be non-empty');
console.log('  PASS: allowedActions present');

assert.ok(Array.isArray(review.blockedActions) && review.blockedActions.length > 0, 'blockedActions must be non-empty');
assert.ok(review.blockedActions.some(a => a.includes('git commit')), 'blockedActions must include git commit');
assert.ok(review.blockedActions.some(a => a.includes('deploy')),     'blockedActions must include deploy');
assert.ok(review.blockedActions.some(a => a.includes('.env')),       'blockedActions must include .env');
console.log('  PASS: blockedActions valid');

assert.ok(Array.isArray(review.humanApprovalGates) && review.humanApprovalGates.length > 0, 'humanApprovalGates must be non-empty');
assert.ok(review.humanApprovalGates.some(g => g.includes('じゅんやさん')), 'humanApprovalGates must include じゅんやさん');
console.log('  PASS: humanApprovalGates valid');

assert.ok(typeof review.safetyGatePassed === 'boolean', 'safetyGatePassed must be boolean');
console.log('  PASS: safetyGatePassed is boolean');

assert.ok(Array.isArray(review.blockerItems), 'blockerItems must be array');
console.log('  PASS: blockerItems array');

assert.ok(tool.FINAL_DECISION_OPTIONS.includes(review.finalDecision), 'finalDecision must be valid option');
console.log(`  PASS: finalDecision valid (${review.finalDecision})`);

assert.ok(Array.isArray(review.finalDecisionOptions), 'finalDecisionOptions must be array');
assert.ok(review.finalDecisionOptions.includes('approve'), 'must include approve');
assert.ok(review.finalDecisionOptions.includes('revise'),  'must include revise');
assert.ok(review.finalDecisionOptions.includes('reject'),  'must include reject');
assert.ok(review.finalDecisionOptions.includes('hold'),    'must include hold');
console.log('  PASS: finalDecisionOptions valid');

assert.ok(typeof review.recommendedNextAction === 'string', 'recommendedNextAction must be string');
console.log('  PASS: recommendedNextAction present');

// ANESTY: regulated data must be applicable
const anestyReview = tool.buildSafetyGateReview({ targetProduct: 'anesty_board', dispatchPlan: dispatchTool.buildDispatchPlan({ targetProduct: 'anesty_board', taskTitle: 't', taskGoal: 't', businessContext: 'b' }) });
assert.strictEqual(anestyReview.regulatedDataBoundaryReview.applicable, true, 'ANESTY regulated data must be applicable');
assert.ok(anestyReview.deployRiskReview.riskLevel === 'high', 'ANESTY deploy risk must be high');
console.log('  PASS: ANESTY regulated data and deploy risk verified');

// safety gate with missing inputs is not passed
const emptyReview = tool.buildSafetyGateReview({ targetProduct: 'sales_dx' });
assert.ok(Array.isArray(emptyReview.blockerItems), 'blockerItems must be array for empty review');
console.log('  PASS: empty review produces blockerItems array');

assert.strictEqual(review.noRealRepoAccess, true, 'noRealRepoAccess must be true');
assert.strictEqual(review.noRealExecution,  true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

console.log('PASS: product-repo-safety-gate-review-pack');
