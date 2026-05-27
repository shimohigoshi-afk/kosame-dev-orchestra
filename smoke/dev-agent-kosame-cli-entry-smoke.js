'use strict';
const { runCli, CLI_VERSION, DEMO_INPUTS } = require('../tools/kosame-cli-entry');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-cli-entry smoke ===');

// Test 1: help
const help = runCli(['--help']);
assert('help: cli field', help.cli === 'kosame-cli-entry');
assert('help: version 3.1.0', help.version === '3.1.0');
assert('help: supported_commands', Array.isArray(help.supported_commands));
assert('help: dryRun', help.dryRun === true);

// Test 2: status (default)
const r2 = runCli(['status']);
assert('status: cli field', r2.cli === 'kosame-cli-entry');
assert('status: router field', r2.router === 'kosame-cli-router');
assert('status: command kosame status', r2.command === 'kosame status');

// Test 3: default command (no args = status)
const r3 = runCli([]);
assert('no args: cli field', r3.cli === 'kosame-cli-entry');
assert('no args: defaults to status', r3.cli_command === 'kosame status');

// Test 4: release-check
const r4 = runCli(['release-check']);
assert('release-check: cli entry', r4.cli === 'kosame-cli-entry');
assert('release-check: gate_required', r4.gate_required === true);

// Test 5: dispatch
const r5 = runCli(['dispatch']);
assert('dispatch: cli entry', r5.cli === 'kosame-cli-entry');
assert('dispatch: target field', typeof r5.target === 'string');

// Test 6: session_id from flag
const r6 = runCli(['status', '--session=test-session-123']);
assert('session: session_id set', r6.session_id === 'test-session-123');

// Test 7: DEMO_INPUTS coverage
assert('DEMO_INPUTS: 7 keys', Object.keys(DEMO_INPUTS).length === 7);
assert('CLI_VERSION: 3.1.0', CLI_VERSION === '3.1.0');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
