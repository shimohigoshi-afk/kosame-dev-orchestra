'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-pilot-acceptance-review-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-pilot-acceptance-review-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 99, `pkg version must be >= 99.0.0, got ${pkg.version}`);
console.log('  PASS: package version 99.0.0 or later');

assert.ok(pkg.scripts['smoke:pilot-acceptance-review'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:pilot-acceptance-review'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:pilot-acceptance-review exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-pilot-acceptance-review-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '99.0.0');
console.log('  PASS: tool meta version 99.0.0');

const result = tool.buildPilotAcceptanceReview({});
assert.strictEqual(result.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: realProductActionsExecuted false');

assert.strictEqual(result.decision, tool.ACCEPTANCE_DECISIONS.PILOT_READY);
console.log('  PASS: default decision is PILOT_READY');

// guardian not ready → BLOCKED
const noGuardian = tool.buildPilotAcceptanceReview({ guardianReady: false });
assert.strictEqual(noGuardian.decision, tool.ACCEPTANCE_DECISIONS.BLOCKED);
console.log('  PASS: guardianReady=false → BLOCKED');

// dryRun failed → REVISE
const dryRunFailed = tool.buildPilotAcceptanceReview({ dryRunPassed: false });
assert.strictEqual(dryRunFailed.decision, tool.ACCEPTANCE_DECISIONS.REVISE);
console.log('  PASS: dryRunPassed=false → REVISE');

// dataBoundary not ready → HOLD
const noData = tool.buildPilotAcceptanceReview({ dataBoundaryReady: false });
assert.strictEqual(noData.decision, tool.ACCEPTANCE_DECISIONS.HOLD);
console.log('  PASS: dataBoundaryReady=false → HOLD');

// readiness checks exist
assert.ok(result.guardianReadiness && result.guardianReadiness.status);
assert.ok(result.revenueReadiness && result.revenueReadiness.status);
assert.ok(result.dataBoundaryReadiness && result.dataBoundaryReadiness.status);
assert.ok(result.dryRunReadiness && result.dryRunReadiness.status);
console.log('  PASS: all readiness checks present');

// reviewSummary
assert.ok(result.reviewSummary && typeof result.reviewSummary.totalProducts === 'number');
console.log('  PASS: reviewSummary exists');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

// nextAction
assert.ok(typeof result.nextAction === 'string' && result.nextAction.length > 0);
console.log('  PASS: nextAction exists');

// decisionOptions
assert.ok(Array.isArray(result.decisionOptions) && result.decisionOptions.includes('PILOT_READY'));
assert.ok(result.decisionOptions.includes('REVISE'));
assert.ok(result.decisionOptions.includes('HOLD'));
assert.ok(result.decisionOptions.includes('BLOCKED'));
console.log('  PASS: all decision options present');

console.log('=== dev-agent-pilot-acceptance-review-pack smoke PASSED ===');
