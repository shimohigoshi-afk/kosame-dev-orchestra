'use strict';
const { runOperatingConsole, getFoundationStatus, FOUNDATION_VERSION } = require('../tools/kosame-operating-console-foundation');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-operating-console-foundation smoke ===');

// Test 1: getFoundationStatus
const status = getFoundationStatus();
assert('foundation field', status.foundation === 'kosame-operating-console-foundation');
assert('foundation_version 3.0.0', status.foundation_version === '3.0.0');
assert('status operational', status.status === 'operational');
assert('commandCount >= 13', status.commandCount >= 13);
assert('categories 4', status.categories.length === 4);
assert('capabilities 6', status.capabilities.length === 6);
assert('safetyConstraints 4', status.safetyConstraints.length === 4);
assert('dryRun true', status.dryRun === true);
assert('FOUNDATION_VERSION', FOUNDATION_VERSION === '3.0.0');

// Test 2: command mode
const cmd = runOperatingConsole({ command: 'status', input: {
  packageVersion: '3.0.0',
  headCommit: 'abc1234',
  originCommit: 'abc1234',
  branch: 'main',
  hasUncommittedChanges: false,
  actionsStatus: 'success',
  verifyStatus: 'passed'
}});
assert('command mode: foundation field', cmd.foundation === 'kosame-operating-console-foundation');
assert('command mode: foundation_version', cmd.foundation_version === '3.0.0');
assert('command mode: command kosame status', cmd.command === 'kosame status');

// Test 3: decision mode
const dec = runOperatingConsole({ mode: 'decision', input: {
  currentState: { actionsStatus: 'success', verifyStatus: 'passed', workingTreeClean: true, isAhead: false }
}});
assert('decision mode: packet field', dec.packet === 'kosame-operating-decision-packet');
assert('decision mode: primaryAction release_check', dec.primaryAction === 'run_release_check');

// Test 4: health mode
const health = runOperatingConsole({ mode: 'health', input: {
  git: { statusLines: [], aheadCount: 0 },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 0, passedCount: 94, failedCount: 0 }
}});
assert('health mode: snapshot field', health.snapshot === 'repository-health-snapshot');

// Test 5: list mode
const list = runOperatingConsole({ mode: 'list' });
assert('list mode: foundation field', list.foundation === 'kosame-operating-console-foundation');
assert('list mode: commandMap exists', typeof list.commandMap === 'object');
assert('list mode: humanApprovalCommands is array', Array.isArray(list.humanApprovalCommands));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
