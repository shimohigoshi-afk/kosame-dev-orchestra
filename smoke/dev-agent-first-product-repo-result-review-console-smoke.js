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
const tool   = require('../tools/first-product-repo-result-review-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-result-review-console smoke ===');

assert.ok(compareVersion(pkg.version, '29.0.0') >= 0, `pkg version must be >= 29.0.0, got ${pkg.version}`);
console.log('  PASS: package version 29.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-result-review-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-result-review-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v29.0.0-release-record.md')), 'v29 release record must exist');
console.log('  PASS: v29 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-result-review-console.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '29.0.0', 'tool version must be 29.0.0');
console.log('  PASS: tool meta version 29.0.0');

// ---- clean approve case ----
const approvePack = tool.buildResultReviewConsole({
  targetProduct:             'sales_dx',
  claudeReportInputSummary:  '2 files created: src/leads/bulk-email-reply.js, tests/leads/bulk-email-reply.test.js. No out-of-scope files.',
  changedFiles:              ['src/leads/bulk-email-reply.js', 'tests/leads/bulk-email-reply.test.js'],
  allowedFileZones:          ['src/leads/**', 'tests/**', 'docs/**'],
  verificationRaw:           'All tests passed.',
  businessIntentNote:        '営業DXリード向け一括返信機能'
});

assert.strictEqual(approvePack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(approvePack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(approvePack.resultReviewId, 'resultReviewId must be present');
console.log('  PASS: resultReviewId present');

assert.ok(approvePack.changedFilesReview, 'changedFilesReview must be present');
console.log('  PASS: changedFilesReview present');

assert.ok(approvePack.verificationReview, 'verificationReview must be present');
assert.strictEqual(approvePack.verificationReview.passed, true, 'verificationReview.passed must be true');
console.log('  PASS: verificationReview.passed true');

assert.ok(approvePack.safetyReview, 'safetyReview must be present');
assert.strictEqual(approvePack.safetyReview.overallSafe, true, 'safetyReview.overallSafe must be true');
console.log('  PASS: safetyReview.overallSafe true');

assert.ok(approvePack.allowedFilesCheck, 'allowedFilesCheck must be present');
assert.strictEqual(approvePack.allowedFilesCheck.clean, true, 'allowedFilesCheck.clean must be true');
console.log('  PASS: allowedFilesCheck.clean true');

assert.ok(approvePack.forbiddenFilesCheck, 'forbiddenFilesCheck must be present');
assert.strictEqual(approvePack.forbiddenFilesCheck.clean, true, 'forbiddenFilesCheck.clean must be true');
console.log('  PASS: forbiddenFilesCheck.clean true');

assert.ok(approvePack.secretLeakCheck, 'secretLeakCheck must be present');
assert.strictEqual(approvePack.secretLeakCheck.clean, true, 'secretLeakCheck.clean must be true');
console.log('  PASS: secretLeakCheck.clean true');

assert.ok(approvePack.customerDataLeakCheck, 'customerDataLeakCheck must be present');
assert.strictEqual(approvePack.customerDataLeakCheck.clean, true, 'customerDataLeakCheck.clean must be true');
console.log('  PASS: customerDataLeakCheck.clean true');

assert.ok(approvePack.dangerousOperationCheck, 'dangerousOperationCheck must be present');
assert.strictEqual(approvePack.dangerousOperationCheck.clean, true, 'dangerousOperationCheck.clean must be true');
console.log('  PASS: dangerousOperationCheck.clean true');

assert.ok(Array.isArray(approvePack.acceptedItems) && approvePack.acceptedItems.length > 0, 'acceptedItems must be non-empty');
assert.ok(Array.isArray(approvePack.rejectedItems), 'rejectedItems must be array');
assert.strictEqual(approvePack.rejectedItems.length, 0, 'rejectedItems must be empty for clean case');
assert.ok(Array.isArray(approvePack.blockerItems), 'blockerItems must be array');
console.log('  PASS: acceptedItems/rejectedItems/blockerItems correct');

assert.strictEqual(approvePack.reviewDecision, 'approve', 'reviewDecision must be approve for clean case');
console.log('  PASS: reviewDecision approve');

assert.ok(Array.isArray(approvePack.decisionOptions), 'decisionOptions must be array');
assert.ok(approvePack.decisionOptions.includes('approve'), 'approve must be in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('revise'), 'revise must be in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('reject'), 'reject must be in decisionOptions');
assert.ok(approvePack.decisionOptions.includes('hold'), 'hold must be in decisionOptions');
console.log('  PASS: decisionOptions has all 4 options');

assert.strictEqual(approvePack.commitCandidateReady, true, 'commitCandidateReady must be true for clean case');
console.log('  PASS: commitCandidateReady true');

assert.strictEqual(approvePack.needsHumanApproval, true, 'needsHumanApproval must always be true');
console.log('  PASS: needsHumanApproval true');

assert.strictEqual(approvePack.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(approvePack.noRealPush, true, 'noRealPush must be true');
assert.strictEqual(approvePack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- secret leak → hold ----
const secretPack = tool.buildResultReviewConsole({
  targetProduct:            'sales_dx',
  claudeReportInputSummary: 'Updated api key in config, changed src/leads/test.js',
  changedFiles:             ['src/leads/test.js'],
  allowedFileZones:         ['src/leads/**'],
  verificationRaw:          'All tests passed.'
});
assert.ok(['hold', 'reject'].includes(secretPack.reviewDecision), 'reviewDecision must be hold or reject for secret leak');
assert.strictEqual(secretPack.commitCandidateReady, false, 'commitCandidateReady must be false for secret leak');
assert.strictEqual(secretPack.secretLeakCheck.clean, false, 'secretLeakCheck.clean must be false');
console.log('  PASS: secret leak → hold/reject + commitCandidateReady false');

// ---- customer data (insurance) → hold ----
const insurancePack = tool.buildResultReviewConsole({
  targetProduct:            'anesty_board',
  claudeReportInputSummary: 'accessed insurance data table and updated board component',
  changedFiles:             ['src/board/component.js'],
  allowedFileZones:         ['src/board/**'],
  verificationRaw:          'All tests passed.'
});
assert.ok(['hold', 'reject'].includes(insurancePack.reviewDecision), 'reviewDecision must be hold/reject for insurance data');
assert.strictEqual(insurancePack.commitCandidateReady, false, 'commitCandidateReady must be false for customer data');
console.log('  PASS: customer data (insurance) → hold/reject');

// ---- forbidden file ----
const forbiddenPack = tool.buildResultReviewConsole({
  targetProduct:            'sales_dx',
  claudeReportInputSummary: 'edited files',
  changedFiles:             ['secrets/api.json'],
  allowedFileZones:         ['src/**'],
  verificationRaw:          'All tests passed.'
});
assert.strictEqual(forbiddenPack.forbiddenFilesCheck.clean, false, 'forbiddenFilesCheck.clean must be false');
assert.strictEqual(forbiddenPack.commitCandidateReady, false, 'commitCandidateReady must be false for forbidden file');
console.log('  PASS: forbidden file detected');

// ---- dangerous operation ----
const dangerousPack = tool.buildResultReviewConsole({
  targetProduct:            'sales_dx',
  claudeReportInputSummary: 'ran git commit and git push after editing',
  changedFiles:             ['src/leads/test.js'],
  allowedFileZones:         ['src/leads/**'],
  verificationRaw:          'All tests passed.'
});
assert.strictEqual(dangerousPack.dangerousOperationCheck.clean, false, 'dangerousOperationCheck.clean must be false');
assert.strictEqual(dangerousPack.commitCandidateReady, false, 'commitCandidateReady must be false for dangerous ops');
console.log('  PASS: dangerous operation detected');

// ---- verification failed → revise ----
const failVerifyPack = tool.buildResultReviewConsole({
  targetProduct:            'email_reply_bot',
  claudeReportInputSummary: 'added feature',
  changedFiles:             ['src/reply/handler.js'],
  allowedFileZones:         ['src/**'],
  verificationRaw:          'Error: 2 tests failed. exit code 1.'
});
assert.ok(['revise', 'reject'].includes(failVerifyPack.reviewDecision), 'reviewDecision must be revise/reject when verify fails');
assert.strictEqual(failVerifyPack.commitCandidateReady, false, 'commitCandidateReady must be false when verify fails');
console.log('  PASS: verification failed → revise/reject');

console.log('PASS: first-product-repo-result-review-console');
