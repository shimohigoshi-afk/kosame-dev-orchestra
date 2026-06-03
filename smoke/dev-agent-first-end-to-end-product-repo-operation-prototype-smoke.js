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
const tool   = require('../tools/first-end-to-end-product-repo-operation-prototype-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-end-to-end-product-repo-operation-prototype smoke ===');

assert.ok(compareVersion(pkg.version, '30.0.0') >= 0, `pkg version must be >= 30.0.0, got ${pkg.version}`);
console.log('  PASS: package version 30.0.0 or later');

assert.ok(pkg.scripts['smoke:first-end-to-end-product-repo-operation-prototype'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-end-to-end-product-repo-operation-prototype'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v30.0.0-release-record.md')), 'v30 release record must exist');
console.log('  PASS: v30 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-end-to-end-product-repo-operation-prototype.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '30.0.0', 'tool version must be 30.0.0');
console.log('  PASS: tool meta version 30.0.0');

// ---- all stages provided (clean E2E) ----
const e2ePack = tool.buildE2EPrototype({
  targetProduct: 'sales_dx',
  stageInputs: {
    intakeOutput:           'intake confirmed',
    taskPacketOutput:       'task packet generated',
    connectionBridgeOutput: 'bridge ready',
    workOrderOutput:        'work order generated',
    preflightOutput:        'preflight passed',
    executionPromptOutput:  'execution prompt ready',
    dryRunDispatchOutput:   'dispatch console ready',
    handoffImportOutput:    'handoff import passed',
    resultReviewOutput:     'result review: approve',
    commitCandidateOutput:  'pending human YES'
  }
});

assert.strictEqual(e2ePack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(e2ePack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(e2ePack.operationPrototypeId, 'operationPrototypeId must be present');
console.log('  PASS: operationPrototypeId present');

assert.ok(Array.isArray(e2ePack.supportedProductTypes) && e2ePack.supportedProductTypes.length === 5, 'supportedProductTypes must have 5 products');
for (const p of ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent']) {
  assert.ok(e2ePack.supportedProductTypes.includes(p), `${p} must be in supportedProductTypes`);
}
console.log('  PASS: all 5 product types in supportedProductTypes');

assert.ok(Array.isArray(e2ePack.endToEndFlow) && e2ePack.endToEndFlow.length === 10, 'endToEndFlow must have 10 stages');
console.log('  PASS: endToEndFlow has 10 stages');

assert.ok(e2ePack.providerRoleMap, 'providerRoleMap must be present');
const requiredProviders = ['Kosame/GPT', 'Claude', 'Gemini', 'Grok', 'DeepSeek', 'Kimi', 'Cloud Shell', 'Human'];
for (const provider of requiredProviders) {
  assert.ok(e2ePack.providerRoleMap[provider], `providerRoleMap must include ${provider}`);
  assert.ok(Array.isArray(e2ePack.providerRoleMap[provider]) && e2ePack.providerRoleMap[provider].length > 0,
    `providerRoleMap[${provider}] must be non-empty array`);
}
console.log('  PASS: providerRoleMap has all 8 providers');

assert.ok(e2ePack.humanApprovalContract, 'humanApprovalContract must be present');
assert.ok(Array.isArray(e2ePack.humanApprovalContract.requiredFor), 'humanApprovalContract.requiredFor must be array');
assert.ok(Array.isArray(e2ePack.humanApprovalContract.approvalChain), 'humanApprovalContract.approvalChain must be array');
console.log('  PASS: humanApprovalContract complete');

assert.ok(e2ePack.safetyBoundary, 'safetyBoundary must be present');
assert.ok(e2ePack.safetyBoundary.noRealDeploy, 'safetyBoundary.noRealDeploy must be present');
assert.ok(e2ePack.safetyBoundary.noSecretRead, 'safetyBoundary.noSecretRead must be present');
console.log('  PASS: safetyBoundary correct');

assert.ok(e2ePack.secretBoundary, 'secretBoundary must be present');
assert.strictEqual(e2ePack.secretBoundary.status, 'enforced', 'secretBoundary.status must be enforced');
console.log('  PASS: secretBoundary enforced');

assert.ok(e2ePack.customerDataBoundary, 'customerDataBoundary must be present');
assert.strictEqual(e2ePack.customerDataBoundary.status, 'enforced', 'customerDataBoundary.status must be enforced');
console.log('  PASS: customerDataBoundary enforced');

assert.ok(Array.isArray(e2ePack.allowedOperationModes) && e2ePack.allowedOperationModes.length > 0, 'allowedOperationModes must be non-empty');
console.log('  PASS: allowedOperationModes present');

assert.ok(Array.isArray(e2ePack.blockedOperationModes) && e2ePack.blockedOperationModes.length > 0, 'blockedOperationModes must be non-empty');
assert.ok(e2ePack.blockedOperationModes.includes('direct_deploy'), 'direct_deploy must be blocked');
assert.ok(e2ePack.blockedOperationModes.includes('auto_push'), 'auto_push must be blocked');
assert.ok(e2ePack.blockedOperationModes.includes('secret_inspection'), 'secret_inspection must be blocked');
assert.ok(e2ePack.blockedOperationModes.includes('customer_data_scan'), 'customer_data_scan must be blocked');
console.log('  PASS: blockedOperationModes correct');

assert.ok(Array.isArray(e2ePack.stageOutputs) && e2ePack.stageOutputs.length === 10, 'stageOutputs must have 10 items');
console.log('  PASS: stageOutputs has 10 items');

assert.ok(Array.isArray(e2ePack.stageBlockers), 'stageBlockers must be array');
assert.strictEqual(e2ePack.stageBlockers.length, 0, 'stageBlockers must be empty for clean E2E');
console.log('  PASS: stageBlockers empty for clean E2E');

assert.ok(e2ePack.commitCandidateDecision, 'commitCandidateDecision must be present');
assert.ok(e2ePack.commitCandidateDecision.humanApprovalRequired, 'commitCandidateDecision.humanApprovalRequired must be true');
console.log('  PASS: commitCandidateDecision present');

assert.ok(Array.isArray(e2ePack.nextVersionCandidates) && e2ePack.nextVersionCandidates.length > 0, 'nextVersionCandidates must be non-empty');
console.log('  PASS: nextVersionCandidates present');

assert.strictEqual(e2ePack.productRepoOperationPrototypePassed, true, 'productRepoOperationPrototypePassed must be true for clean E2E');
console.log('  PASS: productRepoOperationPrototypePassed true');

assert.ok(Array.isArray(e2ePack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(e2ePack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
assert.ok(e2ePack.dangerousActionsDenied.some(a => a.includes('secret')), 'secret read must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(e2ePack.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(e2ePack.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(e2ePack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- blocker → prototype failed ----
const blockedE2E = tool.buildE2EPrototype({
  targetProduct: 'anesty_board',
  stageInputs: { secretFound: true }
});
assert.ok(blockedE2E.stageBlockers.length > 0, 'stageBlockers must be non-empty when secret found');
assert.strictEqual(blockedE2E.productRepoOperationPrototypePassed, false, 'productRepoOperationPrototypePassed must be false when blocked');
assert.strictEqual(blockedE2E.commitCandidateDecision.decision, 'blocked', 'commitCandidateDecision.decision must be blocked');
console.log('  PASS: blocker (secret found) → prototype failed');

// ---- unknown product ----
const unknownE2E = tool.buildE2EPrototype({ targetProduct: 'unknown_xyz' });
assert.strictEqual(unknownE2E.productRepoOperationPrototypePassed, false, 'productRepoOperationPrototypePassed must be false for unknown product');
console.log('  PASS: unknown product → prototype failed');

// ---- all 5 products generate prototype ----
for (const p of tool.SUPPORTED_PRODUCT_TYPES) {
  const proto = tool.buildE2EPrototype({ targetProduct: p });
  assert.ok(proto.operationPrototypeId, `${p} must have operationPrototypeId`);
  assert.strictEqual(proto.dryRun, true, `${p} must have dryRun true`);
}
console.log('  PASS: all 5 products generate E2E prototype');

console.log('PASS: first-end-to-end-product-repo-operation-prototype');
