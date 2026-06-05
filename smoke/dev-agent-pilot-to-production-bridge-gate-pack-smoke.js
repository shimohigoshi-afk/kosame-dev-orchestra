'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-to-production-bridge-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-to-production-bridge-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 105, `pkg version must be >= 105.0.0, got ${pkg.version}`);
console.log('  PASS: package version 105.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-to-production-bridge-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-to-production-bridge-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-to-production-bridge-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-to-production-bridge-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '105.0.0');
console.log('  PASS: tool meta version 105.0.0');

const result = tool.buildPilotToProductionBridgeGate({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

assert.strictEqual(result.decision, tool.BRIDGE_DECISIONS.PRODUCTION_BRIDGE_READY);
console.log('  PASS: default decision PRODUCTION_BRIDGE_READY');

assert.strictEqual(result.completePackReady, true);
console.log('  PASS: completePackReady true by default');

// guardian not ready → HOLD
const noGuardian = tool.buildPilotToProductionBridgeGate({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.BRIDGE_DECISIONS.HOLD);
console.log('  PASS: guardianReady=false → HOLD');

// blockers → BLOCKED
const blocked = tool.buildPilotToProductionBridgeGate({ blockers: ['x'] });
assert.strictEqual(blocked.decision, tool.BRIDGE_DECISIONS.BLOCKED);
console.log('  PASS: blockers → BLOCKED');

// missing external review → NEEDS_REVIEW
const noExtReview = tool.buildPilotToProductionBridgeGate({ externalReviewDone: false });
assert.strictEqual(noExtReview.decision, tool.BRIDGE_DECISIONS.NEEDS_REVIEW);
console.log('  PASS: externalReviewDone=false → NEEDS_REVIEW');

// sub-packs integrated
assert.ok(result.operatorRunbook, 'operatorRunbook must be integrated');
assert.ok(result.approvalCompression, 'approvalCompression must be integrated');
assert.ok(result.feedbackCapture, 'feedbackCapture must be integrated');
assert.ok(result.revisionSprints, 'revisionSprints must be integrated');
console.log('  PASS: v101-v104 sub-packs integrated');

assert.strictEqual(result.checkpointVersion, 'v105.0.0');
console.log('  PASS: checkpointVersion v105.0.0');

// production checklist
assert.ok(Array.isArray(result.productionReadinessChecklist) && result.productionReadinessChecklist.length > 0);
console.log('  PASS: productionReadinessChecklist exists');

// no deploy in dangerousActionsDenied
assert.ok(result.dangerousActionsDenied.some(d => d.includes('deploy')));
console.log('  PASS: dangerousActionsDenied includes deploy');

console.log('=== dev-agent-pilot-to-production-bridge-gate-pack smoke PASSED ===');
