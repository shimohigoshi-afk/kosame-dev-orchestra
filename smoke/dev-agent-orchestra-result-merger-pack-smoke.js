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
const tool   = require('../tools/orchestra-result-merger-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== orchestra-result-merger-pack smoke ===');

assert.ok(compareVersion(pkg.version, '10.0.0') >= 0, `package version must be 10.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 10.0.0 or later');

assert.ok(pkg.scripts['smoke:orchestra-result-merger-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v9.0.0-release-record.md')),
  'v9.0.0 release record must exist'
);
console.log('  PASS: v9.0.0 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/orchestra-result-merger.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '9.0.0', 'tool meta version must be 9.0.0');
console.log('  PASS: tool meta version 9.0.0');

// Success case — all results OK
const successPacket = tool.buildPacket({
  geminiResult:        'Spec clarification complete. Fixtures generated. No concerns.',
  grokResult:          'Weakness analysis complete. No critical issues.',
  claudeResult:        'Implementation complete. All smoke tests pass. npm run verify: OK.',
  originalTask:        'implement release note generator',
  safetyBoundary:      { dataLevel: 'A', riskLevel: 'low' },
  verificationSummary: 'npm run verify PASS'
});

assert.strictEqual(successPacket.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(successPacket.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(successPacket.mergerId, 'mergerId must be present');
console.log('  PASS: mergerId present');

// mergeDecisionPacket
assert.ok(successPacket.mergeDecisionPacket, 'mergeDecisionPacket must be present');
assert.strictEqual(successPacket.mergeDecisionPacket.noRealFileMerge, true, 'noRealFileMerge must be true');
console.log('  PASS: result merger creates mergeDecisionPacket');
console.log('  PASS: result merger does not claim real file merge');

// normalizedResults
assert.ok(successPacket.normalizedResults, 'normalizedResults must be present');
assert.ok(successPacket.normalizedResults.gemini, 'normalizedResults.gemini must be present');
assert.ok(successPacket.normalizedResults.grok,   'normalizedResults.grok must be present');
assert.ok(successPacket.normalizedResults.claude,  'normalizedResults.claude must be present');
console.log('  PASS: normalizedResults has gemini/grok/claude');

// reviewDecision
assert.ok(typeof successPacket.reviewDecision === 'string', 'reviewDecision must be string');
assert.ok(tool.REVIEW_DECISIONS.includes(successPacket.reviewDecision), `reviewDecision must be valid: ${successPacket.reviewDecision}`);
console.log(`  PASS: reviewDecision is valid (${successPacket.reviewDecision})`);

// adoptedItems / rejectedItems / unresolvedItems
assert.ok(Array.isArray(successPacket.adoptedItems),    'adoptedItems must be array');
assert.ok(Array.isArray(successPacket.rejectedItems),   'rejectedItems must be array');
assert.ok(Array.isArray(successPacket.unresolvedItems), 'unresolvedItems must be array');
console.log('  PASS: adoptedItems / rejectedItems / unresolvedItems present');

// Failure case — all results missing → human_review
const missingPacket = tool.buildPacket({
  geminiResult: null, grokResult: null, claudeResult: null,
  originalTask: 'test task', safetyBoundary: {}, verificationSummary: null
});
assert.strictEqual(missingPacket.humanReviewRequired, true, 'humanReviewRequired must be true when results missing');
console.log('  PASS: humanReviewRequired true when results missing');

// blockedDangerousActions
assert.ok(Array.isArray(successPacket.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(successPacket.blockedDangerousActions.includes('git push'), 'git push must be blocked');
console.log('  PASS: blockedDangerousActions present');

// recommendedNextAction
assert.ok(typeof successPacket.recommendedNextAction === 'string', 'recommendedNextAction must be string');
assert.ok(successPacket.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: orchestra-result-merger-pack');
