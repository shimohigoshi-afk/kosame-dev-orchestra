'use strict';
const { generatePushDecisionReport } = require('../tools/push-decision-report');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== push-decision-report smoke ===');

// YES case (always gate_required)
const r1 = generatePushDecisionReport({ verifyStatus: 'passed', workingTreeClean: true, isAhead: true });
assert('report field', r1.report === 'push-decision-report');
assert('YES: recommendation', r1.recommendation === 'YES');
assert('always gate_required', r1.gate_required === true);
assert('always humanApprovalRequired', r1.humanApprovalRequired === true);
assert('version 3.3.0', r1.version === '3.3.0');
assert('dryRun true', r1.dryRun === true);

// NO: dirty tree
const r2 = generatePushDecisionReport({ verifyStatus: 'passed', workingTreeClean: false, isAhead: true });
assert('NO: dirty', r2.recommendation === 'NO');

// HOLD: not ahead
const r3 = generatePushDecisionReport({ verifyStatus: 'passed', workingTreeClean: true, isAhead: false });
assert('HOLD: not ahead', r3.recommendation === 'HOLD');

// NO: verify not passed
const r4 = generatePushDecisionReport({ verifyStatus: 'failed', workingTreeClean: true, isAhead: true });
assert('NO: verify failed', r4.recommendation === 'NO');
assert('NO: blockers has verify', r4.blockers.some(b => b.includes('verify')));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
