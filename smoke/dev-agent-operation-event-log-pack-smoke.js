'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-operation-event-log-pack.fixture.json');
const tool = require('../tools/dev-agent-operation-event-log-pack');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== dev-agent-operation-event-log-pack smoke ===');

assert.ok(pkg.version >= '81.0.0');
pass('package version 81.0.0 or later');

assert.ok(fs.existsSync(__filename));
pass('smoke script exists');

assert.ok(pkg.scripts['pm-agent:operation-event-log']);
pass('pm-agent:operation-event-log exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-operation-event-log-pack.fixture.json')));
pass('fixture exists');

assert.strictEqual(tool.TOOL_META.version, '81.0.0');
pass('tool meta version 81.0.0');

const result = tool.buildOperationEventLog(fixture);

assert.strictEqual(result.dryRun, true);
pass('dryRun true');

assert.strictEqual(result.humanApprovalRequired, true);
pass('humanApprovalRequired true');

assert.ok(Array.isArray(result.events) && result.events.length > 0);
pass('events[] exists');

for (const event of result.events) {
  assert.ok(event.actor);
  assert.ok(event.action);
  assert.ok(event.result);
  assert.ok(event.nextAction);
}
pass('each event has actor/action/result/nextAction');

assert.ok(result.eventSummary);
pass('eventSummary exists');

assert.ok(result.dangerousActionsDenied.includes('deploy'));
assert.ok(result.dangerousActionsDenied.includes('secret read'));
pass('dangerousActionsDenied correct');

console.log('=== dev-agent-operation-event-log-pack smoke PASSED ===');
