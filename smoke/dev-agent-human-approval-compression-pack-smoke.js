'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-human-approval-compression-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-human-approval-compression-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 102, `pkg version must be >= 102.0.0, got ${pkg.version}`);
console.log('  PASS: package version 102.0.0 or later');

assert.ok(pkg.scripts['smoke:human-approval-compression-v102'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:human-approval-compression-v102'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:human-approval-compression-v102 exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-human-approval-compression-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '102.0.0');
console.log('  PASS: tool meta version 102.0.0');

// empty actions
const empty = tool.buildHumanApprovalCompression({});
assert.strictEqual(empty.dryRun, true);
assert.strictEqual(empty.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, realProductActionsExecuted false');

// mixed actions
const mixed = tool.buildHumanApprovalCompression({
  pendingActions: ['run smoke test', 'deploy to cloud run', 'edit docs']
});
assert.strictEqual(mixed.compressionResult.humanGateCount, 1, 'deploy should trigger 1 human gate');
assert.strictEqual(mixed.compressionResult.safeForAICount, 2, '2 safe for AI');
console.log('  PASS: mixed actions compressed correctly (1 human gate, 2 safe AI)');

// safe only
const safeOnly = tool.buildHumanApprovalCompression({
  pendingActions: ['run smoke test', 'edit docs']
});
assert.strictEqual(safeOnly.compressionResult.humanGateCount, 0);
assert.strictEqual(safeOnly.humanApprovalRequired, false);
console.log('  PASS: safe-only actions → humanApprovalRequired false');

// all dangerous
const allDangerous = tool.buildHumanApprovalCompression({
  pendingActions: ['deploy', 'git push', 'billing']
});
assert.strictEqual(allDangerous.compressionResult.humanGateCount, 3);
assert.strictEqual(allDangerous.humanApprovalRequired, true);
console.log('  PASS: all dangerous → humanApprovalRequired true, 3 human gates');

// HUMAN_APPROVAL_GATES includes all required gates
const gateActions = tool.HUMAN_APPROVAL_GATES.map(g => g.action);
assert.ok(gateActions.includes('deploy'));
assert.ok(gateActions.includes('git push'));
assert.ok(gateActions.includes('git tag'));
assert.ok(gateActions.includes('secret access'));
assert.ok(gateActions.includes('real send'));
assert.ok(gateActions.includes('billing'));
assert.ok(gateActions.includes('destructive delete'));
console.log('  PASS: HUMAN_APPROVAL_GATES includes all required critical actions');

// principle
assert.ok(typeof empty.principle === 'string' && empty.principle.length > 0);
console.log('  PASS: principle field exists');

console.log('=== dev-agent-human-approval-compression-pack smoke PASSED ===');
