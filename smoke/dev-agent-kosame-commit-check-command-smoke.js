'use strict';
const { executeCommitCheckCommand } = require('../tools/kosame-commit-check-command');

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

console.log('=== kosame-commit-check-command smoke ===');

// Test 1: all clear → YES
const r1 = executeCommitCheckCommand({
  intended_files: ['tools/foo.js', 'package.json'],
  actual_changed_files: ['tools/foo.js', 'package.json'],
  verify_status: 'passed',
  verify_passed: 94,
  verify_failed: 0,
  node_check_status: 'passed',
  dangerous_actions: [],
  risk_level: 'Low'
});
assert('command field', r1.command === 'kosame commit-check');
assert('all clear: YES', r1.recommendation === 'YES');
assert('all clear: no unexpected files', r1.unexpected_files.length === 0);
assert('all clear: human_approval_required false', r1.human_approval_required === false);
assert('dryRun true', r1.dryRun === true);
assert('version 2.6.0', r1.version === '2.6.0');

// Test 2: verify not run → HOLD
const r2 = executeCommitCheckCommand({
  intended_files: ['tools/foo.js'],
  actual_changed_files: ['tools/foo.js'],
  verify_status: 'not_run',
  node_check_status: 'passed',
  risk_level: 'Low'
});
assert('verify not run: HOLD', r2.recommendation === 'HOLD');

// Test 3: unexpected file → NO
const r3 = executeCommitCheckCommand({
  intended_files: ['tools/foo.js'],
  actual_changed_files: ['tools/foo.js', 'tools/unintended.js'],
  verify_status: 'passed',
  verify_failed: 0,
  node_check_status: 'passed',
  risk_level: 'Low'
});
assert('unexpected file: NO', r3.recommendation === 'NO');
assert('unexpected file: listed', r3.unexpected_files.includes('tools/unintended.js'));

// Test 4: dangerous action → human_approval_required
const r4 = executeCommitCheckCommand({
  intended_files: ['tools/foo.js'],
  actual_changed_files: ['tools/foo.js'],
  verify_status: 'passed',
  verify_failed: 0,
  node_check_status: 'passed',
  dangerous_actions: ['git push origin main'],
  risk_level: 'Low'
});
assert('dangerous action: human_approval_required', r4.human_approval_required === true);
assert('dangerous action: has_push_trigger', r4.has_push_trigger === true);

// Test 5: Critical risk → NO
const r5 = executeCommitCheckCommand({
  intended_files: ['tools/foo.js'],
  actual_changed_files: ['tools/foo.js'],
  verify_status: 'passed',
  verify_failed: 0,
  node_check_status: 'passed',
  risk_level: 'Critical'
});
assert('critical risk: NO', r5.recommendation === 'NO');

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
