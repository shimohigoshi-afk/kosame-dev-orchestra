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
const tool   = require('../tools/first-real-product-repo-dispatch-plan-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-dispatch-plan-pack smoke ===');

assert.ok(compareVersion(pkg.version, '23.0.0') >= 0, `pkg version must be >= 23.0.0, got ${pkg.version}`);
console.log('  PASS: package version 23.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-dispatch-plan'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-dispatch-plan'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v23.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-dispatch-plan.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '23.0.0', 'tool version must be 23.0.0');
console.log('  PASS: tool meta version 23.0.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];

for (const p of PRODUCTS) {
  const plan = tool.buildDispatchPlan({
    targetProduct:   p,
    taskTitle:       `Test task for ${p}`,
    taskGoal:        `Test goal for ${p}`,
    businessContext: `Context for ${p}`
  });

  assert.strictEqual(plan.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(plan.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(plan.dispatchPlanId, `dispatchPlanId must be present for ${p}`);
  assert.strictEqual(plan.targetProduct, p, `targetProduct must match for ${p}`);
  assert.ok(plan.targetRepoCandidate, `targetRepoCandidate must be present for ${p}`);
  assert.ok(plan.taskTitle, `taskTitle must be present for ${p}`);
  assert.ok(plan.taskGoal, `taskGoal must be present for ${p}`);
  assert.ok(['low', 'medium', 'high'].includes(plan.priority), `priority must be valid for ${p}`);
  assert.ok(plan.recommendedProvider, `recommendedProvider must be present for ${p}`);
  assert.ok(Array.isArray(plan.dispatchOrder) && plan.dispatchOrder.length > 0, `dispatchOrder must be non-empty for ${p}`);
  assert.ok(Array.isArray(plan.requiredInputs), `requiredInputs must be array for ${p}`);
  assert.ok(Array.isArray(plan.missingInputs), `missingInputs must be array for ${p}`);
  assert.ok(Array.isArray(plan.allowedFileZones) && plan.allowedFileZones.length > 0, `allowedFileZones must be non-empty for ${p}`);
  assert.ok(Array.isArray(plan.deniedFileZones) && plan.deniedFileZones.length > 0, `deniedFileZones must be non-empty for ${p}`);
  assert.ok(plan.verificationPlan, `verificationPlan must be present for ${p}`);
  assert.ok(Array.isArray(plan.verificationPlan.steps), `verificationPlan.steps must be array for ${p}`);
  assert.ok(plan.rollbackPlan, `rollbackPlan must be present for ${p}`);
  assert.ok(plan.rollbackPlan.fileLevel, `rollbackPlan.fileLevel must be present for ${p}`);
  assert.ok(Array.isArray(plan.dangerousActionsDenied), `dangerousActionsDenied must be array for ${p}`);
  assert.ok(plan.dangerousActionsDenied.some(a => a.includes('git commit')), `must include git commit for ${p}`);
  assert.ok(plan.dangerousActionsDenied.some(a => a.includes('git push')),   `must include git push for ${p}`);
  assert.ok(plan.dangerousActionsDenied.some(a => a.includes('deploy')),     `must include deploy for ${p}`);
  assert.ok(typeof plan.dispatchReady === 'boolean', `dispatchReady must be boolean for ${p}`);
  assert.ok(Array.isArray(plan.notReadyReasons), `notReadyReasons must be array for ${p}`);
  assert.ok(typeof plan.recommendedNextAction === 'string', `recommendedNextAction must be string for ${p}`);
  assert.strictEqual(plan.noRealRepoAccess, true, `noRealRepoAccess must be true for ${p}`);
  assert.strictEqual(plan.noRealExecution,  true, `noRealExecution must be true for ${p}`);
}
console.log('  PASS: all 5 product types produce valid dispatch plan');

// ANESTY: denied zones must include insurance/health
const anesty = tool.buildDispatchPlan({ targetProduct: 'anesty_board', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
assert.ok(anesty.deniedFileZones.some(z => z.includes('insurance') || z.includes('health')), 'anesty deniedFileZones must include insurance/health');
console.log('  PASS: ANESTY Board denied zones include insurance/health');

// dispatchOrder has step 4 with Human
const humanStep = anesty.dispatchOrder.find(s => s.provider === 'Human');
assert.ok(humanStep, 'dispatchOrder must include Human step');
console.log('  PASS: dispatchOrder includes Human step');

// unknown product
const unknown = tool.buildDispatchPlan({ targetProduct: 'unknown_xyz', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown');
assert.strictEqual(unknown.dispatchReady, false, 'dispatchReady must be false for unknown');
console.log('  PASS: unknown product handled correctly');

for (const p of PRODUCTS) assert.ok(tool.SUPPORTED_PRODUCTS.includes(p), `${p} must be in SUPPORTED_PRODUCTS`);
console.log('  PASS: all 5 product types in SUPPORTED_PRODUCTS');

console.log('PASS: first-real-product-repo-dispatch-plan-pack');
