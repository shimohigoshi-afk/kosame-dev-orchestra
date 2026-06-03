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
const tool   = require('../tools/first-real-product-repo-result-acceptance-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-result-acceptance-gate smoke ===');

assert.ok(compareVersion(pkg.version, '38.0.0') >= 0, `pkg version must be >= 38.0.0, got ${pkg.version}`);
console.log('  PASS: package version 38.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-result-acceptance-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-result-acceptance-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v38.0.0-release-record.md')), 'v38 release record must exist');
console.log('  PASS: v38 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-result-acceptance-gate.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '38.0.0', 'tool version must be 38.0.0');
console.log('  PASS: tool meta version 38.0.0');

// ---- clean approve ----
const approvePack = tool.buildAcceptanceGate({
  targetProduct:        'email_reply_bot',
  reportedTaskSummary:  'README.md に目次セクションを追加。1ファイル変更。検証パス。機密情報アクセスなし。',
  changedFiles:         ['README.md'],
  allowedFileZones:     ['docs/**', 'README.md', 'smoke/**'],
  verificationRaw:      'All tests passed.',
  businessIntentNote:   'Email Reply BOT のREADME整備完了。'
});

assert.strictEqual(approvePack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(approvePack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(approvePack.acceptanceGateId, 'acceptanceGateId must be present');
console.log('  PASS: acceptanceGateId present');

assert.ok(approvePack.changedFilesReview, 'changedFilesReview must be present');
assert.ok(approvePack.verificationReview, 'verificationReview must be present');
assert.strictEqual(approvePack.verificationReview.passed, true, 'verificationReview.passed must be true');
console.log('  PASS: verificationReview.passed true');

assert.ok(approvePack.safetyReview, 'safetyReview must be present');
assert.strictEqual(approvePack.safetyReview.overallSafe, true, 'safetyReview.overallSafe must be true');
console.log('  PASS: safetyReview.overallSafe true');

assert.ok(approvePack.secretLeakReview, 'secretLeakReview must be present');
assert.strictEqual(approvePack.secretLeakReview.clean, true, 'secretLeakReview.clean must be true');
console.log('  PASS: secretLeakReview.clean true');

assert.ok(approvePack.customerDataLeakReview, 'customerDataLeakReview must be present');
assert.strictEqual(approvePack.customerDataLeakReview.clean, true, 'customerDataLeakReview.clean must be true');
console.log('  PASS: customerDataLeakReview.clean true');

assert.ok(approvePack.dangerousOperationReview, 'dangerousOperationReview must be present');
assert.strictEqual(approvePack.dangerousOperationReview.clean, true, 'dangerousOperationReview.clean must be true');
console.log('  PASS: dangerousOperationReview.clean true');

assert.ok(Array.isArray(approvePack.acceptedItems) && approvePack.acceptedItems.length > 0, 'acceptedItems must be non-empty');
assert.strictEqual(approvePack.rejectedItems.length, 0, 'rejectedItems must be empty for clean case');
assert.ok(Array.isArray(approvePack.blockerItems), 'blockerItems must be array');
console.log('  PASS: acceptedItems/rejectedItems/blockerItems correct');

assert.strictEqual(approvePack.acceptanceDecision, 'approve', 'acceptanceDecision must be approve');
console.log('  PASS: acceptanceDecision approve');

assert.ok(Array.isArray(approvePack.decisionOptions), 'decisionOptions must be array');
assert.ok(approvePack.decisionOptions.includes('approve'), 'approve in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('hold'), 'hold in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('revise'), 'revise in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('reject'), 'reject in decisionOptions');
console.log('  PASS: decisionOptions has all 4 options');

assert.strictEqual(approvePack.commitCandidateReady, true, 'commitCandidateReady must be true for clean case');
console.log('  PASS: commitCandidateReady true');

assert.strictEqual(approvePack.needsHumanApproval, true, 'needsHumanApproval must always be true');
console.log('  PASS: needsHumanApproval true');

assert.ok(Array.isArray(approvePack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(approvePack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(approvePack.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(approvePack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- secret leak → hold ----
const secretPack = tool.buildAcceptanceGate({
  targetProduct:       'sales_dx',
  reportedTaskSummary: 'Updated api key in config file',
  changedFiles:        ['src/config.js'],
  allowedFileZones:    ['src/**'],
  verificationRaw:     'All tests passed.'
});
assert.ok(['hold', 'reject'].includes(secretPack.acceptanceDecision), 'secret leak must result in hold or reject');
assert.strictEqual(secretPack.commitCandidateReady, false, 'commitCandidateReady must be false for secret leak');
assert.strictEqual(secretPack.secretLeakReview.clean, false, 'secretLeakReview.clean must be false');
console.log('  PASS: secret leak → hold/reject + commitCandidateReady false');

// ---- customer data (insurance) → hold ----
const insurancePack = tool.buildAcceptanceGate({
  targetProduct:       'anesty_board',
  reportedTaskSummary: 'accessed insurance data table for board display',
  changedFiles:        ['src/board/component.js'],
  allowedFileZones:    ['src/board/**'],
  verificationRaw:     'All tests passed.'
});
assert.ok(['hold', 'reject'].includes(insurancePack.acceptanceDecision), 'insurance data must result in hold/reject');
assert.strictEqual(insurancePack.commitCandidateReady, false, 'commitCandidateReady must be false for insurance data');
console.log('  PASS: insurance data → hold/reject');

// ---- dangerous op (git push) → hold/reject ----
const dangerousPack = tool.buildAcceptanceGate({
  targetProduct:       'email_reply_bot',
  reportedTaskSummary: 'ran git commit and git push to publish changes',
  changedFiles:        ['README.md'],
  allowedFileZones:    ['README.md'],
  verificationRaw:     'All tests passed.'
});
assert.ok(['hold', 'reject'].includes(dangerousPack.acceptanceDecision), 'dangerous ops must result in hold/reject');
assert.strictEqual(dangerousPack.commitCandidateReady, false, 'commitCandidateReady must be false for dangerous ops');
console.log('  PASS: dangerous ops (git push) → hold/reject');

// ---- verification failed → revise ----
const failPack = tool.buildAcceptanceGate({
  targetProduct:       'email_reply_bot',
  reportedTaskSummary: 'added section to README',
  changedFiles:        ['README.md'],
  allowedFileZones:    ['README.md'],
  verificationRaw:     '2 tests failed. exit code 1.'
});
assert.ok(['revise', 'reject'].includes(failPack.acceptanceDecision), 'failed verify must result in revise/reject');
assert.strictEqual(failPack.commitCandidateReady, false, 'commitCandidateReady must be false for failed verify');
console.log('  PASS: verification failed → revise/reject');

console.log('PASS: first-real-product-repo-result-acceptance-gate');
