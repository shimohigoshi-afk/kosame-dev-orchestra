'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const pkg = require('../package.json');
const fixture = require('../fixtures/dev-agent-acceptance-gate-auto-reviewer-pack.fixture.json');
const tool = require('../tools/dev-agent-acceptance-gate-auto-reviewer-pack');

function pass(message) { console.log(`  PASS: ${message}`); }

console.log('=== dev-agent-acceptance-gate-auto-reviewer-pack smoke ===');

assert.ok(pkg.version >= '88.0.0'); pass('package version 88.0.0 or later');
assert.ok(fs.existsSync(__filename)); pass('smoke script exists');
assert.ok(pkg.scripts['pm-agent:acceptance-gate-auto-reviewer']); pass('pm-agent:acceptance-gate-auto-reviewer exists');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-acceptance-gate-auto-reviewer-pack.fixture.json'))); pass('fixture exists');
assert.strictEqual(tool.TOOL_META.version, '88.0.0'); pass('tool meta version 88.0.0');

const result = tool.buildAcceptanceGateAutoReviewer(fixture);
for (const decision of ['YES', 'REVISE', 'HOLD', 'BLOCKED', 'COMMIT_CANDIDATE']) assert.ok(result.decisionOptions.includes(decision));
pass('decision options include YES/REVISE/HOLD/BLOCKED/COMMIT_CANDIDATE');
assert.strictEqual(tool.buildAcceptanceGateAutoReviewer({ inputReport: { note: 'verify replaced by node -e' } }).decision, 'REVISE'); pass('verify node-e routes to REVISE');
assert.strictEqual(tool.buildAcceptanceGateAutoReviewer({ inputReport: { note: 'secret read and deploy executed' } }).decision, 'BLOCKED'); pass('secret/deploy routes to BLOCKED');
assert.ok(result.dangerousActionsDenied.includes('deploy')); pass('dangerousActionsDenied correct');

console.log('=== dev-agent-acceptance-gate-auto-reviewer-pack smoke PASSED ===');
