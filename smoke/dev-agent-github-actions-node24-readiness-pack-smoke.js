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
const tool   = require('../tools/github-actions-node24-readiness-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== github-actions-node24-readiness-pack smoke ===');

assert.ok(compareVersion(pkg.version, '31.0.0') >= 0, `pkg version must be >= 31.0.0, got ${pkg.version}`);
console.log('  PASS: package version 31.0.0 or later');

assert.ok(pkg.scripts['smoke:github-actions-node24-readiness-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:github-actions-node24-readiness-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v31.0.0-release-record.md')), 'v31 release record must exist');
console.log('  PASS: v31 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/github-actions-node24-readiness.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '31.0.0', 'tool version must be 31.0.0');
console.log('  PASS: tool meta version 31.0.0');

// ---- basic pack generation ----
const pack = tool.buildNode24ReadinessPack({
  currentNodeVersion:    '20',
  targetNodeVersion:     '24',
  currentWarningSummary: 'Node.js 20 deprecation warning in GitHub Actions.'
});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(pack.node24ReadinessId, 'node24ReadinessId must be present');
console.log('  PASS: node24ReadinessId present');

assert.ok(pack.currentWarningSummary, 'currentWarningSummary must be present');
console.log('  PASS: currentWarningSummary present');

assert.ok(Array.isArray(pack.affectedActions) && pack.affectedActions.length > 0, 'affectedActions must be non-empty');
console.log('  PASS: affectedActions non-empty');

assert.strictEqual(pack.targetNodeVersion, '24', 'targetNodeVersion must be 24');
console.log('  PASS: targetNodeVersion 24');

assert.ok(Array.isArray(pack.workflowFilesCandidate) && pack.workflowFilesCandidate.length > 0, 'workflowFilesCandidate must be non-empty');
assert.ok(pack.workflowFilesCandidate.some(f => f.includes('.github/workflows')), 'workflowFilesCandidate must include .github/workflows path');
console.log('  PASS: workflowFilesCandidate correct');

assert.ok(Array.isArray(pack.readinessChecklist) && pack.readinessChecklist.length > 0, 'readinessChecklist must be non-empty');
console.log('  PASS: readinessChecklist non-empty');

assert.ok(Array.isArray(pack.safeInspectionCommands) && pack.safeInspectionCommands.length > 0, 'safeInspectionCommands must be non-empty');
console.log('  PASS: safeInspectionCommands non-empty');

assert.ok(Array.isArray(pack.forbiddenActions) && pack.forbiddenActions.length > 0, 'forbiddenActions must be non-empty');
assert.ok(pack.forbiddenActions.some(a => a.toLowerCase().includes('workflow') || a.toLowerCase().includes('edit')), 'forbiddenActions must mention workflow edit');
console.log('  PASS: forbiddenActions correct');

assert.ok(Array.isArray(pack.migrationPlan) && pack.migrationPlan.length > 0, 'migrationPlan must be non-empty');
console.log('  PASS: migrationPlan non-empty');

assert.ok(pack.rollbackPlan, 'rollbackPlan must be present');
assert.ok(pack.rollbackPlan.beforeEdit, 'rollbackPlan.beforeEdit must be present');
console.log('  PASS: rollbackPlan present');

assert.ok(Array.isArray(pack.blockerItems), 'blockerItems must be array');
console.log('  PASS: blockerItems array');

assert.ok(Array.isArray(pack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(pack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
assert.ok(pack.dangerousActionsDenied.some(a => a.toLowerCase().includes('workflow')), 'workflow edit must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(pack.node24ReadinessPassed, true, 'node24ReadinessPassed must be true when no blockers');
console.log('  PASS: node24ReadinessPassed true');

assert.ok(pack.recommendedNextAction, 'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

assert.strictEqual(pack.noWorkflowEdit, true, 'noWorkflowEdit must be true');
assert.strictEqual(pack.noRealPush, true, 'noRealPush must be true');
assert.strictEqual(pack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- with blockers ----
const blockedPack = tool.buildNode24ReadinessPack({
  currentNodeVersion:  '20',
  targetNodeVersion:   '24',
  localVerifyFailed:   true,
  humanReviewPending:  true
});
assert.ok(blockedPack.blockerItems.length > 0, 'blockerItems must be non-empty when blockers present');
assert.strictEqual(blockedPack.node24ReadinessPassed, false, 'node24ReadinessPassed must be false when blockers present');
console.log('  PASS: blockers handled correctly');

console.log('PASS: github-actions-node24-readiness-pack');
