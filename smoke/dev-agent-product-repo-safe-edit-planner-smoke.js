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
const tool   = require('../tools/product-repo-safe-edit-planner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-repo-safe-edit-planner-pack smoke ===');

assert.ok(compareVersion(pkg.version, '17.5.0') >= 0, `pkg version must be >= 17.5.0, got ${pkg.version}`);
console.log('  PASS: package version 17.5.0 or later');

assert.ok(pkg.scripts['smoke:product-repo-safe-edit-planner'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-repo-safe-edit-planner'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v17.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-repo-safe-edit-planner.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '17.5.0', 'tool version must be 17.5.0');
console.log('  PASS: tool meta version 17.5.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];
for (const p of PRODUCTS) {
  const plan = tool.buildSafeEditPlan({ productType: p, taskGoal: `test task for ${p}` });
  assert.strictEqual(plan.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(plan.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(plan.planId, `planId must be present for ${p}`);
  assert.ok(Array.isArray(plan.editableAreas) && plan.editableAreas.length > 0, `editableAreas must be non-empty for ${p}`);
  assert.ok(Array.isArray(plan.deniedAreas) && plan.deniedAreas.length > 0, `deniedAreas must be non-empty for ${p}`);
  assert.ok(plan.secretBoundary, `secretBoundary must be present for ${p}`);
  assert.ok(plan.customerDataBoundary, `customerDataBoundary must be present for ${p}`);
  assert.ok(plan.safeFirstStep, `safeFirstStep must be present for ${p}`);
  assert.ok(Array.isArray(plan.verificationPlan), `verificationPlan must be array for ${p}`);
  assert.ok(Array.isArray(plan.approvalGates), `approvalGates must be non-empty for ${p}`);
  assert.strictEqual(plan.isKnownProduct, true, `isKnownProduct must be true for ${p}`);
  assert.strictEqual(plan.noRealRepoEdit, true, `noRealRepoEdit must be true for ${p}`);
  assert.ok(Array.isArray(plan.dangerousActionsDenied), `dangerousActionsDenied must be array for ${p}`);
  assert.ok(plan.dangerousActionsDenied.includes('deploy'), `must include deploy for ${p}`);
}
console.log('  PASS: all 5 product types produce valid safe edit plan');

// ANESTY board: health/insurance data must be in deniedAreas
const anesty = tool.buildSafeEditPlan({ productType: 'anesty_board', taskGoal: 'test' });
const deniedText = anesty.deniedAreas.join(' ');
assert.ok(deniedText.includes('insurance') || deniedText.includes('health'), 'anesty deniedAreas must include insurance/health');
console.log('  PASS: ANESTY Board denied areas include insurance/health');

// unknown product falls back gracefully
const unknown = tool.buildSafeEditPlan({ productType: 'unknown_xyz', taskGoal: 'test' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown');
console.log('  PASS: unknown product fallback works');

console.log('PASS: product-repo-safe-edit-planner-pack');
