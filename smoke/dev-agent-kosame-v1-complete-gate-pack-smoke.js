'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-kosame-v1-complete-gate-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-kosame-v1-complete-gate-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 110, `pkg version must be >= 110.0.0, got ${pkg.version}`);
console.log('  PASS: package version 110.0.0 or later');

assert.ok(pkg.scripts['smoke:kosame-v1-complete-gate'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:kosame-v1-complete-gate'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:kosame-v1-complete-gate exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-kosame-v1-complete-gate-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '110.0.0');
console.log('  PASS: tool meta version 110.0.0');

const result = tool.buildKosameV1CompleteGate({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

// default decision: V1_READY_WITH_REVIEW (high risks exist)
assert.ok([tool.V1_DECISIONS.V1_COMPLETE, tool.V1_DECISIONS.V1_READY_WITH_REVIEW].includes(result.decision),
  `expected V1_COMPLETE or V1_READY_WITH_REVIEW, got ${result.decision}`);
console.log('  PASS: default decision is V1_COMPLETE or V1_READY_WITH_REVIEW');

// guardian not ready → BLOCKED
const noGuardian = tool.buildKosameV1CompleteGate({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.V1_DECISIONS.BLOCKED);
console.log('  PASS: guardianReady=false → BLOCKED');

// blockers → BLOCKED
const withBlockers = tool.buildKosameV1CompleteGate({ blockers: ['critical issue'] });
assert.strictEqual(withBlockers.decision, tool.V1_DECISIONS.BLOCKED);
console.log('  PASS: blockers → BLOCKED');

// decisionOptions
const decisionOpts = Object.values(tool.V1_DECISIONS);
assert.ok(decisionOpts.includes('V1_COMPLETE'));
assert.ok(decisionOpts.includes('V1_READY_WITH_REVIEW'));
assert.ok(decisionOpts.includes('NEEDS_MORE_WORK'));
assert.ok(decisionOpts.includes('BLOCKED'));
console.log('  PASS: all 4 decision options exist');

// sub-gates integrated
assert.ok(result.pilotOperationCompleteGate, 'pilotOperationCompleteGate must be integrated');
assert.ok(result.pilotToProductionBridgeGate, 'pilotToProductionBridgeGate must be integrated');
assert.ok(result.v1ReadinessAudit, 'v1ReadinessAudit must be integrated');
assert.ok(result.externalReviewPacket, 'externalReviewPacket must be integrated');
assert.ok(result.costSpeedQualityScorecard, 'costSpeedQualityScorecard must be integrated');
assert.ok(result.productExpansionRoadmap, 'productExpansionRoadmap must be integrated');
console.log('  PASS: all sub-gates v96-v109 integrated');

// completedPacks covers v96-v110
assert.ok(result.completedPacks['v96'], 'v96 pack must be listed');
assert.ok(result.completedPacks['v110'], 'v110 pack must be listed');
assert.strictEqual(Object.keys(result.completedPacks).length, 15);
console.log('  PASS: completedPacks lists all 15 versions v96-v110');

// remainingRisks
assert.ok(Array.isArray(result.remainingRisks) && result.remainingRisks.length > 0);
console.log('  PASS: remainingRisks exists');

// nextCommandsForHumanOwner
assert.ok(Array.isArray(result.nextCommandsForHumanOwner) && result.nextCommandsForHumanOwner.length > 0);
console.log('  PASS: nextCommandsForHumanOwner exists');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

// backupRequired
assert.strictEqual(result.backupRequired, true);
console.log('  PASS: backupRequired true');

// checkpointVersion
assert.strictEqual(result.checkpointVersion, 'v110.0.0');
console.log('  PASS: checkpointVersion v110.0.0');

// dangerousActionsDenied
const denied = result.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')));
assert.ok(denied.some(d => d.includes('customer data')));
assert.ok(denied.some(d => d.includes('secret')));
assert.ok(denied.some(d => d.includes('real send')));
console.log('  PASS: dangerousActionsDenied includes deploy/customer data/secret/real send');

// productExpansionPlan
assert.ok(result.productExpansionPlan, 'productExpansionPlan must exist');
assert.ok(result.productExpansionPlan.pilotReady, 'productExpansionPlan.pilotReady must exist');
console.log('  PASS: productExpansionPlan exists');

// auditScore
assert.ok(result.auditScore && typeof result.auditScore.total === 'number');
console.log('  PASS: auditScore exists');

// nextPhaseRoadmap
assert.ok(Array.isArray(result.nextPhaseRoadmap) && result.nextPhaseRoadmap.length > 0);
console.log('  PASS: nextPhaseRoadmap exists');

console.log('=== dev-agent-kosame-v1-complete-gate-pack smoke PASSED ===');
