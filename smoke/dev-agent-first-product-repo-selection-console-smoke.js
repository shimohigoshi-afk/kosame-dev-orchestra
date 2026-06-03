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
const tool   = require('../tools/first-product-repo-selection-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-selection-console smoke ===');

assert.ok(compareVersion(pkg.version, '32.0.0') >= 0, `pkg version must be >= 32.0.0, got ${pkg.version}`);
console.log('  PASS: package version 32.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-selection-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-selection-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v32.0.0-release-record.md')), 'v32 release record must exist');
console.log('  PASS: v32 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-selection-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '32.0.0', 'tool version must be 32.0.0');
console.log('  PASS: tool meta version 32.0.0');

// ---- auto recommendation ----
const autoPack = tool.buildSelectionConsole({});

assert.strictEqual(autoPack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(autoPack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(autoPack.repoSelectionId, 'repoSelectionId must be present');
console.log('  PASS: repoSelectionId present');

assert.ok(Array.isArray(autoPack.productCandidates) && autoPack.productCandidates.length === 5, 'productCandidates must have 5 products');
console.log('  PASS: productCandidates has 5 products');

for (const p of ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent']) {
  assert.ok(autoPack.productCandidates.some(c => c.product === p), `${p} must be in productCandidates`);
}
console.log('  PASS: all 5 products in productCandidates');

assert.ok(autoPack.recommendedFirstProduct, 'recommendedFirstProduct must be present');
assert.ok(autoPack.recommendedFirstProduct.product, 'recommendedFirstProduct.product must be present');
console.log('  PASS: recommendedFirstProduct present');

assert.ok(autoPack.selectionReason, 'selectionReason must be present');
console.log('  PASS: selectionReason present');

assert.ok(['low', 'medium', 'high'].includes(autoPack.businessImpact), 'businessImpact must be low/medium/high');
assert.ok(['low', 'medium', 'high'].includes(autoPack.implementationRisk), 'implementationRisk must be low/medium/high');
assert.ok(['low', 'medium', 'high'].includes(autoPack.safetyRisk), 'safetyRisk must be low/medium/high');
console.log('  PASS: risk/impact levels valid');

assert.ok(Array.isArray(autoPack.holdProducts), 'holdProducts must be array');
assert.ok(autoPack.holdProducts.some(p => p.product === 'anesty_board'), 'anesty_board must be in holdProducts');
console.log('  PASS: anesty_board in holdProducts');

assert.ok(Array.isArray(autoPack.requiredHumanInputs) && autoPack.requiredHumanInputs.length > 0, 'requiredHumanInputs must be non-empty');
console.log('  PASS: requiredHumanInputs non-empty');

assert.ok(Array.isArray(autoPack.decisionOptions), 'decisionOptions must be array');
assert.ok(autoPack.decisionOptions.includes('approve'), 'approve must be in decisionOptions');
assert.ok(autoPack.decisionOptions.includes('hold'), 'hold must be in decisionOptions');
console.log('  PASS: decisionOptions has approve and hold');

assert.ok(Array.isArray(autoPack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(autoPack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(autoPack.noRealRepoAccess, true, 'noRealRepoAccess must be true');
assert.strictEqual(autoPack.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(autoPack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- human selects email_reply_bot ----
const humanPack = tool.buildSelectionConsole({
  providedHumanInputs: ['selectedProduct', 'businessPriorityConfirmed', 'firstTaskScopeConfirmed'],
  selectedProduct:     'email_reply_bot',
  overrideReason:      'Email Reply BOT is safest first target'
});
assert.strictEqual(humanPack.recommendedFirstProduct.product, 'email_reply_bot', 'selected product must be email_reply_bot');
assert.strictEqual(humanPack.selectionReady, true, 'selectionReady must be true when product selected');
console.log('  PASS: human selection of email_reply_bot works');

// ---- anesty_board must have high safetyRisk ----
const anestyProfile = tool.PRODUCT_PROFILES['anesty_board'];
assert.ok(anestyProfile, 'anesty_board must be in PRODUCT_PROFILES');
assert.strictEqual(anestyProfile.safetyRisk, 'high', 'anesty_board safetyRisk must be high');
assert.strictEqual(anestyProfile.regulatedData, true, 'anesty_board regulatedData must be true');
assert.strictEqual(anestyProfile.firstTouchSuitability, 'low', 'anesty_board firstTouchSuitability must be low');
console.log('  PASS: anesty_board correctly marked as high-risk regulated');

console.log('PASS: first-product-repo-selection-console');
