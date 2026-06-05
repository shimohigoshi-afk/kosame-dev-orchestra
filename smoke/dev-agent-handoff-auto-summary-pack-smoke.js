'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-handoff-auto-summary-pack.fixture.json');
const tool = require('../tools/dev-agent-handoff-auto-summary-pack');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== dev-agent-handoff-auto-summary-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 84);
pass('package version 84.0.0 or later');

assert.ok(fs.existsSync(__filename));
pass('smoke script exists');

assert.ok(pkg.scripts['pm-agent:handoff-auto-summary']);
pass('pm-agent:handoff-auto-summary exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-handoff-auto-summary-pack.fixture.json')));
pass('fixture exists');

assert.strictEqual(tool.TOOL_META.version, '84.0.0');
pass('tool meta version 84.0.0');

const result = tool.buildHandoffAutoSummary(fixture);

for (const audience of ['next_kosame', 'claude_code', 'external_se', 'human_owner']) {
  assert.ok(result.targetAudience.includes(audience));
}
pass('targetAudience includes next_kosame/claude_code/external_se/human_owner');

const milestones = result.milestoneSummary.map((m) => m.version).join(',');
for (const version of ['v44.0.0', 'v60.0.0', 'v65.0.0', 'v75.0.0', 'v80.0.0']) {
  assert.ok(milestones.includes(version));
}
pass('milestoneSummary includes v44/v60/v65/v75/v80');

assert.ok(Array.isArray(result.doNotForget) && result.doNotForget.length > 0);
pass('doNotForget exists');

assert.ok(result.dangerousActionsDenied.includes('deploy'));
assert.ok(result.dangerousActionsDenied.includes('secret read'));
pass('dangerousActionsDenied correct');

console.log('=== dev-agent-handoff-auto-summary-pack smoke PASSED ===');
