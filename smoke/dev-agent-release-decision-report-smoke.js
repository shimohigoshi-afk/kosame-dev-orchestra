'use strict';
const { generateReleaseDecisionReport } = require('../tools/release-decision-report');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== release-decision-report smoke ===');

// YES: all conditions met
const r1 = generateReleaseDecisionReport({
  actionsStatus: 'success', verifyStatus: 'passed',
  workingTreeClean: true, packageVersion: '3.3.0', isAhead: false, releaseDocsExist: true
});
assert('report field', r1.report === 'release-decision-report');
assert('YES: recommendation', r1.recommendation === 'YES');
assert('YES: tagCommands not empty', r1.tagCommands.length === 2);
assert('YES: tag includes version', r1.tagCommands.some(c => c.includes('3.3.0')));
assert('always gate_required', r1.gate_required === true);
assert('always humanApprovalRequired', r1.humanApprovalRequired === true);
assert('version 3.3.0', r1.version === '3.3.0');
assert('dryRun true', r1.dryRun === true);

// HOLD: actions pending
const r2 = generateReleaseDecisionReport({ actionsStatus: 'pending', verifyStatus: 'passed', workingTreeClean: true });
assert('HOLD: actions pending', r2.recommendation === 'HOLD');
assert('HOLD: nextAction wait_for_actions', r2.nextAction === 'wait_for_actions');

// NO: actions failed
const r3 = generateReleaseDecisionReport({ actionsStatus: 'failed', verifyStatus: 'passed', workingTreeClean: true });
assert('NO: actions failed', r3.recommendation === 'NO');
assert('NO: tagCommands empty', r3.tagCommands.length === 0);

// NO: verify failed
const r4 = generateReleaseDecisionReport({ actionsStatus: 'success', verifyStatus: 'failed', workingTreeClean: true });
assert('NO: verify failed', r4.recommendation === 'NO');

// NO: unpushed commits
const r5 = generateReleaseDecisionReport({ actionsStatus: 'success', verifyStatus: 'passed', workingTreeClean: true, isAhead: true });
assert('NO: isAhead (unpushed)', r5.recommendation === 'NO');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
