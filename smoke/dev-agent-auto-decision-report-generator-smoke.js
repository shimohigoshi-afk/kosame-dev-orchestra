'use strict';
const { generateAutoDecisionReport } = require('../tools/auto-decision-report-generator');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== auto-decision-report-generator smoke ===');

// Test 1: all green → release candidate
const r1 = generateAutoDecisionReport({
  verifyStatus: 'passed', actionsStatus: 'success',
  workingTreeClean: true, isAhead: false, geminiAvailable: false,
  packageVersion: '3.3.0', overallHealth: 'healthy', releaseDocsExist: true, taskHints: {}
});
assert('report field', r1.report === 'auto-decision-report-generator');
assert('all green: primaryAction release', r1.primaryAction === 'release_with_junya_approval');
assert('all green: summary.release YES', r1.summary.release === 'YES');
assert('all green: summary.commit HOLD', r1.summary.commit === 'HOLD');
assert('version 3.3.0', r1.version === '3.3.0');
assert('dryRun true', r1.dryRun === true);
assert('commit sub-report', r1.commit.report === 'commit-decision-report');
assert('push sub-report', r1.push.report === 'push-decision-report');
assert('release sub-report', r1.release.report === 'release-decision-report');
assert('dispatch sub-report', r1.dispatch.report === 'dispatch-decision-report');

// Test 2: verify failed → fix_verify
const r2 = generateAutoDecisionReport({ verifyStatus: 'failed', actionsStatus: 'unknown', workingTreeClean: true });
assert('verify fail: primaryAction fix_verify', r2.primaryAction === 'fix_verify');
assert('verify fail: primaryPriority high', r2.primaryPriority === 'high');

// Test 3: actions failed → triage
const r3 = generateAutoDecisionReport({ verifyStatus: 'passed', actionsStatus: 'failed', workingTreeClean: true });
assert('actions fail: primaryAction triage_actions', r3.primaryAction === 'triage_actions');

// Test 4: commit ready
const r4 = generateAutoDecisionReport({
  verifyStatus: 'passed', actionsStatus: 'unknown', workingTreeClean: false,
  repo: { uncommittedFiles: ['tools/foo.js'] }
});
assert('commit ready: primaryAction commit', r4.primaryAction === 'commit');

// Test 5: requiresHumanApproval when push/release YES
assert('release YES: requiresHumanApproval', r1.requiresHumanApproval === true);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
