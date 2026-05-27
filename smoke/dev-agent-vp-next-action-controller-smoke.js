'use strict';
const { determineVpNextAction, VP_ACTIONS } = require('../tools/vp-next-action-controller');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== vp-next-action-controller smoke ===');

// verify failed → fix_verify
const r1 = determineVpNextAction({ verifyStatus: 'failed' });
assert('controller field', r1.controller === 'vp-next-action-controller');
assert('verify fail: fix_verify', r1.action === VP_ACTIONS.FIX_VERIFY);
assert('verify fail: priority high', r1.priority === 'high');
assert('version 3.5.0', r1.version === '3.5.0');
assert('dryRun true', r1.dryRun === true);

// actions failed → triage
const r2 = determineVpNextAction({ verifyStatus: 'passed', actionsStatus: 'failed' });
assert('actions fail: triage', r2.action === VP_ACTIONS.TRIAGE_ACTIONS);
assert('actions fail: priority high', r2.priority === 'high');

// dirty + no verify → run_verify
const r3 = determineVpNextAction({ verifyStatus: 'not_run', workingTreeClean: false });
assert('dirty no verify: run_verify', r3.action === VP_ACTIONS.RUN_VERIFY);

// dirty + verified → commit
const r4 = determineVpNextAction({ verifyStatus: 'passed', workingTreeClean: false });
assert('dirty verified: commit', r4.action === VP_ACTIONS.COMMIT);
assert('commit: no human approval', r4.requiresHumanApproval === false);

// ahead + verified → push (needs approval)
const r5 = determineVpNextAction({ verifyStatus: 'passed', workingTreeClean: true, isAhead: true });
assert('ahead: push', r5.action === VP_ACTIONS.PUSH);
assert('push: requiresHumanApproval', r5.requiresHumanApproval === true);

// all green → release (needs approval)
const r6 = determineVpNextAction({ verifyStatus: 'passed', actionsStatus: 'success', workingTreeClean: true, isAhead: false });
assert('all green: release', r6.action === VP_ACTIONS.RELEASE);
assert('release: requiresHumanApproval', r6.requiresHumanApproval === true);

// VP_ACTIONS export
assert('VP_ACTIONS exported', typeof VP_ACTIONS === 'object');
assert('VP_ACTIONS.FIX_VERIFY exists', !!VP_ACTIONS.FIX_VERIFY);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
