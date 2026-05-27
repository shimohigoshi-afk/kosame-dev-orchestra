'use strict';
const { executeReleaseCheckCommand } = require('../tools/kosame-release-check-command');

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

console.log('=== kosame-release-check-command smoke ===');

// Test 1: all conditions met → YES
const r1 = executeReleaseCheckCommand({
  target_version: '2.6.0',
  package_version: '2.6.0',
  actions_status: 'success',
  verify_status: 'passed',
  verify_passed: 94,
  verify_failed: 0,
  working_tree_clean: true,
  head_commit: 'abc1234',
  release_docs_exist: true
});
assert('command field', r1.command === 'kosame release-check');
assert('all clear: YES', r1.recommendation === 'YES');
assert('version 2.6.0', r1.version === '2.6.0');
assert('dryRun true', r1.dryRun === true);
assert('always gate_required', r1.gate_required === true);
assert('always human_approval_required', r1.human_approval_required === true);
assert('junya_operations contains tag', r1.junya_operations.some(o => o.includes('git tag')));
assert('junya_operations contains push', r1.junya_operations.some(o => o.includes('git push')));
assert('no failures', r1.failures.length === 0);

// Test 2: actions pending → HOLD
const r2 = executeReleaseCheckCommand({
  target_version: '2.6.0',
  package_version: '2.6.0',
  actions_status: 'pending',
  verify_status: 'passed',
  verify_failed: 0,
  working_tree_clean: true,
  release_docs_exist: true
});
assert('pending actions: HOLD', r2.recommendation === 'HOLD');
assert('pending actions: next wait_for_actions', r2.next_action === 'wait_for_actions');

// Test 3: actions failed → NO
const r3 = executeReleaseCheckCommand({
  target_version: '2.6.0',
  package_version: '2.6.0',
  actions_status: 'failed',
  verify_status: 'passed',
  verify_failed: 0,
  working_tree_clean: true,
  release_docs_exist: true
});
assert('actions failed: NO', r3.recommendation === 'NO');
assert('actions failed: failure logged', r3.failures.some(f => f.includes('GitHub Actions')));

// Test 4: version mismatch → NO
const r4 = executeReleaseCheckCommand({
  target_version: '2.6.0',
  package_version: '2.5.0',
  actions_status: 'success',
  verify_status: 'passed',
  verify_failed: 0,
  working_tree_clean: true,
  release_docs_exist: true
});
assert('version mismatch: NO', r4.recommendation === 'NO');
assert('version mismatch: failure logged', r4.failures.some(f => f.includes('version mismatch')));

// Test 5: missing release docs → NO
const r5 = executeReleaseCheckCommand({
  target_version: '2.6.0',
  package_version: '2.6.0',
  actions_status: 'success',
  verify_status: 'passed',
  verify_failed: 0,
  working_tree_clean: true,
  release_docs_exist: false
});
assert('missing docs: NO', r5.recommendation === 'NO');
assert('missing docs: junya_operations empty', r5.junya_operations.length === 0);

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
