'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-first-pilot-operation-complete-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-first-pilot-operation-complete-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 100, `pkg version must be >= 100.0.0, got ${pkg.version}`);
console.log('  PASS: package version 100.0.0 or later');

assert.ok(pkg.scripts['smoke:first-pilot-operation-complete-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-pilot-operation-complete-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:first-pilot-operation-complete-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-first-pilot-operation-complete-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '100.0.0');
console.log('  PASS: tool meta version 100.0.0');

const result = tool.buildFirstPilotOperationCompleteGate({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

assert.strictEqual(result.decision, tool.GATE_DECISIONS.FIRST_PILOT_READY);
console.log('  PASS: default decision FIRST_PILOT_READY');

assert.strictEqual(result.completePackReady, true);
console.log('  PASS: completePackReady true when no blockers');

// guardian not ready → HOLD
const noGuardian = tool.buildFirstPilotOperationCompleteGate({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.GATE_DECISIONS.HOLD);
console.log('  PASS: guardianReady=false → HOLD');

// blockers → BLOCKED
const withBlockers = tool.buildFirstPilotOperationCompleteGate({ blockers: ['x'] });
assert.strictEqual(withBlockers.decision, tool.GATE_DECISIONS.BLOCKED);
assert.strictEqual(withBlockers.completePackReady, false);
console.log('  PASS: blockers → BLOCKED, completePackReady false');

// sub-gates integrated
assert.ok(result.pilotScopeLock, 'pilotScopeLock must be integrated');
assert.ok(result.workOrder, 'workOrder must be integrated');
assert.ok(result.dryRunPlan, 'dryRunPlan must be integrated');
assert.ok(result.acceptanceReview, 'acceptanceReview must be integrated');
console.log('  PASS: v96-v99 sub-gates integrated');

assert.strictEqual(result.checkpointVersion, 'v100.0.0');
console.log('  PASS: checkpointVersion v100.0.0');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

// dangerousActionsDenied
assert.ok(Array.isArray(result.dangerousActionsDenied) && result.dangerousActionsDenied.length > 0);
console.log('  PASS: dangerousActionsDenied exists');

console.log('=== dev-agent-first-pilot-operation-complete-gate-pack smoke PASSED ===');
