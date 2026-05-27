'use strict';
const { executeStatusCommand, deriveStatusNextAction } = require('../tools/kosame-status-command');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('=== kosame-status-command smoke ===');

// Test 1: clean, synced, all-green
const r1 = executeStatusCommand({
  packageVersion: '2.6.0',
  headCommit: 'abc1234',
  originCommit: 'abc1234',
  branch: 'main',
  hasUncommittedChanges: false,
  actionsStatus: 'success',
  verifyStatus: 'passed'
});
assert('command field', r1.command === 'kosame status');
assert('version 2.6.0', r1.version === '2.6.0');
assert('dryRun true', r1.dryRun === true);
assert('workingTreeClean', r1.workingTreeClean === true);
assert('syncStatus in_sync', r1.syncStatus === 'in_sync');
assert('all-green next action: release check', r1.nextAction.action === 'prepare_release_check');

// Test 2: dirty working tree + verify passed → prepare_commit_packet
const r2 = executeStatusCommand({
  packageVersion: '2.6.0',
  headCommit: 'abc1234',
  originCommit: 'abc1234',
  hasUncommittedChanges: true,
  uncommittedFiles: ['tools/foo.js'],
  actionsStatus: 'unknown',
  verifyStatus: 'passed'
});
assert('dirty tree: workingTreeClean false', r2.workingTreeClean === false);
assert('dirty tree: next action commit', r2.nextAction.action === 'prepare_commit_packet');

// Test 3: ahead of origin → push pending
const r3 = executeStatusCommand({
  headCommit: 'newcommit',
  originCommit: 'oldcommit',
  hasUncommittedChanges: false,
  actionsStatus: 'unknown',
  verifyStatus: 'passed'
});
assert('ahead of origin: syncStatus', r3.syncStatus === 'ahead_of_origin');
assert('ahead of origin: next action push', r3.nextAction.action === 'prepare_push_packet');

// Test 4: verify failed → repair
const r4 = executeStatusCommand({ verifyStatus: 'failed' });
assert('verify failed: next action repair', r4.nextAction.action === 'run_claude_repair');
assert('verify failed: issue logged', r4.issues.some(i => i.includes('verify FAILED')));

// Test 5: deriveStatusNextAction directly - actions failed
const na = deriveStatusNextAction({ syncStatus: 'in_sync', workingTreeClean: true, actionsStatus: 'failed', verifyStatus: 'passed', issues: [] });
assert('actions failed: triage', na.action === 'triage_actions_failure');

// Test 6: no verify run + dirty → run_verify
const r6 = executeStatusCommand({
  headCommit: 'x', originCommit: 'x',
  hasUncommittedChanges: true,
  uncommittedFiles: ['a.js'],
  verifyStatus: 'unknown',
  actionsStatus: 'unknown'
});
assert('no verify + dirty: run_verify', r6.nextAction.action === 'run_verify');

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
