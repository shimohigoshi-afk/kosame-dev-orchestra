'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-scope-lock-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-scope-lock-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 96, `pkg version must be >= 96.0.0, got ${pkg.version}`);
console.log('  PASS: package version 96.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-scope-lock'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-scope-lock'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-scope-lock exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-scope-lock-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '96.0.0');
console.log('  PASS: tool meta version 96.0.0');

// default run
const result = tool.buildPilotScopeLock({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

assert.strictEqual(result.pilotProduct, 'anesty_board');
console.log('  PASS: pilotProduct is anesty_board');

assert.strictEqual(result.decision, tool.PILOT_DECISIONS.ANESTY_BOARD_PILOT);
console.log('  PASS: default decision is ANESTY_BOARD_PILOT');

// guardian not ready → HOLD
const noGuardian = tool.buildPilotScopeLock({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.PILOT_DECISIONS.HOLD);
console.log('  PASS: guardianReady=false → HOLD');

// blockers → BLOCKED
const withBlockers = tool.buildPilotScopeLock({ blockers: ['missing approval'] });
assert.strictEqual(withBlockers.decision, tool.PILOT_DECISIONS.BLOCKED);
console.log('  PASS: blockers present → BLOCKED');

// productStatus includes sales_dx as HOLD
assert.ok(result.productStatus.sales_dx, 'productStatus must include sales_dx');
assert.ok(result.productStatus.sales_dx.holdReason, 'sales_dx must have holdReason');
console.log('  PASS: sales_dx has holdReason (data boundary not cleared)');

// dangerousActionsDenied includes customer data
assert.ok(result.dangerousActionsDenied.some(d => d.includes('customer data')));
console.log('  PASS: dangerousActionsDenied includes customer data');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

// approvalGates exist
assert.ok(Array.isArray(result.approvalGates) && result.approvalGates.length > 0);
console.log('  PASS: approvalGates exist');

console.log('=== dev-agent-pilot-scope-lock-pack smoke PASSED ===');
