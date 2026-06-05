'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-decision-memory-pack.fixture.json');
const tool = require('../tools/dev-agent-decision-memory-pack');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== dev-agent-decision-memory-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 82);
pass('package version 82.0.0 or later');

assert.ok(fs.existsSync(__filename));
pass('smoke script exists');

assert.ok(pkg.scripts['pm-agent:decision-memory']);
pass('pm-agent:decision-memory exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-decision-memory-pack.fixture.json')));
pass('fixture exists');

assert.strictEqual(tool.TOOL_META.version, '82.0.0');
pass('tool meta version 82.0.0');

const result = tool.buildDecisionMemory(fixture);

assert.strictEqual(result.dryRun, true);
pass('dryRun true');

assert.ok(Array.isArray(result.decisions) && result.decisions.length > 0);
pass('decisions[] exists');

for (const option of ['YES', 'NO', 'HOLD', 'REVISE']) {
  assert.ok(result.decisionOptions.includes(option));
}
pass('decision options include YES/NO/HOLD/REVISE');

assert.ok(result.decisions.some((d) => d.humanApprover));
pass('humanApprover exists');

assert.ok(result.decisions.some((d) => d.reuseHint));
assert.ok(result.decisions.some((d) => d.futureTrigger));
pass('reuseHint and futureTrigger exist');

assert.ok(result.dangerousActionsDenied.includes('deploy'));
assert.ok(result.dangerousActionsDenied.includes('secret read'));
pass('dangerousActionsDenied correct');

console.log('=== dev-agent-decision-memory-pack smoke PASSED ===');
