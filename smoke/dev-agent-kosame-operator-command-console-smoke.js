'use strict';
const { runOperatorConsole, listCommands, SUPPORTED_COMMANDS, CONSOLE_VERSION } = require('../tools/kosame-operator-command-console');

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

console.log('=== kosame-operator-command-console smoke ===');

// Test 1: listCommands
const list = listCommands();
assert('listCommands: console field', list.console === 'kosame-operator-command-console');
assert('listCommands: 5 commands', list.supported_commands.length === 5);
assert('listCommands: dryRun', list.dryRun === true);

// Test 2: status command via console
const r2 = runOperatorConsole('status', {
  packageVersion: '2.6.0',
  headCommit: 'abc1234',
  originCommit: 'abc1234',
  branch: 'main',
  hasUncommittedChanges: false,
  actionsStatus: 'success',
  verifyStatus: 'passed'
});
assert('status via console: console field', r2.console === 'kosame-operator-command-console');
assert('status via console: console_version', r2.console_version === CONSOLE_VERSION);
assert('status via console: command field', r2.command === 'kosame status');
assert('status via console: workingTreeClean', r2.workingTreeClean === true);

// Test 3: commit-check via console
const r3 = runOperatorConsole('commit-check', {
  intended_files: ['tools/foo.js'],
  actual_changed_files: ['tools/foo.js'],
  verify_status: 'passed',
  verify_failed: 0,
  node_check_status: 'passed',
  risk_level: 'Low'
});
assert('commit-check via console: YES', r3.recommendation === 'YES');

// Test 4: dispatch via console
const r4 = runOperatorConsole('dispatch', {
  needs_repair: true,
  verify_status: 'failed'
});
assert('dispatch via console: claude', r4.target === 'claude');

// Test 5: unknown command → error
const r5 = runOperatorConsole('unknown-cmd', {});
assert('unknown command: error field', !!r5.error);
assert('unknown command: includes supported list', r5.supported_commands.length === 5);

// Test 6: SUPPORTED_COMMANDS export
assert('SUPPORTED_COMMANDS: status included', SUPPORTED_COMMANDS.includes('status'));
assert('SUPPORTED_COMMANDS: dispatch included', SUPPORTED_COMMANDS.includes('dispatch'));

// Test 7: push-check via console always has gate_required
const r7 = runOperatorConsole('push-check', {
  headCommit: 'abc', originCommit: 'abc',
  verify_status: 'passed', commit_ready: true, working_tree_clean: true
});
assert('push-check via console: gate_required', r7.gate_required === true);

if (failed > 0) {
  console.error(`\nFAILED: ${failed} / ${passed + failed}`);
  process.exit(1);
}
console.log(`\nPASS: ${passed} / ${passed + failed}`);
