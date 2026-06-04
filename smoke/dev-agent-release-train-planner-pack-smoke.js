'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-release-train-planner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-release-train-planner-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 59, `pkg version must be >= 59.0.0, got ${pkg.version}`);
console.log('  PASS: package version 59.0.0 or later');

assert.ok(pkg.scripts['smoke:release-train-planner'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:release-train-planner'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:release-train-planner exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-release-train-planner-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '59.0.0', 'tool version must be 59.0.0');
console.log('  PASS: tool meta version 59.0.0');

const plan = tool.buildReleaseTrain({});

assert.strictEqual(plan.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(plan.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// candidateReleases[] has 5+ items
assert.ok(Array.isArray(plan.candidateReleases) && plan.candidateReleases.length >= 5, 'candidateReleases must have 5+ items');
console.log('  PASS: candidateReleases[] has 5+ items');

// releaseLanes include all 5 required lanes
const LANES = tool.LANES;
assert.ok(plan.releaseLanes.hasOwnProperty(LANES.NOW),             'releaseLanes must have now');
assert.ok(plan.releaseLanes.hasOwnProperty(LANES.NEXT),            'releaseLanes must have next');
assert.ok(plan.releaseLanes.hasOwnProperty(LANES.HOLD),            'releaseLanes must have hold');
assert.ok(plan.releaseLanes.hasOwnProperty(LANES.EXTERNAL_REVIEW), 'releaseLanes must have external_review');
assert.ok(plan.releaseLanes.hasOwnProperty(LANES.PRODUCTION_GATE), 'releaseLanes must have production_gate');
console.log('  PASS: releaseLanes include now/next/hold/external_review/production_gate');

// blockers route to hold
const blockedCandidate = { productId: 'test_blocked', targetVersion: 'v1', releaseType: 'minor', priority: 'low', readiness: 'ready', dependencies: [], blockers: ['pending review'], riskLevel: 'low', recommendedWindow: 'hold', goNoGoRequired: false, externalReviewRequired: false, productionImpact: false };
assert.strictEqual(tool.assignLane(blockedCandidate), LANES.HOLD, 'candidate with blockers must go to HOLD');
console.log('  PASS: blockers route to hold');

// externalReviewRequired routes to external_review
const extReviewCandidate = { productId: 'test_ext', targetVersion: 'v1', releaseType: 'minor', priority: 'high', readiness: 'ready', dependencies: [], blockers: [], riskLevel: 'high', recommendedWindow: 'external_review', goNoGoRequired: false, externalReviewRequired: true, productionImpact: false };
assert.strictEqual(tool.assignLane(extReviewCandidate), LANES.EXTERNAL_REVIEW, 'externalReviewRequired must go to external_review');
console.log('  PASS: externalReviewRequired routes to external_review');

// productionImpact routes to production_gate
const prodCandidate = { productId: 'test_prod', targetVersion: 'v1', releaseType: 'ops', priority: 'high', readiness: 'ready', dependencies: [], blockers: [], riskLevel: 'high', recommendedWindow: 'production_gate', goNoGoRequired: true, externalReviewRequired: false, productionImpact: true };
assert.strictEqual(tool.assignLane(prodCandidate), LANES.PRODUCTION_GATE, 'productionImpact must go to production_gate');
console.log('  PASS: productionImpact routes to production_gate');

// docs/smoke ready item routes to now or next
const safeCandidate = { productId: 'test_safe', targetVersion: 'v1', releaseType: 'docs', priority: 'low', readiness: 'ready', dependencies: [], blockers: [], riskLevel: 'low', recommendedWindow: 'now', goNoGoRequired: false, externalReviewRequired: false, productionImpact: false, taskTypeOnly: 'docs_smoke' };
assert.ok([LANES.NOW, LANES.NEXT].includes(tool.assignLane(safeCandidate)), `docs/smoke ready item must go to now or next, got ${tool.assignLane(safeCandidate)}`);
console.log('  PASS: docs/smoke ready item routes to now or next');

// recommendedSequence exists
assert.ok(Array.isArray(plan.recommendedSequence) && plan.recommendedSequence.length > 0, 'recommendedSequence must exist');
console.log('  PASS: recommendedSequence exists');

// humanApprovalPacket exists
assert.ok(plan.humanApprovalPacket && plan.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// dangerousActionsDenied correct
const denied = plan.dangerousActionsDenied;
assert.ok(denied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

console.log('=== dev-agent-release-train-planner-pack smoke PASSED ===');
