'use strict';
const { COMMAND_MAP, getCommandMap, lookupCommand, listHumanApprovalCommands } = require('../tools/operating-console-command-map');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== operating-console-command-map smoke ===');

// Test 1: COMMAND_MAP structure
assert('COMMAND_MAP: operator_commands exists', 'operator_commands' in COMMAND_MAP);
assert('COMMAND_MAP: status_importers exists', 'status_importers' in COMMAND_MAP);
assert('COMMAND_MAP: plan_generators exists', 'plan_generators' in COMMAND_MAP);
assert('COMMAND_MAP: release_gate exists', 'release_gate' in COMMAND_MAP);

// Test 2: getCommandMap flattens all commands
const allCmds = getCommandMap();
assert('getCommandMap: status exists', 'status' in allCmds);
assert('getCommandMap: dispatch exists', 'dispatch' in allCmds);
assert('getCommandMap: health-snapshot exists', 'health-snapshot' in allCmds);
assert('getCommandMap: one-shot-plan exists', 'one-shot-plan' in allCmds);
assert('getCommandMap: release-gate exists', 'release-gate' in allCmds);
assert('getCommandMap: at least 13 commands', Object.keys(allCmds).length >= 13);

// Test 3: lookupCommand
const statusCmd = lookupCommand('status');
assert('lookupCommand: status found', !!statusCmd);
assert('lookupCommand: status tool path', statusCmd.tool.includes('kosame-status-command'));
assert('lookupCommand: status not human approval', statusCmd.requiresHumanApproval === false);
assert('lookupCommand: status since 2.6.0', statusCmd.since === '2.6.0');

const pushCmd = lookupCommand('push-check');
assert('lookupCommand: push-check requiresHumanApproval', pushCmd.requiresHumanApproval === true);

const missing = lookupCommand('nonexistent-cmd');
assert('lookupCommand: missing returns null', missing === null);

// Test 4: listHumanApprovalCommands
const humanCmds = listHumanApprovalCommands();
assert('humanApproval: at least 4 commands', humanCmds.length >= 4);
assert('humanApproval: push-check in list', humanCmds.some(c => c.name === 'push-check'));
assert('humanApproval: release-check in list', humanCmds.some(c => c.name === 'release-check'));
assert('humanApproval: tag-readiness in list', humanCmds.some(c => c.name === 'tag-readiness'));
assert('humanApproval: status NOT in list', !humanCmds.some(c => c.name === 'status'));

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
