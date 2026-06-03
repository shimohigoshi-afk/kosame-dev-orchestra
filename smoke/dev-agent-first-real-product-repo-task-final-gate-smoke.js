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
const tool   = require('../tools/first-real-product-repo-task-final-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-task-final-gate smoke ===');

assert.ok(compareVersion(pkg.version, '36.0.0') >= 0, `pkg version must be >= 36.0.0, got ${pkg.version}`);
console.log('  PASS: package version 36.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-task-final-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-task-final-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v36.0.0-release-record.md')), 'v36 release record must exist');
console.log('  PASS: v36 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-task-final-gate.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '36.0.0', 'tool version must be 36.0.0');
console.log('  PASS: tool meta version 36.0.0');

const ALL_CHECKS = {
  readinessCompletePassed: true, launchPacketReady: true, firstTouchDone: true,
  selectionDecided: true, bridgeReady: true, lowRiskScopeConfirmed: true,
  noSecretInScope: true, noCustomerDataInScope: true, noDeployInScope: true,
  kosameApproval: true, junyaYes: true
};

// ---- all checks passed → approve ----
const approvePack = tool.buildFinalGate({
  targetProduct: 'email_reply_bot',
  checks: ALL_CHECKS,
  allowedScope:   ['docs/**', 'README.md', 'smoke/**'],
  forbiddenScope: ['.env*', 'secrets/**']
});

assert.strictEqual(approvePack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(approvePack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(approvePack.finalGateId, 'finalGateId must be present');
console.log('  PASS: finalGateId present');

assert.ok(approvePack.firstTaskCandidate, 'firstTaskCandidate must be present');
console.log('  PASS: firstTaskCandidate present');

assert.ok(Array.isArray(approvePack.finalSafetyChecklist) && approvePack.finalSafetyChecklist.length > 0, 'finalSafetyChecklist must be non-empty');
console.log('  PASS: finalSafetyChecklist non-empty');

assert.ok(approvePack.humanApprovalContract, 'humanApprovalContract must be present');
assert.ok(Array.isArray(approvePack.humanApprovalContract.requiredFor), 'humanApprovalContract.requiredFor must be array');
console.log('  PASS: humanApprovalContract present');

assert.ok(Array.isArray(approvePack.allowedScope) && approvePack.allowedScope.length > 0, 'allowedScope must be non-empty');
assert.ok(Array.isArray(approvePack.forbiddenScope) && approvePack.forbiddenScope.length > 0, 'forbiddenScope must be non-empty');
console.log('  PASS: allowedScope/forbiddenScope present');

assert.ok(Array.isArray(approvePack.blockerItems), 'blockerItems must be array');
assert.strictEqual(approvePack.blockerItems.length, 0, 'blockerItems must be empty for fully checked pack');
console.log('  PASS: blockerItems empty');

assert.strictEqual(approvePack.finalGateDecision, 'approve', 'finalGateDecision must be approve when all checks pass');
console.log('  PASS: finalGateDecision approve');

assert.ok(Array.isArray(approvePack.decisionOptions), 'decisionOptions must be array');
assert.ok(approvePack.decisionOptions.includes('approve'), 'approve in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('hold'), 'hold in decisionOptions');
console.log('  PASS: decisionOptions correct');

assert.strictEqual(approvePack.readyForLaunchHandoff, true, 'readyForLaunchHandoff must be true');
console.log('  PASS: readyForLaunchHandoff true');

assert.ok(Array.isArray(approvePack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(approvePack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
assert.ok(approvePack.dangerousActionsDenied.some(a => a.includes('secret')), 'secret read must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(approvePack.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(approvePack.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(approvePack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- anesty_board → hold ----
const holdPack = tool.buildFinalGate({ targetProduct: 'anesty_board', checks: ALL_CHECKS });
assert.strictEqual(holdPack.finalGateDecision, 'hold', 'anesty_board must get hold decision');
assert.strictEqual(holdPack.readyForLaunchHandoff, false, 'readyForLaunchHandoff must be false for high-risk product');
console.log('  PASS: anesty_board → hold + readyForLaunchHandoff false');

// ---- missing checks → revise ----
const revisePack = tool.buildFinalGate({ targetProduct: 'email_reply_bot', checks: { noSecretInScope: true } });
assert.ok(['revise', 'reject'].includes(revisePack.finalGateDecision), 'missing checks must result in revise/reject');
assert.ok(revisePack.blockerItems.length > 0, 'blockerItems must be non-empty when checks missing');
assert.strictEqual(revisePack.readyForLaunchHandoff, false, 'readyForLaunchHandoff must be false when checks missing');
console.log('  PASS: missing checks → revise + readyForLaunchHandoff false');

// ---- unknown product → reject ----
const rejectPack = tool.buildFinalGate({ targetProduct: 'unknown_xyz', checks: ALL_CHECKS });
assert.strictEqual(rejectPack.finalGateDecision, 'reject', 'unknown product must get reject');
console.log('  PASS: unknown product → reject');

// ---- all 5 products generate gate packet ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const g = tool.buildFinalGate({ targetProduct: p });
  assert.ok(g.finalGateId, `${p} must have finalGateId`);
}
console.log('  PASS: all 5 products generate final gate packet');

console.log('PASS: first-real-product-repo-task-final-gate');
