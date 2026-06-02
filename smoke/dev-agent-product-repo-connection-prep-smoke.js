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
const tool   = require('../tools/product-repo-connection-prep-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-repo-connection-prep-pack smoke ===');

assert.ok(compareVersion(pkg.version, '21.5.0') >= 0, `pkg version must be >= 21.5.0, got ${pkg.version}`);
console.log('  PASS: package version 21.5.0 or later');

assert.ok(pkg.scripts['smoke:product-repo-connection-prep'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-repo-connection-prep'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v21.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-repo-connection-prep.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '21.5.0', 'tool version must be 21.5.0');
console.log('  PASS: tool meta version 21.5.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];

for (const p of PRODUCTS) {
  const packet = tool.buildConnectionPrepPacket({ productType: p, taskId: 'task-001' });

  assert.strictEqual(packet.dryRun, true, `dryRun must be true for ${p}`);
  assert.strictEqual(packet.humanApprovalRequired, true, `humanApprovalRequired must be true for ${p}`);
  assert.ok(packet.connectionPrepId, `connectionPrepId must be present for ${p}`);
  assert.ok(packet.repoPathCandidate, `repoPathCandidate must be present for ${p}`);
  assert.ok(packet.repoExistenceCheckPlan, `repoExistenceCheckPlan must be present for ${p}`);
  assert.ok(packet.repoExistenceCheckPlan.note, `repoExistenceCheckPlan.note must be present for ${p}`);
  assert.ok(Array.isArray(packet.repoExistenceCheckPlan.commands), `repoExistenceCheckPlan.commands must be array for ${p}`);
  assert.ok(packet.branchPolicy, `branchPolicy must be present for ${p}`);
  assert.ok(packet.branchPolicy.defaultBranch, `branchPolicy.defaultBranch must be present for ${p}`);
  assert.ok(Array.isArray(packet.safeReadCommands) && packet.safeReadCommands.length > 0, `safeReadCommands must be non-empty for ${p}`);
  assert.ok(Array.isArray(packet.safeWriteZones) && packet.safeWriteZones.length > 0, `safeWriteZones must be non-empty for ${p}`);
  assert.ok(Array.isArray(packet.deniedZones) && packet.deniedZones.length > 0, `deniedZones must be non-empty for ${p}`);
  assert.ok(packet.secretAndEnvPolicy, `secretAndEnvPolicy must be present for ${p}`);
  assert.ok(packet.customerDataPolicy, `customerDataPolicy must be present for ${p}`);
  assert.ok(Array.isArray(packet.verificationCommands), `verificationCommands must be array for ${p}`);
  assert.ok(packet.rollbackPolicy, `rollbackPolicy must be present for ${p}`);
  assert.ok(Array.isArray(packet.humanApprovalGates) && packet.humanApprovalGates.length > 0, `humanApprovalGates must be non-empty for ${p}`);
  assert.ok(packet.humanApprovalGates.some(g => g.includes('じゅんやさん')), `humanApprovalGates must include じゅんやさん for ${p}`);
  assert.strictEqual(packet.connectionReady, true, `connectionReady must be true for known product ${p}`);
  assert.ok(Array.isArray(packet.notReadyReasons) && packet.notReadyReasons.length === 0, `notReadyReasons must be empty for known product ${p}`);
  assert.ok(Array.isArray(packet.dangerousActionsDenied), `dangerousActionsDenied must be array for ${p}`);
  assert.ok(packet.dangerousActionsDenied.includes('git commit'), `must include git commit for ${p}`);
  assert.ok(packet.dangerousActionsDenied.includes('deploy'), `must include deploy for ${p}`);
  assert.strictEqual(packet.noRealRepoAccess, true, `noRealRepoAccess must be true for ${p}`);
  assert.strictEqual(packet.noRealExecution, true, `noRealExecution must be true for ${p}`);
}
console.log('  PASS: all 5 product types produce valid connection prep packet');

// repoExistenceCheckPlan must be dry-run only
const salesPrep = tool.buildConnectionPrepPacket({ productType: 'sales_dx', taskId: 't' });
assert.ok(salesPrep.repoExistenceCheckPlan.note.includes('dry-run'), 'repoExistenceCheckPlan must be marked dry-run only');
console.log('  PASS: repoExistenceCheckPlan is marked dry-run only');

// ANESTY denied zones must include insurance/health
const anesty = tool.buildConnectionPrepPacket({ productType: 'anesty_board', taskId: 't' });
const deniedText = anesty.deniedZones.join(' ');
assert.ok(deniedText.includes('insurance') || deniedText.includes('health'), 'anesty deniedZones must include insurance/health');
console.log('  PASS: ANESTY Board denied zones include insurance/health');

// unknown product
const unknown = tool.buildConnectionPrepPacket({ productType: 'unknown_xyz', taskId: 't' });
assert.strictEqual(unknown.connectionReady, false, 'connectionReady must be false for unknown product');
assert.ok(unknown.notReadyReasons.length > 0, 'notReadyReasons must be populated for unknown product');
console.log('  PASS: unknown product handled correctly');

console.log('PASS: product-repo-connection-prep-pack');
