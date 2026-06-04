'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-external-se-review-packet-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-external-se-review-packet-pack smoke ===');

// package version >= 51
assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 51, `pkg version must be >= 51.0.0, got ${pkg.version}`);
console.log('  PASS: package version 51.0.0 or later');

assert.ok(pkg.scripts['smoke:external-se-review-packet'], 'smoke:external-se-review-packet must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:external-se-review-packet'], 'pm-agent:external-se-review-packet must exist');
console.log('  PASS: pm-agent:external-se-review-packet exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-external-se-review-packet-pack.fixture.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '51.0.0', 'tool version must be 51.0.0');
console.log('  PASS: tool meta version 51.0.0');

const packet = tool.buildReviewPacket({});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// reviewScope includes required categories
const scope = packet.reviewScope;
assert.ok(Array.isArray(scope) && scope.length >= 4, 'reviewScope must have 4+ items');
assert.ok(scope.some(s => s.toLowerCase().includes('security')),         'reviewScope must include security');
assert.ok(scope.some(s => s.toLowerCase().includes('cloud run') || s.toLowerCase().includes('iam')), 'reviewScope must include Cloud Run/IAM');
assert.ok(scope.some(s => s.toLowerCase().includes('customer') || s.toLowerCase().includes('insurance')), 'reviewScope must include customer data');
assert.ok(scope.some(s => s.toLowerCase().includes('production')),       'reviewScope must include production readiness');
console.log('  PASS: reviewScope includes security/Cloud Run/IAM/customer data/production readiness');

// outOfScope excludes docs-only/simple work
const outOfScope = packet.outOfScope;
assert.ok(Array.isArray(outOfScope) && outOfScope.length >= 4, 'outOfScope must have 4+ items');
assert.ok(outOfScope.some(s => s.toLowerCase().includes('docs') || s.toLowerCase().includes('readme')), 'outOfScope must include docs/README work');
assert.ok(outOfScope.some(s => s.toLowerCase().includes('commit') || s.toLowerCase().includes('push') || s.toLowerCase().includes('tag')), 'outOfScope must include commit/push/tag proxy');
assert.ok(outOfScope.some(s => s.toLowerCase().includes('deploy')), 'outOfScope must include deploy proxy');
console.log('  PASS: outOfScope excludes docs-only/simple/commit/push/tag/deploy proxy');

// questionsForExternalSE exists
assert.ok(Array.isArray(packet.questionsForExternalSE) && packet.questionsForExternalSE.length > 0, 'questionsForExternalSE must exist');
console.log('  PASS: questionsForExternalSE exists');

// dangerousActionsDenied correct
const denied = packet.dangerousActionsDenied;
assert.ok(Array.isArray(denied) && denied.some(d => d.includes('deploy')), 'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(denied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// riskAreas and required fields
assert.ok(Array.isArray(packet.riskAreas) && packet.riskAreas.length > 0, 'riskAreas must exist');
assert.ok(packet.riskAreas.every(r => r.area && r.severity), 'each riskArea must have area and severity');
console.log('  PASS: riskAreas with severity');

assert.ok(packet.reviewPacketId, 'reviewPacketId must exist');
assert.ok(packet.handoffNote,    'handoffNote must exist');
console.log('  PASS: reviewPacketId and handoffNote exist');

console.log('=== dev-agent-external-se-review-packet-pack smoke PASSED ===');
