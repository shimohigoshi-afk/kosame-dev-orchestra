'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-operator-runbook-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-operator-runbook-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 101, `pkg version must be >= 101.0.0, got ${pkg.version}`);
console.log('  PASS: package version 101.0.0 or later');

assert.ok(pkg.scripts['smoke:operator-runbook-v101'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:operator-runbook-v101'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:operator-runbook-v101 exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-operator-runbook-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '101.0.0');
console.log('  PASS: tool meta version 101.0.0');

const result = tool.buildOperatorRunbook({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

// all 7 runbook sections exist
assert.strictEqual(tool.RUNBOOK_SECTIONS.length, 7);
for (const section of tool.RUNBOOK_SECTIONS) {
  assert.ok(result.runbook[section], `runbook section ${section} must exist`);
}
console.log('  PASS: all 7 runbook sections exist');

// approval section requires human
assert.strictEqual(result.runbook.approval.humanRequired, true);
console.log('  PASS: approval section humanRequired true');

// non-approval sections do not require human
const nonApproval = tool.RUNBOOK_SECTIONS.filter(s => s !== 'approval');
for (const s of nonApproval) {
  assert.strictEqual(result.runbook[s].humanRequired, false, `${s} should not require human`);
}
console.log('  PASS: non-approval sections do not require human');

// quickReference
assert.ok(result.quickReference.humanOnlyTasks.includes('approval'));
console.log('  PASS: quickReference.humanOnlyTasks includes approval');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-operator-runbook-pack smoke PASSED ===');
