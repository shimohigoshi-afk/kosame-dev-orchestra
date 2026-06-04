'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-semi-autonomous-operation-complete-pack.fixture.json');
const tool = require('../tools/dev-agent-semi-autonomous-operation-complete-pack');

function pass(message) { console.log(`  PASS: ${message}`); }

console.log('=== dev-agent-semi-autonomous-operation-complete-pack smoke ===');

assert.ok(pkg.version >= '90.0.0'); pass('package version 90.0.0 or later');
assert.ok(fs.existsSync(__filename)); pass('smoke script exists');
assert.ok(pkg.scripts['pm-agent:semi-autonomous-operation-complete']); pass('pm-agent:semi-autonomous-operation-complete exists');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-semi-autonomous-operation-complete-pack.fixture.json'))); pass('fixture exists');
assert.strictEqual(tool.TOOL_META.version, '90.0.0'); pass('tool meta version 90.0.0');

const result = tool.buildSemiAutonomousOperationComplete(fixture);
assert.ok(result.nextBestTaskSelector); pass('includes v86 nextBestTaskSelector');
assert.ok(result.gptTaskPromptBuilder); pass('includes v87 gptTaskPromptBuilder');
assert.ok(result.acceptanceGateAutoReviewer); pass('includes v88 acceptanceGateAutoReviewer');
assert.ok(result.releaseCandidateBuilder); pass('includes v89 releaseCandidateBuilder');
assert.strictEqual(result.completeCriteria.inputFileSupportConfirmed, true); pass('inputFileSupportConfirmed true');
assert.ok(result.humanApprovalPacket); pass('humanApprovalPacket exists');
assert.strictEqual(result.completePackReady, true); pass('completePackReady true when no blockers');
assert.strictEqual(tool.buildSemiAutonomousOperationComplete({ blockers: ['missing approval'] }).completePackReady, false); pass('completePackReady false when blockers exist');
assert.ok(result.dangerousActionsDenied.includes('deploy')); pass('dangerousActionsDenied correct');

console.log('=== dev-agent-semi-autonomous-operation-complete-pack smoke PASSED ===');
