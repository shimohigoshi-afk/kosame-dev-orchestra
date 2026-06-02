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
const tool   = require('../tools/first-product-repo-task-packet-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-task-packet-pack smoke ===');

assert.ok(compareVersion(pkg.version, '21.0.0') >= 0, `pkg version must be >= 21.0.0, got ${pkg.version}`);
console.log('  PASS: package version 21.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-task-packet'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-task-packet'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v21.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-task-packet.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '21.0.0', 'tool version must be 21.0.0');
console.log('  PASS: tool meta version 21.0.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];

for (const p of PRODUCTS) {
  const packet = tool.buildTaskPacket({
    requestedProduct: p,
    taskTitle:        `Test task for ${p}`,
    taskGoal:         `Test goal for ${p}`,
    businessContext:  `Business context for ${p}`
  });

  assert.strictEqual(packet.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(packet.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(packet.productRepoTaskId, `productRepoTaskId must be present for ${p}`);
  assert.strictEqual(packet.requestedProduct, p, `requestedProduct must match for ${p}`);
  assert.ok(packet.targetRepoCandidate, `targetRepoCandidate must be present for ${p}`);
  assert.ok(packet.taskTitle, `taskTitle must be present for ${p}`);
  assert.ok(packet.taskGoal, `taskGoal must be present for ${p}`);
  assert.ok(packet.businessContext, `businessContext must be present for ${p}`);
  assert.ok(packet.implementationIntent, `implementationIntent must be present for ${p}`);
  assert.ok(Array.isArray(packet.allowedFileZones) && packet.allowedFileZones.length > 0, `allowedFileZones must be non-empty for ${p}`);
  assert.ok(Array.isArray(packet.deniedFileZones) && packet.deniedFileZones.length > 0, `deniedFileZones must be non-empty for ${p}`);
  assert.ok(packet.dataBoundary, `dataBoundary must be present for ${p}`);
  assert.ok(packet.secretBoundary, `secretBoundary must be present for ${p}`);
  assert.ok(Array.isArray(packet.expectedOutputs), `expectedOutputs must be array for ${p}`);
  assert.ok(packet.recommendedProvider, `recommendedProvider must be present for ${p}`);
  assert.ok(typeof packet.claudeTaskDraft === 'string' && packet.claudeTaskDraft.length > 0, `claudeTaskDraft must be non-empty for ${p}`);
  assert.ok(packet.verificationPlan, `verificationPlan must be present for ${p}`);
  assert.ok(Array.isArray(packet.verificationPlan.steps), `verificationPlan.steps must be array for ${p}`);
  assert.strictEqual(packet.isKnownProduct, true, `isKnownProduct must be true for ${p}`);
  assert.ok(Array.isArray(packet.dangerousActionsDenied), `dangerousActionsDenied must be array for ${p}`);
  assert.ok(packet.dangerousActionsDenied.includes('git commit'), `dangerousActionsDenied must include git commit for ${p}`);
  assert.ok(packet.dangerousActionsDenied.includes('git push'), `dangerousActionsDenied must include git push for ${p}`);
  assert.ok(packet.dangerousActionsDenied.includes('deploy'), `dangerousActionsDenied must include deploy for ${p}`);
  assert.ok(packet.claudeTaskDraft.includes('Forbidden Actions'), `claudeTaskDraft must include Forbidden Actions for ${p}`);
  assert.strictEqual(packet.noRealRepoEdit, true, `noRealRepoEdit must be true for ${p}`);
  assert.strictEqual(packet.noRealExecution, true, `noRealExecution must be true for ${p}`);
}
console.log('  PASS: all 5 product types produce valid task packet');

// ANESTY board: denied zones must include insurance/health
const anesty = tool.buildTaskPacket({ requestedProduct: 'anesty_board', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
const deniedText = anesty.deniedFileZones.join(' ');
assert.ok(deniedText.includes('insurance') || deniedText.includes('health'), 'anesty deniedFileZones must include insurance/health');
console.log('  PASS: ANESTY Board denied zones include insurance/health');

// unknown product
const unknown = tool.buildTaskPacket({ requestedProduct: 'unknown_xyz', taskTitle: 't', taskGoal: 't', businessContext: 'b' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown product');
console.log('  PASS: unknown product handled correctly');

// 5 supported products
for (const p of PRODUCTS) assert.ok(tool.SUPPORTED_PRODUCTS.includes(p), `${p} must be in SUPPORTED_PRODUCTS`);
console.log('  PASS: all 5 product types in SUPPORTED_PRODUCTS');

console.log('PASS: first-product-repo-task-packet-pack');
