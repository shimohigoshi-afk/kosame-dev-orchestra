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
const tool   = require('../tools/first-product-repo-operation-readiness-complete-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-operation-readiness-complete smoke ===');

assert.ok(compareVersion(pkg.version, '35.0.0') >= 0, `pkg version must be >= 35.0.0, got ${pkg.version}`);
console.log('  PASS: package version 35.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-operation-readiness-complete'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-operation-readiness-complete'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v35.0.0-release-record.md')), 'v35 release record must exist');
console.log('  PASS: v35 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-operation-readiness-complete.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '35.0.0', 'tool version must be 35.0.0');
console.log('  PASS: tool meta version 35.0.0');

const ALL_STAGES = [
  'v30_e2e_prototype', 'v31_node24_readiness', 'v32_repo_selection',
  'v33_first_touch_dry_run', 'v27_connection_bridge', 'v25_work_order',
  'v28_dry_run_dispatch', 'v34_launch_packet'
];

// ---- all stages complete → approve ----
const completePack = tool.buildReadinessComplete({
  targetProduct:    'email_reply_bot',
  completedStages:  ALL_STAGES,
  firstTaskCandidate:    'docs整備: README.md の目次・概要セクションを追加する',
  firstTaskRiskLevel:    'low',
  firstTaskAllowedScope: ['docs/**', 'README.md', 'smoke/**'],
  firstTaskForbiddenScope: ['.env*', 'secrets/**']
});

assert.strictEqual(completePack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(completePack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(completePack.readinessCompleteId, 'readinessCompleteId must be present');
console.log('  PASS: readinessCompleteId present');

assert.ok(Array.isArray(completePack.readinessStages) && completePack.readinessStages.length > 0, 'readinessStages must be non-empty');
console.log('  PASS: readinessStages non-empty');

assert.ok(Array.isArray(completePack.completedStages), 'completedStages must be array');
assert.ok(completePack.completedStages.length > 0, 'completedStages must be non-empty when all provided');
console.log('  PASS: completedStages non-empty');

assert.ok(Array.isArray(completePack.missingStages), 'missingStages must be array');
assert.strictEqual(completePack.missingStages.length, 0, 'missingStages must be empty when all stages complete');
console.log('  PASS: missingStages empty');

assert.ok(completePack.safetyBoundary, 'safetyBoundary must be present');
assert.ok(completePack.safetyBoundary.noRealDeploy, 'safetyBoundary.noRealDeploy must be present');
assert.ok(completePack.safetyBoundary.noSecretRead, 'safetyBoundary.noSecretRead must be present');
console.log('  PASS: safetyBoundary correct');

assert.ok(completePack.humanApprovalContract, 'humanApprovalContract must be present');
assert.ok(Array.isArray(completePack.humanApprovalContract.requiredFor), 'humanApprovalContract.requiredFor must be array');
console.log('  PASS: humanApprovalContract present');

assert.ok(completePack.firstTaskCandidate, 'firstTaskCandidate must be present');
assert.ok(['low', 'medium', 'high'].includes(completePack.firstTaskRiskLevel), 'firstTaskRiskLevel must be low/medium/high');
assert.ok(Array.isArray(completePack.firstTaskAllowedScope) && completePack.firstTaskAllowedScope.length > 0, 'firstTaskAllowedScope must be non-empty');
assert.ok(Array.isArray(completePack.firstTaskForbiddenScope) && completePack.firstTaskForbiddenScope.length > 0, 'firstTaskForbiddenScope must be non-empty');
console.log('  PASS: firstTask fields correct');

assert.ok(completePack.providerRoleMap, 'providerRoleMap must be present');
const requiredProviders = ['Kosame/GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Kimi', 'Cloud Shell', 'Human'];
for (const provider of requiredProviders) {
  assert.ok(completePack.providerRoleMap[provider], `providerRoleMap must include ${provider}`);
  assert.ok(Array.isArray(completePack.providerRoleMap[provider]) && completePack.providerRoleMap[provider].length > 0,
    `providerRoleMap[${provider}] must be non-empty`);
}
console.log('  PASS: providerRoleMap has all 8 providers');

assert.strictEqual(completePack.finalReadinessDecision, 'approve', 'finalReadinessDecision must be approve for complete low-risk product');
console.log('  PASS: finalReadinessDecision approve');

assert.ok(Array.isArray(completePack.decisionOptions), 'decisionOptions must be array');
assert.ok(completePack.decisionOptions.includes('approve'), 'approve in decisionOptions');
assert.ok(completePack.decisionOptions.includes('hold'), 'hold in decisionOptions');
assert.ok(completePack.decisionOptions.includes('revise'), 'revise in decisionOptions');
assert.ok(completePack.decisionOptions.includes('reject'), 'reject in decisionOptions');
console.log('  PASS: decisionOptions has all 4 options');

assert.ok(Array.isArray(completePack.nextVersionCandidates) && completePack.nextVersionCandidates.length > 0, 'nextVersionCandidates must be non-empty');
console.log('  PASS: nextVersionCandidates present');

assert.strictEqual(completePack.readyForFirstRealProductRepoTask, true, 'readyForFirstRealProductRepoTask must be true when all stages complete and low risk');
console.log('  PASS: readyForFirstRealProductRepoTask true');

assert.ok(Array.isArray(completePack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(completePack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(completePack.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(completePack.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(completePack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- anesty_board → hold ----
const anestyPack = tool.buildReadinessComplete({
  targetProduct:   'anesty_board',
  completedStages: ALL_STAGES
});
assert.strictEqual(anestyPack.finalReadinessDecision, 'hold', 'anesty_board must get hold decision');
assert.strictEqual(anestyPack.readyForFirstRealProductRepoTask, false, 'readyForFirstRealProductRepoTask must be false for high-risk product');
console.log('  PASS: anesty_board → hold + readyForFirstRealProductRepoTask false');

// ---- missing stages → revise ----
const incompletePack = tool.buildReadinessComplete({
  targetProduct:   'email_reply_bot',
  completedStages: ['v30_e2e_prototype']
});
assert.ok(incompletePack.missingStages.length > 0, 'missingStages must be non-empty when stages are missing');
assert.ok(['revise', 'reject'].includes(incompletePack.finalReadinessDecision), 'incomplete stages must result in revise or reject');
assert.strictEqual(incompletePack.readyForFirstRealProductRepoTask, false, 'readyForFirstRealProductRepoTask must be false when stages missing');
console.log('  PASS: missing stages → revise + readyForFirstRealProductRepoTask false');

// ---- unknown product → reject ----
const unknownPack = tool.buildReadinessComplete({ targetProduct: 'unknown_xyz', completedStages: ALL_STAGES });
assert.strictEqual(unknownPack.finalReadinessDecision, 'reject', 'unknown product must get reject decision');
assert.strictEqual(unknownPack.readyForFirstRealProductRepoTask, false, 'readyForFirstRealProductRepoTask must be false for unknown product');
console.log('  PASS: unknown product → reject');

// ---- all 5 products generate readiness packet ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const r = tool.buildReadinessComplete({ targetProduct: p, completedStages: [] });
  assert.ok(r.readinessCompleteId, `${p} must have readinessCompleteId`);
}
console.log('  PASS: all 5 products generate readiness complete packet');

console.log('PASS: first-product-repo-operation-readiness-complete');
