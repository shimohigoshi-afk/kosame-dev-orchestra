#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.21 Real-time Dashboard
 *
 * Verifies:
 *   - package version >= 110.21.0
 *   - TOOL_META exports
 *   - buildDashboardState() returns correct shape
 *   - dryRun=true by default
 *   - agents section has gemini/gpt/claude/grok
 *   - cost section has totalUsd and byProvider
 *   - workLog is an array
 *   - renderHtml() returns a non-empty HTML string
 *   - parseArgs() handles --port and --live flags
 *   - npm run dashboard script exists
 * No HTTP server is started in this smoke.
 */

const assert = require('node:assert');
const pkg    = require('../package.json');
const dash   = require('../tools/kosame-dashboard-server');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.21 dashboard smoke ===');

// Version
assert.ok(pkg.version >= '110.21.0');
pass('package version >= 110.21.0');

// TOOL_META
assert.strictEqual(dash.TOOL_META.version, '110.22.0');
pass('TOOL_META.version is 110.22.0');

assert.strictEqual(dash.TOOL_META.feature, 'v110-22-multi-project-dashboard');
pass('TOOL_META.feature is v110-22-multi-project-dashboard');

// npm scripts
assert.ok(pkg.scripts['dashboard'], 'npm run dashboard must exist');
pass('npm run dashboard script exists');

assert.ok(pkg.scripts['smoke:v110-21-dashboard'], 'smoke script must exist');
pass('smoke:v110-21-dashboard script exists');

// buildDashboardState — shape
const state = dash.buildDashboardState({ dryRun: true });

assert.strictEqual(state.dryRun, true);
pass('buildDashboardState: dryRun=true');

assert.ok(typeof state.version === 'string');
pass('state.version is string');

assert.ok(typeof state.ts === 'string');
pass('state.ts is ISO string');

// agents
const agents = state.agents;
assert.ok(agents, 'state.agents must exist');
for (const key of ['gemini', 'gpt', 'claude', 'grok']) {
  assert.ok(agents[key], `agents.${key} must exist`);
  assert.ok(['active', 'recent', 'idle'].includes(agents[key].status),
    `agents.${key}.status must be active/recent/idle`);
  assert.ok(typeof agents[key].label === 'string');
  assert.ok(typeof agents[key].model === 'string');
  assert.ok(typeof agents[key].keyPresent === 'boolean');
  pass(`agents.${key} has correct shape`);
}

// cost
const cost = state.cost;
assert.ok(cost, 'state.cost must exist');
assert.ok(typeof cost.totalUsd === 'number', 'cost.totalUsd must be number');
assert.ok(typeof cost.byProvider === 'object', 'cost.byProvider must be object');
pass('cost section has correct shape');

// workLog
assert.ok(Array.isArray(state.workLog), 'state.workLog must be an array');
assert.ok(state.workLog.length > 0, 'workLog must have entries');
pass(`workLog has ${state.workLog.length} entries`);

for (const entry of state.workLog.slice(0, 3)) {
  assert.ok(entry.agent || entry.role, 'workLog entry must have agent or role');
  assert.ok(entry.action, 'workLog entry must have action');
}
pass('workLog entries have required fields');

// renderHtml
const html = dash.renderHtml();
assert.ok(typeof html === 'string' && html.length > 500);
assert.ok(html.includes('<!DOCTYPE html>'));
assert.ok(html.includes('KOSAME Dev Orchestra'));
assert.ok(html.includes('/api/events'));
assert.ok(html.includes('/api/state'));
pass('renderHtml returns valid HTML with SSE endpoint');

// parseArgs
const a1 = dash.parseArgs(['node', 'script', '--port=3000', '--live']);
assert.strictEqual(a1.port, 3000);
assert.strictEqual(a1.dryRun, false);
pass('parseArgs: --port=3000 --live parsed correctly');

const a2 = dash.parseArgs(['node', 'script']);
assert.strictEqual(a2.port, 8080);
assert.strictEqual(a2.dryRun, true);
pass('parseArgs: defaults are port=8080 dryRun=true');

// No server started in smoke
pass('no HTTP server started in smoke (unit test only)');

console.log(`\n✅ v110.21 dashboard smoke PASSED (${passed} checks)`);
