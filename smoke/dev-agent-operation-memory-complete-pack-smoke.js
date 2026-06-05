'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-operation-memory-complete-pack.fixture.json');
const tool = require('../tools/dev-agent-operation-memory-complete-pack');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== dev-agent-operation-memory-complete-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 85);
pass('package version 85.0.0 or later');

assert.ok(fs.existsSync(__filename));
pass('smoke script exists');

assert.ok(pkg.scripts['pm-agent:operation-memory-complete']);
pass('pm-agent:operation-memory-complete exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-operation-memory-complete-pack.fixture.json')));
pass('fixture exists');

assert.strictEqual(tool.TOOL_META.version, '85.0.0');
pass('tool meta version 85.0.0');

const result = tool.buildOperationMemoryComplete(fixture);

assert.ok(result.operationEventLog);
pass('includes v81 operationEventLog');

assert.ok(result.decisionMemory);
pass('includes v82 decisionMemory');

assert.ok(result.failureRetryPattern);
pass('includes v83 failureRetryPattern');

assert.ok(result.handoffAutoSummary);
pass('includes v84 handoffAutoSummary');

assert.strictEqual(result.completePackReady, true);
pass('completePackReady true when no blockers');

const blocked = tool.buildOperationMemoryComplete({ blockers: ['missing handoff'] });
assert.strictEqual(blocked.completePackReady, false);
pass('completePackReady false when blockers exist');

assert.ok(result.dangerousActionsDenied.includes('deploy'));
assert.ok(result.dangerousActionsDenied.includes('secret read'));
pass('dangerousActionsDenied correct');

console.log('=== dev-agent-operation-memory-complete-pack smoke PASSED ===');
