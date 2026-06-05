'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-work-order-builder-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-work-order-builder-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 97, `pkg version must be >= 97.0.0, got ${pkg.version}`);
console.log('  PASS: package version 97.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-work-order-builder'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-work-order-builder'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-work-order-builder exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-work-order-builder-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '97.0.0');
console.log('  PASS: tool meta version 97.0.0');

const result = tool.buildWorkOrder({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

// workOrder structure
assert.ok(result.workOrder, 'workOrder must exist');
assert.ok(Array.isArray(result.workOrder.allowedFiles) && result.workOrder.allowedFiles.length > 0);
console.log('  PASS: workOrder.allowedFiles exists');

assert.ok(Array.isArray(result.workOrder.forbiddenFiles) && result.workOrder.forbiddenFiles.length > 0);
console.log('  PASS: workOrder.forbiddenFiles exists');

assert.ok(result.workOrder.forbiddenFiles.includes('.env'), 'forbiddenFiles must include .env');
console.log('  PASS: .env in forbiddenFiles');

assert.ok(Array.isArray(result.workOrder.verificationCommands) && result.workOrder.verificationCommands.length > 0);
console.log('  PASS: workOrder.verificationCommands exists');

assert.ok(Array.isArray(result.workOrder.doneCriteria) && result.workOrder.doneCriteria.length > 0);
console.log('  PASS: workOrder.doneCriteria exists');

assert.strictEqual(result.workOrder.humanApprovalRequired, true);
console.log('  PASS: workOrder.humanApprovalRequired true');

assert.ok(Array.isArray(result.workOrder.dangerousActionsDenied));
console.log('  PASS: workOrder.dangerousActionsDenied exists');

assert.ok(Array.isArray(result.workOrder.irreversibleActionsRequireHumanGate));
console.log('  PASS: workOrder.irreversibleActionsRequireHumanGate exists');

// agentRoles — human is final YES only
assert.ok(result.agentRoles[tool.AGENT_ROLES.HUMAN].includes('final YES only'));
console.log('  PASS: Human role is final YES only');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-pilot-work-order-builder-pack smoke PASSED ===');
