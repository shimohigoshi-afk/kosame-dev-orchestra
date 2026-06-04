'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-failure-retry-pattern-pack.fixture.json');
const tool = require('../tools/dev-agent-failure-retry-pattern-pack');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== dev-agent-failure-retry-pattern-pack smoke ===');

assert.ok(pkg.version >= '83.0.0');
pass('package version 83.0.0 or later');

assert.ok(fs.existsSync(__filename));
pass('smoke script exists');

assert.ok(pkg.scripts['pm-agent:failure-retry-pattern']);
pass('pm-agent:failure-retry-pattern exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-failure-retry-pattern-pack.fixture.json')));
pass('fixture exists');

assert.strictEqual(tool.TOOL_META.version, '83.0.0');
pass('tool meta version 83.0.0');

const result = tool.buildFailureRetryPattern(fixture);

const symptoms = result.knownFailures.map((f) => f.symptom).join('\n');
for (const required of [
  'verify script replaced by node -e',
  'simulated verification without real logs',
  'wrong relative path in tools/smoke',
  'git add -A included unexpected files',
  'docs count mismatch'
]) {
  assert.ok(symptoms.includes(required));
}
pass('knownFailures include verify node-e / simulated verification / relative path / git add -A / docs count mismatch');

assert.ok(Array.isArray(result.antiLoopRules) && result.antiLoopRules.length > 0);
pass('antiLoopRules exists');

assert.ok(result.dangerousActionsDenied.includes('deploy'));
assert.ok(result.dangerousActionsDenied.includes('secret read'));
pass('dangerousActionsDenied correct');

console.log('=== dev-agent-failure-retry-pattern-pack smoke PASSED ===');
