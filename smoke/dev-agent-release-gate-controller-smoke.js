'use strict';
const { evaluateReleaseGate, GATE_STATUSES } = require('../tools/release-gate-controller');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== release-gate-controller smoke ===');

// Test 1: technically ready, no junya approval → PENDING
const r1 = evaluateReleaseGate({
  targetVersion: '2.9.0',
  actionsStatus: 'success',
  verifyStatus: 'passed',
  verifyPassed: 94,
  verifyFailed: 0,
  workingTreeClean: true,
  releaseDocsExist: true,
  packageVersionMatch: true,
  junyaApproved: false
});
assert('controller field', r1.controller === 'release-gate-controller');
assert('ready no approval: gateStatus pending', r1.gateStatus === GATE_STATUSES.PENDING);
assert('ready no approval: technicallyReady', r1.technicallyReady === true);
assert('ready no approval: allowRelease false', r1.allowRelease === false);
assert('ready no approval: humanApprovalRequired', r1.humanApprovalRequired === true);
assert('version 2.9.0', r1.version === '2.9.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: all checks pass + junya approved → OPEN
const r2 = evaluateReleaseGate({
  actionsStatus: 'success',
  verifyStatus: 'passed',
  verifyPassed: 94,
  verifyFailed: 0,
  workingTreeClean: true,
  releaseDocsExist: true,
  packageVersionMatch: true,
  junyaApproved: true
});
assert('full approval: gateStatus open', r2.gateStatus === GATE_STATUSES.OPEN);
assert('full approval: allowRelease true', r2.allowRelease === true);

// Test 3: actions failed → CLOSED
const r3 = evaluateReleaseGate({
  actionsStatus: 'failed',
  verifyStatus: 'passed',
  verifyFailed: 0,
  workingTreeClean: true,
  releaseDocsExist: true,
  packageVersionMatch: true,
  junyaApproved: true
});
assert('actions failed: gateStatus closed', r3.gateStatus === GATE_STATUSES.CLOSED);
assert('actions failed: allowRelease false', r3.allowRelease === false);
assert('actions failed: technicalBlockers', r3.technicalBlockers.length > 0);

// Test 4: verify failed → CLOSED even with junya approval
const r4 = evaluateReleaseGate({
  actionsStatus: 'success',
  verifyStatus: 'failed',
  verifyFailed: 3,
  workingTreeClean: true,
  releaseDocsExist: true,
  packageVersionMatch: true,
  junyaApproved: true
});
assert('verify failed: gateStatus closed', r4.gateStatus === GATE_STATUSES.CLOSED);

// Test 5: checks object keys
assert('checks has actions_ok', 'actions_ok' in r1.checks);
assert('checks has junya_approved', 'junya_approved' in r1.checks);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
