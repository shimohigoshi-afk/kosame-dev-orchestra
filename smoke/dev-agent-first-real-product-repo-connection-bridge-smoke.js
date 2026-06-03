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
const tool   = require('../tools/first-real-product-repo-connection-bridge-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-connection-bridge smoke ===');

assert.ok(compareVersion(pkg.version, '27.0.0') >= 0, `pkg version must be >= 27.0.0, got ${pkg.version}`);
console.log('  PASS: package version 27.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-connection-bridge'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-connection-bridge'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v27.0.0-release-record.md')), 'v27 release record must exist');
console.log('  PASS: v27 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-connection-bridge.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '27.0.0', 'tool version must be 27.0.0');
console.log('  PASS: tool meta version 27.0.0');

// ---- ready bridge: all human inputs provided ----
const readyBridge = tool.buildConnectionBridge({
  targetProduct:       'sales_dx',
  providedHumanInputs: ['repoExistsConfirmed', 'branchNameForWork', 'taskScopeConfirmed', 'allowedFileZonesConfirmed']
});

assert.strictEqual(readyBridge.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(readyBridge.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(readyBridge.connectionBridgeId, 'connectionBridgeId must be present');
console.log('  PASS: connectionBridgeId present');

assert.strictEqual(readyBridge.targetProduct, 'sales_dx', 'targetProduct must match');
console.log('  PASS: targetProduct correct');

assert.ok(readyBridge.targetRepoCandidate, 'targetRepoCandidate must be present');
console.log('  PASS: targetRepoCandidate present');

assert.ok(readyBridge.repoPathCandidate, 'repoPathCandidate must be present');
console.log('  PASS: repoPathCandidate present');

assert.ok(readyBridge.repoKind, 'repoKind must be present');
console.log('  PASS: repoKind present');

assert.ok(readyBridge.branchPolicy, 'branchPolicy must be present');
console.log('  PASS: branchPolicy present');

assert.ok(Array.isArray(readyBridge.connectionAssumptions), 'connectionAssumptions must be array');
console.log('  PASS: connectionAssumptions array');

assert.ok(Array.isArray(readyBridge.safeReadOnlyChecks) && readyBridge.safeReadOnlyChecks.length > 0, 'safeReadOnlyChecks must be non-empty');
console.log('  PASS: safeReadOnlyChecks non-empty');

assert.ok(Array.isArray(readyBridge.forbiddenChecks) && readyBridge.forbiddenChecks.length > 0, 'forbiddenChecks must be non-empty');
console.log('  PASS: forbiddenChecks non-empty');

assert.ok(Array.isArray(readyBridge.requiredHumanInputs), 'requiredHumanInputs must be array');
console.log('  PASS: requiredHumanInputs array');

assert.strictEqual(readyBridge.missingHumanInputs.length, 0, 'missingHumanInputs must be empty when all provided');
console.log('  PASS: missingHumanInputs empty');

assert.ok(readyBridge.secretBoundary, 'secretBoundary must be present');
assert.strictEqual(readyBridge.secretBoundary.status, 'enforced', 'secretBoundary.status must be enforced');
console.log('  PASS: secretBoundary enforced');

assert.ok(readyBridge.customerDataBoundary, 'customerDataBoundary must be present');
assert.strictEqual(readyBridge.customerDataBoundary.status, 'enforced', 'customerDataBoundary.status must be enforced');
console.log('  PASS: customerDataBoundary enforced');

assert.ok(readyBridge.regulatedDataBoundary, 'regulatedDataBoundary must be present');
console.log('  PASS: regulatedDataBoundary present');

assert.strictEqual(readyBridge.allowedConnectionMode, 'dry_run_readonly_bridge_only', 'allowedConnectionMode must be dry_run_readonly_bridge_only');
console.log('  PASS: allowedConnectionMode correct');

assert.ok(Array.isArray(readyBridge.blockedConnectionModes) && readyBridge.blockedConnectionModes.length > 0, 'blockedConnectionModes must be non-empty');
assert.ok(readyBridge.blockedConnectionModes.includes('direct_deploy'), 'direct_deploy must be blocked');
assert.ok(readyBridge.blockedConnectionModes.includes('auto_push'), 'auto_push must be blocked');
assert.ok(readyBridge.blockedConnectionModes.includes('secret_inspection'), 'secret_inspection must be blocked');
console.log('  PASS: blockedConnectionModes correct');

assert.ok(Array.isArray(readyBridge.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(readyBridge.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
assert.ok(readyBridge.dangerousActionsDenied.some(a => a.includes('secret')), 'secret read must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(readyBridge.connectionBridgeReady, true, 'connectionBridgeReady must be true when all inputs provided');
console.log('  PASS: connectionBridgeReady true');

assert.strictEqual(readyBridge.notReadyReasons.length, 0, 'notReadyReasons must be empty');
console.log('  PASS: notReadyReasons empty');

assert.strictEqual(readyBridge.noRealRepoAccess, true, 'noRealRepoAccess must be true');
assert.strictEqual(readyBridge.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(readyBridge.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- missing human inputs ----
const incompleteBridge = tool.buildConnectionBridge({ targetProduct: 'anesty_board' });
assert.ok(incompleteBridge.missingHumanInputs.length > 0, 'missingHumanInputs must be non-empty when none provided');
assert.strictEqual(incompleteBridge.connectionBridgeReady, false, 'connectionBridgeReady must be false when inputs missing');
assert.ok(incompleteBridge.notReadyReasons.length > 0, 'notReadyReasons must be non-empty');
console.log('  PASS: missing human inputs handled');

// ---- unknown product ----
const unknownBridge = tool.buildConnectionBridge({ targetProduct: 'unknown_product' });
assert.strictEqual(unknownBridge.connectionBridgeReady, false, 'connectionBridgeReady must be false for unknown product');
assert.ok(unknownBridge.notReadyReasons.some(r => r.includes('Unknown')), 'notReadyReasons must mention Unknown product');
console.log('  PASS: unknown product handled');

// ---- all 5 products have repo candidates ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const b = tool.buildConnectionBridge({ targetProduct: p });
  assert.ok(b.targetRepoCandidate, `${p} must have targetRepoCandidate`);
  assert.ok(b.repoPathCandidate, `${p} must have repoPathCandidate`);
}
console.log('  PASS: all 5 products have repo/path candidates');

console.log('PASS: first-real-product-repo-connection-bridge');
