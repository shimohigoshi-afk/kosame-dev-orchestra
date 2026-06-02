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
const tool   = require('../tools/post-edit-verification-collector-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== post-edit-verification-collector-pack smoke ===');

assert.ok(compareVersion(pkg.version, '15.5.0') >= 0, `package version must be 15.5.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 15.5.0 or later');

assert.ok(pkg.scripts['smoke:post-edit-verification-collector'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:post-edit-verification-collector'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v15.5.0-release-record.md')),
  'v15.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/post-edit-verification-collector.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '15.5.0', 'tool meta version must be 15.5.0');
console.log('  PASS: tool meta version 15.5.0');

// all-passed case
const resultPassed = tool.buildVerificationCollector({
  taskGoal:       'README.mdにv15.0.0の説明を追加した',
  editedFiles:    ['README.md'],
  diffSummaryRaw: '1 file changed, 5 insertions(+)',
  nodeCheckRaw:   'ok',
  verifyRaw:      'All smoke tests passed.',
  smokeRaw:       'PASS: all smoke',
  rollbackNote:   'git checkout -- README.md'
});

assert.strictEqual(resultPassed.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(resultPassed.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(resultPassed.collectorId, 'collectorId must be present');
console.log('  PASS: collectorId present');

assert.ok(resultPassed.diffSummary, 'diffSummary must be present');
assert.strictEqual(resultPassed.diffSummary.present, true, 'diffSummary.present must be true');
console.log('  PASS: diffSummary present');

assert.ok(resultPassed.nodeCheckResult, 'nodeCheckResult must be present');
assert.strictEqual(resultPassed.nodeCheckResult.passed, true, 'nodeCheckResult.passed must be true for ok input');
console.log('  PASS: nodeCheckResult.passed true');

assert.ok(resultPassed.verifyResult, 'verifyResult must be present');
assert.strictEqual(resultPassed.verifyResult.passed, true, 'verifyResult.passed must be true for pass input');
console.log('  PASS: verifyResult.passed true');

assert.ok(resultPassed.smokeResult, 'smokeResult must be present');
assert.strictEqual(resultPassed.smokeResult.passed, true, 'smokeResult.passed must be true for pass input');
console.log('  PASS: smokeResult.passed true');

assert.ok(Array.isArray(resultPassed.remainingRisks), 'remainingRisks must be array');
console.log('  PASS: remainingRisks is array');

assert.strictEqual(resultPassed.allPassed, true, 'allPassed must be true when all inputs pass');
console.log('  PASS: allPassed true');

assert.ok(typeof resultPassed.recommendedNextAction === 'string', 'recommendedNextAction must be string');
console.log('  PASS: recommendedNextAction present');

// failed case
const resultFailed = tool.buildVerificationCollector({
  taskGoal:       'test failed case',
  editedFiles:    ['README.md'],
  diffSummaryRaw: null,
  nodeCheckRaw:   'SyntaxError: ...',
  verifyRaw:      'npm ERR! exit code 1',
  smokeRaw:       'FAIL: test',
  rollbackNote:   ''
});

assert.strictEqual(resultFailed.allPassed, false, 'allPassed must be false when inputs fail');
console.log('  PASS: allPassed false for failed inputs');

assert.ok(resultFailed.remainingRisks.length > 0, 'remainingRisks must be non-empty for failures');
console.log('  PASS: remainingRisks populated for failures');

assert.strictEqual(resultFailed.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(resultFailed.noRealPush,   true, 'noRealPush must be true');
assert.strictEqual(resultFailed.noRealTag,    true, 'noRealTag must be true');
console.log('  PASS: no real git operation flags');

console.log('PASS: post-edit-verification-collector-pack');
