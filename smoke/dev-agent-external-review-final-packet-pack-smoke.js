'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-external-review-final-packet-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-external-review-final-packet-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 107, `pkg version must be >= 107.0.0, got ${pkg.version}`);
console.log('  PASS: package version 107.0.0 or later');

assert.ok(pkg.scripts['smoke:external-review-final-packet'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:external-review-final-packet'], 'pm-agent script must exist');
console.log('  PASS: pm-agent:external-review-final-packet exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-external-review-final-packet-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '107.0.0');
console.log('  PASS: tool meta version 107.0.0');

const result = tool.buildExternalReviewFinalPacket({});
assert.strictEqual(result.dryRun, true);
assert.strictEqual(result.humanApprovalRequired, true);
assert.strictEqual(result.realProductActionsExecuted, false);
console.log('  PASS: dryRun true, humanApprovalRequired true, realProductActionsExecuted false');

// 8 review areas
assert.strictEqual(tool.REVIEW_AREAS.length, 8);
console.log('  PASS: 8 review areas defined');

// packet structure
assert.ok(result.packet, 'packet must exist');
assert.ok(result.packet.reviewAreas && result.packet.reviewAreas.length === 8);
console.log('  PASS: packet reviewAreas has 8 items');

// no secrets/customer data in packet
assert.ok(result.packet.reviewAreas.every(a => a.secretsIncluded === false));
assert.ok(result.packet.reviewAreas.every(a => a.customerDataIncluded === false));
console.log('  PASS: no secrets or customer data in packet');

// redactedItems listed
assert.ok(Array.isArray(result.packet.redactedItems) && result.packet.redactedItems.length > 0);
console.log('  PASS: redactedItems listed');

// includedArtifacts
assert.ok(Array.isArray(result.packet.includedArtifacts) && result.packet.includedArtifacts.length > 0);
console.log('  PASS: includedArtifacts listed');

// openReviewQuestions
assert.ok(Array.isArray(result.packet.openReviewQuestions) && result.packet.openReviewQuestions.length > 0);
console.log('  PASS: openReviewQuestions listed');

// dangerousActionsDenied includes secrets
assert.ok(result.dangerousActionsDenied.some(d => d.includes('secrets')));
console.log('  PASS: dangerousActionsDenied includes secrets in packet');

// humanApprovalPacket
assert.ok(result.humanApprovalPacket && result.humanApprovalPacket.junyaApprovalRequired === true);
console.log('  PASS: humanApprovalPacket.junyaApprovalRequired true');

console.log('=== dev-agent-external-review-final-packet-pack smoke PASSED ===');
