'use strict';
const { generateOperatingDecisionPacket } = require('../tools/kosame-operating-decision-packet');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-operating-decision-packet smoke ===');

// Test 1: all green → release-check
const r1 = generateOperatingDecisionPacket({
  currentState: {
    actionsStatus: 'success',
    verifyStatus: 'passed',
    workingTreeClean: true,
    isAhead: false,
    overallHealth: 'healthy',
    packageVersion: '3.0.0'
  },
  sessionGoal: 'Release v3.0.0'
});
assert('packet field', r1.packet === 'kosame-operating-decision-packet');
assert('all green: primaryAction release_check', r1.primaryAction === 'run_release_check');
assert('all green: urgency low', r1.urgency === 'low');
assert('version 3.0.0', r1.version === '3.0.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: verify failed → repair
const r2 = generateOperatingDecisionPacket({
  currentState: { verifyStatus: 'failed', workingTreeClean: true }
});
assert('verify failed: primaryAction repair', r2.primaryAction === 'run_claude_repair');
assert('verify failed: urgency high', r2.urgency === 'high');

// Test 3: actions failed → triage
const r3 = generateOperatingDecisionPacket({
  currentState: { actionsStatus: 'failed', verifyStatus: 'passed', workingTreeClean: true }
});
assert('actions failed: triage', r3.primaryAction === 'triage_actions_failure');
assert('actions failed: urgency high', r3.urgency === 'high');

// Test 4: dirty tree + no verify → run_verify
const r4 = generateOperatingDecisionPacket({
  currentState: { workingTreeClean: false, verifyStatus: 'not_run', actionsStatus: 'unknown' }
});
assert('dirty + no verify: run_verify', r4.primaryAction === 'run_verify');

// Test 5: dirty tree + verified → commit-check
const r5 = generateOperatingDecisionPacket({
  currentState: { workingTreeClean: false, verifyStatus: 'passed', actionsStatus: 'unknown' }
});
assert('dirty + verified: commit_check', r5.primaryAction === 'run_commit_check');

// Test 6: ahead of origin → push-check
const r6 = generateOperatingDecisionPacket({
  currentState: { workingTreeClean: true, verifyStatus: 'passed', isAhead: true, actionsStatus: 'unknown' }
});
assert('ahead: push_check', r6.primaryAction === 'run_push_check');

// Test 7: pending human decisions
const r7 = generateOperatingDecisionPacket({
  currentState: {},
  pendingDecisions: [{ name: 'push', requiresHumanApproval: true }]
});
assert('pending: humanApprovalRequired', r7.humanApprovalRequired === true);
assert('pending: humanApprovalPending len 1', r7.humanApprovalPending.length === 1);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
