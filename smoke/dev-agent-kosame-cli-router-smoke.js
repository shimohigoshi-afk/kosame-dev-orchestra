'use strict';
const { routeCliCommand, SUPPORTED_CLI_COMMANDS } = require('../tools/kosame-cli-router');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-cli-router smoke ===');

// Test 1: status command
const r1 = routeCliCommand('status', {
  packageVersion: '3.1.0', branch: 'main', headCommit: 'abc', originCommit: 'abc',
  hasUncommittedChanges: false, actionsStatus: 'success', verifyStatus: 'passed'
});
assert('router field', r1.router === 'kosame-cli-router');
assert('cli_command field', r1.cli_command === 'kosame status');
assert('version 3.1.0', r1.version === '3.1.0');
assert('dryRun true', r1.dryRun === true);
assert('command kosame status', r1.command === 'kosame status');

// Test 2: commit-check
const r2 = routeCliCommand('commit-check', {
  intended_files: ['tools/foo.js'], actual_changed_files: ['tools/foo.js'],
  verify_status: 'passed', verify_failed: 0, node_check_status: 'passed', risk_level: 'Low'
});
assert('commit-check: cli_command', r2.cli_command === 'kosame commit-check');
assert('commit-check: recommendation YES', r2.recommendation === 'YES');

// Test 3: push-check always gate_required
const r3 = routeCliCommand('push-check', {});
assert('push-check: gate_required always', r3.gate_required === true);
assert('push-check: human_approval_required', r3.human_approval_required === true);

// Test 4: approval command
const r4 = routeCliCommand('approval', {
  actionTitle: 'test-action', actionType: 'git_tag', riskLevel: 'High',
  dangerousCommands: ['git tag v3.1.0']
});
assert('approval: generator approval-summary', r4.generator === 'human-approval-summary-generator');
assert('approval: requiresApproval true', r4.requiresApproval === true);

// Test 5: handoff command
const r5 = routeCliCommand('handoff', { releasedVersion: '3.1.0', tagCreated: false, pushedToRemote: false });
assert('handoff: packet field', r5.packet === 'release-handoff-packet');
assert('handoff: releaseComplete false', r5.releaseComplete === false);

// Test 6: unknown command → error
const r6 = routeCliCommand('unknown-cmd', {});
assert('unknown: error field', !!r6.error);
assert('unknown: supported list', Array.isArray(r6.supported));

// Test 7: SUPPORTED_CLI_COMMANDS
assert('supported: 7 commands', SUPPORTED_CLI_COMMANDS.length === 7);
assert('supported: handoff included', SUPPORTED_CLI_COMMANDS.includes('handoff'));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
