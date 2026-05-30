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
const tool   = require('../tools/result-import-review-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== result-import-review-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.3.0') >= 0, `package version must be 7.3.0+, got ${pkg.version}`);
console.log('  PASS: package version 7.3.0 or later');

assert.ok(pkg.scripts['smoke:result-import-review-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.3.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/result-import-review.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.3.0', 'tool meta version must be 7.3.0');
console.log('  PASS: tool meta version 7.3.0');

// Basic packet
const packet = tool.buildPacket({
  providerResult: 'PASS: all smoke tests passed. npm run verify: OK. Files changed: tools/example.js',
  provider:       'claude',
  taskGoal:       'implement release note generator',
  taskType:       'implementation',
  productLine:    'backoffice'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.importId, 'importId must be present');
assert.ok(packet.normalizedResult, 'normalizedResult must be present');
assert.ok(packet.reviewDecision, 'reviewDecision must be present');
console.log('  PASS: importId, normalizedResult, reviewDecision present');

// Detect success
assert.strictEqual(packet.reviewDecision.status, 'success', `success result must detect status=success, got: ${packet.reviewDecision.status}`);
console.log('  PASS: result import detects success');

// Detect failure
const failurePacket = tool.buildPacket({
  providerResult: 'AssertionError: expected true got false\nnpm ERR! Test failed',
  provider:       'claude',
  taskGoal:       'implement feature',
  taskType:       'implementation',
  productLine:    'backoffice'
});
assert.strictEqual(failurePacket.reviewDecision.status, 'failure', `failure result must detect status=failure, got: ${failurePacket.reviewDecision.status}`);
console.log('  PASS: result import detects failure');

// Detect incomplete
const incompletePacket = tool.buildPacket({
  providerResult: 'Task started. TODO: implement the main function. WIP.',
  provider:       'gemini',
  taskGoal:       'write draft doc',
  taskType:       'draft',
  productLine:    'backoffice'
});
assert.ok(
  incompletePacket.reviewDecision.status === 'incomplete' || incompletePacket.reviewDecision.issues.some(i => i.type === 'incomplete'),
  `incomplete result must detect status=incomplete or issue type=incomplete, got: ${incompletePacket.reviewDecision.status}`
);
console.log('  PASS: result import detects incomplete');

// requiresRepair flag
assert.ok(failurePacket.reviewDecision.requiresRepair, 'failure must set requiresRepair=true');
console.log('  PASS: requiresRepair flag set on failure');

// recommendedNextAction
assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

// blockedDangerousActions
assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'), 'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions present');

// product lines
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

// anesty_board requiresHumanApproval
const anestyPacket = tool.buildPacket({
  providerResult: 'PASS',
  provider: 'kosame',
  taskGoal: 'review health data',
  taskType: 'review',
  productLine: 'anesty_board'
});
assert.ok(anestyPacket.reviewDecision.requiresHumanApproval, 'anesty_board must requiresHumanApproval');
console.log('  PASS: anesty_board result requires human approval');

console.log('PASS: result-import-review-pack');
