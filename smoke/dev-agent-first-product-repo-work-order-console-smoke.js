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
const tool   = require('../tools/first-product-repo-work-order-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-work-order-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '25.0.0') >= 0, `pkg version must be >= 25.0.0, got ${pkg.version}`);
console.log('  PASS: package version 25.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-work-order-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-work-order-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v25.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-work-order-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '25.0.0', 'tool version must be 25.0.0');
console.log('  PASS: tool meta version 25.0.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];

for (const p of PRODUCTS) {
  const wo = tool.buildWorkOrder({
    targetProduct:   p,
    taskTitle:       `Test for ${p}`,
    taskGoal:        `Test goal for ${p}`,
    businessContext: `Context for ${p}`
  });
  assert.strictEqual(wo.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(wo.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(wo.workOrderId, `workOrderId must be present for ${p}`);
  assert.strictEqual(wo.targetProduct, p, `targetProduct must match for ${p}`);
  assert.ok(wo.targetRepoCandidate, `targetRepoCandidate must be present for ${p}`);
  assert.ok(wo.taskTitle, `taskTitle must be present for ${p}`);
  assert.ok(wo.taskGoal, `taskGoal must be present for ${p}`);
  assert.ok(wo.businessContext, `businessContext must be present for ${p}`);
  assert.ok(wo.productContext, `productContext must be present for ${p}`);
  assert.ok(wo.userIntent, `userIntent must be present for ${p}`);
  assert.ok(wo.implementationScope, `implementationScope must be present for ${p}`);
  assert.ok(Array.isArray(wo.filesAllowedToTouch) && wo.filesAllowedToTouch.length > 0, `filesAllowedToTouch must be non-empty for ${p}`);
  assert.ok(Array.isArray(wo.filesForbiddenToTouch) && wo.filesForbiddenToTouch.length > 0, `filesForbiddenToTouch must be non-empty for ${p}`);
  assert.ok(Array.isArray(wo.commandsAllowed) && wo.commandsAllowed.length > 0, `commandsAllowed must be non-empty for ${p}`);
  assert.ok(Array.isArray(wo.commandsForbidden) && wo.commandsForbidden.length > 0, `commandsForbidden must be non-empty for ${p}`);
  assert.ok(wo.commandsForbidden.some(c => c.includes('git add')),    `commandsForbidden must include git add for ${p}`);
  assert.ok(wo.commandsForbidden.some(c => c.includes('git commit')), `commandsForbidden must include git commit for ${p}`);
  assert.ok(wo.commandsForbidden.some(c => c.includes('git push')),   `commandsForbidden must include git push for ${p}`);
  assert.ok(wo.commandsForbidden.some(c => c.includes('deploy')),     `commandsForbidden must include deploy for ${p}`);
  assert.ok(Array.isArray(wo.verificationCommands), `verificationCommands must be array for ${p}`);
  assert.ok(Array.isArray(wo.expectedDeliverables), `expectedDeliverables must be array for ${p}`);
  assert.ok(wo.reportFormat, `reportFormat must be present for ${p}`);
  assert.ok(wo.reportFormat.requiredFields.includes('editedFiles'), `reportFormat must include editedFiles for ${p}`);
  assert.ok(wo.reportFormat.requiredFields.includes('rollbackNote'), `reportFormat must include rollbackNote for ${p}`);
  assert.ok(typeof wo.rollbackInstruction === 'string', `rollbackInstruction must be string for ${p}`);
  assert.ok(Array.isArray(wo.dangerousActionsDenied), `dangerousActionsDenied must be array for ${p}`);
  assert.ok(wo.dangerousActionsDenied.some(a => a.includes('deploy')), `dangerousActionsDenied must include deploy for ${p}`);
  assert.strictEqual(wo.isKnownProduct, true, `isKnownProduct must be true for ${p}`);
  assert.strictEqual(wo.noRealRepoEdit, true, `noRealRepoEdit must be true for ${p}`);
  assert.strictEqual(wo.noRealExecution, true, `noRealExecution must be true for ${p}`);
}
console.log('  PASS: all 5 product types produce valid work order');

// ANESTY: forbidden files must include insurance/health
const anesty = tool.buildWorkOrder({ targetProduct: 'anesty_board', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
const forbiddenText = anesty.filesForbiddenToTouch.join(' ');
assert.ok(forbiddenText.includes('insurance') || forbiddenText.includes('health'), 'ANESTY forbidden files must include insurance/health');
console.log('  PASS: ANESTY Board forbidden files include insurance/health');

// reportFormat instruction must mention STOP
const salesWO = tool.buildWorkOrder({ targetProduct: 'sales_dx', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
assert.ok(salesWO.reportFormat.instruction.includes('Stop') || salesWO.reportFormat.instruction.includes('STOP'), 'reportFormat instruction must mention Stop');
console.log('  PASS: reportFormat instruction mentions Stop');

// unknown product
const unknown = tool.buildWorkOrder({ targetProduct: 'unknown_xyz', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown');
assert.strictEqual(unknown.workOrderReady, false, 'workOrderReady must be false for unknown');
console.log('  PASS: unknown product handled correctly');

for (const p of PRODUCTS) assert.ok(tool.SUPPORTED_PRODUCTS.includes(p));
console.log('  PASS: all 5 product types in SUPPORTED_PRODUCTS');

console.log('PASS: first-product-repo-work-order-console-pack');
