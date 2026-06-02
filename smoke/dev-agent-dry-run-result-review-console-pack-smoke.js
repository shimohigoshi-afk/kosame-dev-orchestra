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
const tool   = require('../tools/dry-run-result-review-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dry-run-result-review-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '14.0.0') >= 0, `package version must be 14.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 14.0.0 or later');

assert.ok(pkg.scripts['smoke:dry-run-result-review-console-pack'], 'smoke:dry-run-result-review-console-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:dry-run-result-review-console'], 'pm-agent:dry-run-result-review-console must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v13.5.0-release-record.md')),
  'v13.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dry-run-result-review-console.sample.json')),
  'fixture dry-run-result-review-console.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '13.5.0', 'tool meta version must be 13.5.0');
console.log('  PASS: tool meta version 13.5.0');

const packet = tool.buildReviewConsole({
  projectName:  'kosame-dev-orchestra',
  taskGoal:     'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  targetFiles:  ['README.md'],
  allowedFiles: ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'],
  deniedFiles:  ['./.env', './.env.*', './secrets/**', './credentials/**'],
  riskLevel:    'low',
  dataLevel:    'A',
  reviewMode:   'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.reviewConsoleId, 'reviewConsoleId must be present');
console.log('  PASS: reviewConsoleId present');

assert.ok(packet.inputSummary, 'inputSummary must be present');
console.log('  PASS: inputSummary present');

assert.ok(packet.generatedPacketSummary, 'generatedPacketSummary must be present');
console.log('  PASS: generatedPacketSummary present');

assert.ok(packet.providerRoleSummary, 'providerRoleSummary must be present');
console.log('  PASS: providerRoleSummary present');

assert.ok(packet.fileTouchSummary, 'fileTouchSummary must be present');
console.log('  PASS: fileTouchSummary present');

assert.ok(packet.safetyReview, 'safetyReview must be present');
console.log('  PASS: safetyReview present');

assert.ok(packet.approvalReadiness, 'approvalReadiness must be present');
console.log('  PASS: approvalReadiness present');

assert.ok(Array.isArray(packet.reviewerDecisionOptions), 'reviewerDecisionOptions must be array');
assert.ok(packet.reviewerDecisionOptions.includes('approve'), 'reviewerDecisionOptions must include approve');
assert.ok(packet.reviewerDecisionOptions.includes('revise'),  'reviewerDecisionOptions must include revise');
assert.ok(packet.reviewerDecisionOptions.includes('reject'),  'reviewerDecisionOptions must include reject');
assert.ok(packet.reviewerDecisionOptions.includes('hold'),    'reviewerDecisionOptions must include hold');
console.log('  PASS: reviewerDecisionOptions includes approve / revise / reject / hold');

assert.strictEqual(packet.reviewPassed, true, 'reviewPassed must be true');
console.log('  PASS: reviewPassed true');

assert.strictEqual(packet.noRealApiExecution, true, 'noRealApiExecution must be true');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.noRealFileEdit, true, 'noRealFileEdit must be true');
console.log('  PASS: no real file edit');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0,
  'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: dry-run-result-review-console-pack');
