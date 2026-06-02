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
const tool   = require('../tools/productization-prototype-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== productization-prototype-pack smoke ===');

assert.ok(compareVersion(pkg.version, '20.0.0') >= 0, `pkg version must be >= 20.0.0, got ${pkg.version}`);
console.log('  PASS: package version 20.0.0 or later');

assert.ok(pkg.scripts['smoke:productization-prototype-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:productization-prototype-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v20.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/productization-prototype.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '20.0.0', 'tool version must be 20.0.0');
console.log('  PASS: tool meta version 20.0.0');

const packet = tool.buildPrototypePack({ verifyPassed: true, allFlowsReady: true, readinessReviewPassed: true });

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.prototypeId, 'prototypeId must be present');
console.log('  PASS: prototypeId present');

assert.ok(Array.isArray(packet.supportedProductTypes) && packet.supportedProductTypes.length >= 5, 'supportedProductTypes must have >= 5 items');
assert.ok(packet.supportedProductTypes.includes('sales_dx'));
assert.ok(packet.supportedProductTypes.includes('anesty_board'));
assert.ok(packet.supportedProductTypes.includes('backoffice_agent'));
assert.ok(packet.supportedProductTypes.includes('email_reply_bot'));
assert.ok(packet.supportedProductTypes.includes('cloud_run_pm_agent'));
console.log('  PASS: all 5 product types in supportedProductTypes');

assert.ok(Array.isArray(packet.intakeToReleaseFlow) && packet.intakeToReleaseFlow.length === 8, 'intakeToReleaseFlow must have 8 steps');
const steps = packet.intakeToReleaseFlow.map(s => s.step);
for (let i = 1; i <= 8; i++) assert.ok(steps.includes(i), `step ${i} must be present`);
console.log('  PASS: intakeToReleaseFlow has 8 steps');

assert.ok(packet.providerRoleMap, 'providerRoleMap must be present');
const providers = Object.keys(packet.providerRoleMap);
assert.ok(providers.includes('Kosame/GPT'),  'providerRoleMap must include Kosame/GPT');
assert.ok(providers.includes('Claude'),      'providerRoleMap must include Claude');
assert.ok(providers.includes('Gemini'),      'providerRoleMap must include Gemini');
assert.ok(providers.includes('Grok'),        'providerRoleMap must include Grok');
assert.ok(providers.includes('DeepSeek'),    'providerRoleMap must include DeepSeek');
assert.ok(providers.includes('Kimi'),        'providerRoleMap must include Kimi');
assert.ok(providers.includes('Cloud Shell'), 'providerRoleMap must include Cloud Shell');
assert.ok(providers.includes('Human'),       'providerRoleMap must include Human');
console.log('  PASS: providerRoleMap includes all 8 providers');

assert.ok(packet.humanApprovalContract, 'humanApprovalContract must be present');
assert.strictEqual(packet.humanApprovalContract.humanApprovalRequired, true, 'humanApprovalRequired in contract must be true');
assert.ok(packet.humanApprovalContract.neverAutoApproved?.includes('git commit'), 'neverAutoApproved must include git commit');
assert.ok(packet.humanApprovalContract.neverAutoApproved?.includes('git push'),   'neverAutoApproved must include git push');
assert.ok(packet.humanApprovalContract.neverAutoApproved?.includes('git tag'),    'neverAutoApproved must include git tag');
assert.ok(packet.humanApprovalContract.neverAutoApproved?.includes('gcloud deploy'), 'neverAutoApproved must include gcloud deploy');
console.log('  PASS: humanApprovalContract valid');

assert.ok(packet.safetyBoundary, 'safetyBoundary must be present');
assert.strictEqual(packet.safetyBoundary.dryRunEnforced, true, 'dryRunEnforced must be true');
assert.strictEqual(packet.safetyBoundary.deployNeverAutomatic, true, 'deployNeverAutomatic must be true');
assert.strictEqual(packet.safetyBoundary.gitOpsNeverAutomatic, true, 'gitOpsNeverAutomatic must be true');
console.log('  PASS: safetyBoundary valid');

assert.ok(Array.isArray(packet.productRunbookIndex) && packet.productRunbookIndex.length >= 5, 'productRunbookIndex must have >= 5 entries');
console.log('  PASS: productRunbookIndex has >= 5 entries');

assert.ok(Array.isArray(packet.nextVersionCandidates) && packet.nextVersionCandidates.length > 0, 'nextVersionCandidates must be non-empty');
console.log('  PASS: nextVersionCandidates present');

assert.strictEqual(packet.productizationPrototypePassed, true, 'productizationPrototypePassed must be true when all pass');
console.log('  PASS: productizationPrototypePassed true');

// fail case
const failPacket = tool.buildPrototypePack({ verifyPassed: false });
assert.strictEqual(failPacket.productizationPrototypePassed, false, 'productizationPrototypePassed must be false when verify fails');
console.log('  PASS: productizationPrototypePassed false when verify fails');

assert.strictEqual(packet.noRealDeploy, true);
assert.strictEqual(packet.noRealGitOps, true);
assert.strictEqual(packet.noRealSecretAccess, true);
console.log('  PASS: no real ops flags');

console.log('PASS: productization-prototype-pack');
