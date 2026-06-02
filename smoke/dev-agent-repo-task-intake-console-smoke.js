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
const tool   = require('../tools/repo-task-intake-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== repo-task-intake-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '16.5.0') >= 0, `pkg version must be >= 16.5.0, got ${pkg.version}`);
console.log('  PASS: package version 16.5.0 or later');

assert.ok(pkg.scripts['smoke:repo-task-intake-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:repo-task-intake-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v16.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/repo-task-intake-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '16.5.0', 'tool version must be 16.5.0');
console.log('  PASS: tool meta version 16.5.0');

const packet = tool.buildIntakePacket({
  requestedProduct: 'sales_dx',
  taskType: 'feature',
  taskGoal: '営業DXリード管理画面にCSVエクスポート機能を追加する',
  expectedOutputs: ['feature implementation', 'tests']
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.intakeId, 'intakeId must be present');
console.log('  PASS: intakeId present');

assert.strictEqual(packet.requestedProduct, 'sales_dx', 'requestedProduct must match');
console.log('  PASS: requestedProduct correct');

assert.ok(packet.targetRepoCandidate, 'targetRepoCandidate must be present');
console.log('  PASS: targetRepoCandidate present');

assert.ok(packet.taskGoal, 'taskGoal must be present');
console.log('  PASS: taskGoal present');

assert.ok(['low', 'medium', 'high'].includes(packet.riskLevel), 'riskLevel must be valid');
console.log('  PASS: riskLevel valid');

assert.ok(['A', 'B', 'C'].includes(packet.dataLevel), 'dataLevel must be valid');
console.log('  PASS: dataLevel valid');

assert.ok(Array.isArray(packet.expectedOutputs), 'expectedOutputs must be array');
console.log('  PASS: expectedOutputs array');

assert.strictEqual(packet.rejectedIfIncludesSecrets, true, 'rejectedIfIncludesSecrets must be true');
console.log('  PASS: rejectedIfIncludesSecrets true');

assert.ok(Array.isArray(packet.rejectedItems), 'rejectedItems must be array');
assert.strictEqual(packet.rejectedItems.length, 0, 'no rejected items for clean request');
console.log('  PASS: no rejected items');

assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be string');
console.log('  PASS: recommendedNextAction present');

assert.strictEqual(packet.noRealRepoAccess, true, 'noRealRepoAccess must be true');
assert.strictEqual(packet.noRealExecution, true, 'noRealExecution must be true');
console.log('  PASS: no real execution flags');

// rejected case
const rejected = tool.buildIntakePacket({
  requestedProduct: 'sales_dx',
  taskGoal:         'API keyをファイルに書き込む'
});
assert.ok(rejected.rejectedItems.length > 0, 'rejected items must be detected for sensitive request');
assert.strictEqual(rejected.intakeValid, false, 'intakeValid must be false for rejected request');
console.log('  PASS: sensitive request detection works');

// unknown product
const unknown = tool.buildIntakePacket({ requestedProduct: 'unknown_xyz', taskGoal: 'test' });
assert.strictEqual(unknown.isKnownProduct, false, 'isKnownProduct must be false for unknown');
console.log('  PASS: unknown product detection works');

assert.ok(Array.isArray(tool.SUPPORTED_PRODUCTS) && tool.SUPPORTED_PRODUCTS.length >= 5, 'at least 5 products');
assert.ok(tool.SUPPORTED_PRODUCTS.includes('sales_dx'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('anesty_board'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('backoffice_agent'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('email_reply_bot'));
assert.ok(tool.SUPPORTED_PRODUCTS.includes('cloud_run_pm_agent'));
console.log('  PASS: all 5 product types supported');

console.log('PASS: repo-task-intake-console-pack');
