'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-next-best-task-selector-pack.fixture.json');
const tool = require('../tools/dev-agent-next-best-task-selector-pack');

function pass(message) { console.log(`  PASS: ${message}`); }

console.log('=== dev-agent-next-best-task-selector-pack smoke ===');

assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 86); pass('package version 86.0.0 or later');
assert.ok(fs.existsSync(__filename)); pass('smoke script exists');
assert.ok(pkg.scripts['pm-agent:next-best-task-selector']); pass('pm-agent:next-best-task-selector exists');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-next-best-task-selector-pack.fixture.json'))); pass('fixture exists');
assert.strictEqual(tool.TOOL_META.version, '86.0.0'); pass('tool meta version 86.0.0');

const result = tool.buildNextBestTaskSelector(fixture);
assert.ok(Array.isArray(result.candidateTasks) && result.candidateTasks.length > 0); pass('candidateTasks[] exists');
assert.ok(result.recommendedTask); pass('recommendedTask exists');
assert.strictEqual(tool.routeTask({ type: 'pm_design', flags: {} }), tool.ROUTES.GPT_AGENT); pass('pm_design routes to GPT_AGENT');
assert.strictEqual(tool.routeTask({ type: 'smoke_addition', flags: {} }), tool.ROUTES.CLAUDE_CODE); pass('smoke task routes to CLAUDE_CODE');
assert.ok([tool.ROUTES.HUMAN_APPROVAL, tool.ROUTES.HOLD].includes(tool.routeTask({ flags: { secret: true } }))); pass('secret routes to approval or HOLD');
assert.ok(result.dangerousActionsDenied.includes('deploy')); pass('dangerousActionsDenied correct');

console.log('=== dev-agent-next-best-task-selector-pack smoke PASSED ===');
