'use strict';
const { executePushCheckCommand } = require('../tools/kosame-push-check-command');

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

console.log('=== kosame-push-check-command smoke ===');

// Test 1: all conditions met → YES (but always gate_required)
const r1 = executePushCheckCommand({
  headCommit: 'abc1234',
  originCommit: 'b9b02ee',
  branch: 'main',
  package_version: '2.6.0',
  verify_status: 'passed',
  verify_failed: 0,
  actions_status: 'success',
  commit_ready: true,
  working_tree_clean: true
});
assert('command field', r1.command === 'kosame push-check');
assert('all clear: YES', r1.recommendation === 'YES');
assert('version 2.6.0', r1.version === '2.6.0');
assert('dryRun true', r1.dryRun === true);
assert('always gate_required', r1.gate_required === true);
assert('always human_approval_required', r1.human_approval_required === true);
assert('is_ahead true', r1.is_ahead === true);
assert('junya_operation push', r1.junya_operation.includes('git push'));

// Test 2: uncommitted changes → NO
const r2 = executePushCheckCommand({
  headCommit: 'abc1234',
  originCommit: 'b9b02ee',
  verify_status: 'passed',
  commit_ready: true,
  working_tree_clean: false
});
assert('dirty tree: NO', r2.recommendation === 'NO');
assert('dirty tree: blocker listed', r2.blockers.length > 0);

// Test 3: not ahead of origin → HOLD
const r3 = executePushCheckCommand({
  headCommit: 'same',
  originCommit: 'same',
  verify_status: 'passed',
  commit_ready: true,
  working_tree_clean: true
});
assert('in sync: HOLD', r3.recommendation === 'HOLD');
assert('in sync: is_ahead false', r3.is_ahead === false);

// Test 4: verify not passed → NO
const r4 = executePushCheckCommand({
  headCommit: 'abc1234',
  originCommit: 'b9b02ee',
  verify_status: 'failed',
  verify_failed: 3,
  commit_ready: true,
  working_tree_clean: true
});
assert('verify failed: NO', r4.recommendation === 'NO');

// Test 5: gate always on even when HOLD
const r5 = executePushCheckCommand({});
assert('empty input: gate_required always true', r5.gate_required === true);

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
