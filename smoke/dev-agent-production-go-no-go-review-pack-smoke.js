'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-production-go-no-go-review-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-production-go-no-go-review-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 53, `pkg version must be >= 53.0.0, got ${pkg.version}`);
console.log('  PASS: package version 53.0.0 or later');

assert.ok(pkg.scripts['smoke:production-go-no-go-review'], 'smoke:production-go-no-go-review must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:production-go-no-go-review'], 'pm-agent:production-go-no-go-review must exist');
console.log('  PASS: pm-agent:production-go-no-go-review exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-production-go-no-go-review-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '53.0.0', 'tool version must be 53.0.0');
console.log('  PASS: tool meta version 53.0.0');

// decisionOptions include GO/HOLD/NO_GO
const opts_clean = { allRequiredChecksPassed: true, deployApproved: true, rollbackPlanReady: true };
const clean = tool.buildGoNoGoReview(opts_clean);

assert.strictEqual(clean.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(clean.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(Array.isArray(clean.decisionOptions), 'decisionOptions must be array');
assert.ok(clean.decisionOptions.includes('GO'),    'decisionOptions must include GO');
assert.ok(clean.decisionOptions.includes('HOLD'),  'decisionOptions must include HOLD');
assert.ok(clean.decisionOptions.includes('NO_GO'), 'decisionOptions must include NO_GO');
console.log('  PASS: decisionOptions include GO/HOLD/NO_GO');

// no blockers + all checks passed → GO
assert.strictEqual(clean.decision, 'GO', `Expected GO, got ${clean.decision}`);
console.log('  PASS: no blockers + all checks passed → GO');

// secret leak risk → NO_GO
const secretLeak = tool.buildGoNoGoReview({ secretLeakRisk: true });
assert.strictEqual(secretLeak.decision, 'NO_GO', `Expected NO_GO for secretLeakRisk, got ${secretLeak.decision}`);
console.log('  PASS: secret leak risk → NO_GO');

// deploy unapproved → HOLD
const deployUnapp = tool.buildGoNoGoReview({ deployApproved: false });
assert.strictEqual(deployUnapp.decision, 'HOLD', `Expected HOLD for deployApproved=false, got ${deployUnapp.decision}`);
console.log('  PASS: deploy unapproved → HOLD');

// rollback missing → HOLD
const noRollback = tool.buildGoNoGoReview({ rollbackPlanReady: false });
assert.strictEqual(noRollback.decision, 'HOLD', `Expected HOLD for rollbackPlanReady=false, got ${noRollback.decision}`);
console.log('  PASS: rollback missing → HOLD');

// customer data boundary unknown → HOLD or NO_GO
const dataUnknown = tool.buildGoNoGoReview({ customerDataBoundaryUnknown: true, customerDataSeverity: 'critical' });
assert.ok(['HOLD', 'NO_GO'].includes(dataUnknown.decision), `Expected HOLD or NO_GO for customerDataBoundaryUnknown, got ${dataUnknown.decision}`);
console.log('  PASS: customer/insurance data boundary unknown → HOLD or NO_GO');

// warnings only → GO_WITH_CAUTION
const withWarnings = tool.buildGoNoGoReview({ allRequiredChecksPassed: true, deployApproved: true, rollbackPlanReady: true, warnings: ['minor logging concern'] });
assert.ok(['GO', 'GO_WITH_CAUTION'].includes(withWarnings.decision), `Expected GO or GO_WITH_CAUTION, got ${withWarnings.decision}`);
console.log('  PASS: warnings only → GO or GO_WITH_CAUTION');

// dangerousActionsDenied correct
const denied = clean.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

// required fields
assert.ok(clean.reviewId,           'reviewId must exist');
assert.ok(clean.finalHumanApprover, 'finalHumanApprover must exist');
assert.ok(clean.decisionReason,     'decisionReason must exist');
console.log('  PASS: reviewId/finalHumanApprover/decisionReason exist');

// DECISION export
assert.ok(tool.DECISION.GO    === 'GO',    'DECISION.GO must be exported');
assert.ok(tool.DECISION.HOLD  === 'HOLD',  'DECISION.HOLD must be exported');
assert.ok(tool.DECISION.NO_GO === 'NO_GO', 'DECISION.NO_GO must be exported');
console.log('  PASS: DECISION constants exported');

console.log('=== dev-agent-production-go-no-go-review-pack smoke PASSED ===');
