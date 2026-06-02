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
const tool   = require('../tools/product-verification-handoff-collector-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-verification-handoff-collector-pack smoke ===');

assert.ok(compareVersion(pkg.version, '18.5.0') >= 0, `pkg version must be >= 18.5.0, got ${pkg.version}`);
console.log('  PASS: package version 18.5.0 or later');

assert.ok(pkg.scripts['smoke:product-verification-handoff-collector'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-verification-handoff-collector'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v18.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-verification-handoff-collector.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '18.5.0', 'tool version must be 18.5.0');
console.log('  PASS: tool meta version 18.5.0');

const resultPass = tool.buildHandoffCollector({
  taskGoal:        'CSVエクスポート機能追加',
  productType:     'sales_dx',
  editedFiles:     ['src/leads/csv-export.js'],
  diffSummaryRaw:  '1 file changed, 30 insertions(+)',
  nodeCheckRaw:    'ok',
  npmVerifyRaw:    'All tests passed.',
  productSmokeRaw: 'PASS: all smoke',
  rollbackNote:    'git checkout -- src/leads/csv-export.js'
});

assert.strictEqual(resultPass.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(resultPass.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(resultPass.verificationCollectorId, 'verificationCollectorId must be present');
console.log('  PASS: verificationCollectorId present');

assert.ok(resultPass.diffSummary?.present, 'diffSummary.present must be true');
console.log('  PASS: diffSummary.present true');

assert.strictEqual(resultPass.nodeCheckResult?.passed, true, 'nodeCheckResult.passed must be true');
console.log('  PASS: nodeCheckResult.passed true');

assert.strictEqual(resultPass.npmVerifyResult?.passed, true, 'npmVerifyResult.passed must be true');
console.log('  PASS: npmVerifyResult.passed true');

assert.strictEqual(resultPass.productSmokeResult?.passed, true, 'productSmokeResult.passed must be true');
console.log('  PASS: productSmokeResult.passed true');

assert.strictEqual(resultPass.allPassed, true, 'allPassed must be true');
console.log('  PASS: allPassed true');

assert.ok(resultPass.handoffToKosame,  'handoffToKosame must be present');
assert.ok(resultPass.handoffToGemini,  'handoffToGemini must be present');
assert.ok(resultPass.handoffToGrok,    'handoffToGrok must be present');
console.log('  PASS: all handoff notes present');

assert.ok(resultPass.handoffToKosame.status === 'READY',  'handoffToKosame.status must be READY when all passed');
console.log('  PASS: handoffToKosame.status READY');

assert.ok(Array.isArray(resultPass.remainingRisks) && resultPass.remainingRisks.length === 0, 'remainingRisks must be empty when all passed');
console.log('  PASS: no remaining risks when all passed');

// fail case
const resultFail = tool.buildHandoffCollector({ taskGoal: 'test fail', productType: 'sales_dx' });
assert.strictEqual(resultFail.allPassed, false, 'allPassed must be false when no inputs');
assert.ok(resultFail.remainingRisks.length > 0, 'remainingRisks must be populated for failures');
assert.ok(resultFail.handoffToKosame.status === 'NEEDS_REVIEW', 'handoffToKosame.status must be NEEDS_REVIEW on fail');
console.log('  PASS: failure case handled correctly');

assert.ok(Array.isArray(tool.DANGEROUS_ACTIONS_DENIED), 'dangerousActionsDenied must be array');
assert.ok(tool.DANGEROUS_ACTIONS_DENIED.includes('git commit'), 'must include git commit');
assert.ok(tool.DANGEROUS_ACTIONS_DENIED.includes('deploy'),     'must include deploy');
console.log('  PASS: dangerousActionsDenied valid');

assert.strictEqual(resultPass.noRealCommit, true);
assert.strictEqual(resultPass.noRealPush,   true);
assert.strictEqual(resultPass.noRealDeploy, true);
console.log('  PASS: no real git/deploy flags');

console.log('PASS: product-verification-handoff-collector-pack');
