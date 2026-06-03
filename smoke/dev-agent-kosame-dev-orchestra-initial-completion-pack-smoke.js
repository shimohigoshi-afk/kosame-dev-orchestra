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
const tool   = require('../tools/kosame-dev-orchestra-initial-completion-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== kosame-dev-orchestra-initial-completion-pack smoke ===');

assert.ok(compareVersion(pkg.version, '40.0.0') >= 0, `pkg version must be >= 40.0.0, got ${pkg.version}`);
console.log('  PASS: package version 40.0.0 or later');

assert.ok(pkg.scripts['smoke:kosame-dev-orchestra-initial-completion-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:kosame-dev-orchestra-initial-completion-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v40.0.0-release-record.md')), 'v40 release record must exist');
console.log('  PASS: v40 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/kosame-dev-orchestra-initial-completion.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '40.0.0', 'tool version must be 40.0.0');
console.log('  PASS: tool meta version 40.0.0');

// ---- all criteria passed → initialCompletionPassed true ----
const completionPack = tool.buildInitialCompletion({
  flags: {
    dryRunDesign:            true,
    humanApprovalGates:      true,
    dangerousActionsBlocked: true,
    reviewAndGatePresent:    true,
    operatingManualPresent:  true,
    githubActionsReady:      true
  }
});

assert.strictEqual(completionPack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(completionPack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(completionPack.initialCompletionId, 'initialCompletionId must be present');
console.log('  PASS: initialCompletionId present');

assert.strictEqual(completionPack.completionVersion, '40.0.0', 'completionVersion must be 40.0.0');
console.log('  PASS: completionVersion correct');

assert.ok(Array.isArray(completionPack.completedCapabilities) && completionPack.completedCapabilities.length >= 8, 'completedCapabilities must have 8+ items');
assert.ok(completionPack.completedCapabilities.every(c => c.status === 'complete'), 'all capabilities must be complete');
console.log('  PASS: completedCapabilities all complete');

assert.ok(Array.isArray(completionPack.versionMilestoneSummary) && completionPack.versionMilestoneSummary.length >= 8, 'versionMilestoneSummary must have 8 entries');
assert.ok(completionPack.versionMilestoneSummary.some(s => s.includes('v36')), 'versionMilestoneSummary must include v36–v40');
console.log('  PASS: versionMilestoneSummary covers all phases');

assert.ok(Array.isArray(completionPack.endToEndOperationFlow) && completionPack.endToEndOperationFlow.length > 0, 'endToEndOperationFlow must be non-empty');
console.log('  PASS: endToEndOperationFlow present');

assert.ok(completionPack.safetyBoundary, 'safetyBoundary must be present');
assert.ok(completionPack.safetyBoundary.dryRunDesign, 'safetyBoundary.dryRunDesign must be present');
assert.ok(completionPack.safetyBoundary.deployBlocked, 'safetyBoundary.deployBlocked must be present');
assert.ok(completionPack.safetyBoundary.secretBlocked, 'safetyBoundary.secretBlocked must be present');
console.log('  PASS: safetyBoundary correct');

assert.ok(completionPack.humanApprovalContract, 'humanApprovalContract must be present');
assert.ok(completionPack.humanApprovalContract.junyaYes, 'humanApprovalContract.junyaYes must be present');
console.log('  PASS: humanApprovalContract present');

assert.ok(completionPack.providerRoleMap, 'providerRoleMap must be present');
const requiredProviders = ['じゅんやさん (Human)', 'Kosame/GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Kimi', 'Cloud Shell'];
for (const provider of requiredProviders) {
  assert.ok(completionPack.providerRoleMap[provider], `providerRoleMap must include ${provider}`);
}
console.log('  PASS: providerRoleMap has all 8 providers');

assert.ok(completionPack.productRepoOperationReadiness, 'productRepoOperationReadiness must be present');
assert.ok(completionPack.productRepoOperationReadiness['email_reply_bot'], 'email_reply_bot must be in productRepoOperationReadiness');
assert.strictEqual(completionPack.productRepoOperationReadiness['email_reply_bot'].readyForFirstTask, true, 'email_reply_bot must be ready for first task');
assert.strictEqual(completionPack.productRepoOperationReadiness['anesty_board'].readyForFirstTask, false, 'anesty_board must NOT be ready (high-risk)');
console.log('  PASS: productRepoOperationReadiness correct');

assert.ok(completionPack.githubActionsReadiness, 'githubActionsReadiness must be present');
assert.ok(completionPack.githubActionsReadiness.status, 'githubActionsReadiness.status must be present');
console.log('  PASS: githubActionsReadiness present');

assert.ok(completionPack.manualReadiness, 'manualReadiness must be present');
assert.strictEqual(completionPack.manualReadiness.status, 'complete', 'manualReadiness.status must be complete');
console.log('  PASS: manualReadiness complete');

assert.ok(Array.isArray(completionPack.initialCompletionCriteria), 'initialCompletionCriteria must be array');
assert.ok(completionPack.initialCompletionCriteria.every(c => c.passed), 'all criteria must pass when all flags set');
console.log('  PASS: initialCompletionCriteria all passed');

assert.ok(Array.isArray(completionPack.knownLimitations) && completionPack.knownLimitations.length > 0, 'knownLimitations must be non-empty');
console.log('  PASS: knownLimitations present');

assert.ok(Array.isArray(completionPack.nextPhasePlan) && completionPack.nextPhasePlan.length > 0, 'nextPhasePlan must be non-empty');
assert.ok(completionPack.nextPhasePlan[0].version.includes('41'), 'nextPhasePlan first item must be v41');
console.log('  PASS: nextPhasePlan correct');

assert.strictEqual(completionPack.initialCompletionPassed, true, 'initialCompletionPassed must be true when all criteria pass');
console.log('  PASS: initialCompletionPassed true');

assert.ok(Array.isArray(completionPack.finalDecisionOptions), 'finalDecisionOptions must be array');
assert.ok(completionPack.finalDecisionOptions.includes('approve'), 'approve in finalDecisionOptions');
assert.strictEqual(completionPack.finalDecision, 'approve', 'finalDecision must be approve');
console.log('  PASS: finalDecision approve');

assert.ok(Array.isArray(completionPack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(completionPack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
assert.ok(completionPack.dangerousActionsDenied.some(a => a.includes('secret')), 'secret read must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(completionPack.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(completionPack.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(completionPack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- with failed criterion → initialCompletionPassed false ----
const failedPack = tool.buildInitialCompletion({
  flags: { dryRunDesign: true, humanApprovalGates: false, dangerousActionsBlocked: true, reviewAndGatePresent: true, operatingManualPresent: false, githubActionsReady: true }
});
assert.strictEqual(failedPack.initialCompletionPassed, false, 'initialCompletionPassed must be false when criteria fail');
assert.ok(failedPack.initialCompletionCriteria.some(c => !c.passed), 'some criteria must be failed');
assert.strictEqual(failedPack.finalDecision, 'revise', 'finalDecision must be revise when not complete');
console.log('  PASS: failed criteria → initialCompletionPassed false + revise');

console.log('PASS: kosame-dev-orchestra-initial-completion-pack');
