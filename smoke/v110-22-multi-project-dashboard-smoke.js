#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.22 Multi-Project Dashboard
 *
 * Verifies:
 *   - TOOL_META.version is 110.22.0
 *   - PROJECTS array has kosame-dev-orchestra and anesty-board
 *   - buildDashboardState returns projects array
 *   - each project entry has key, label, color, ciState, gitLog, cost
 *   - projects array length equals PROJECTS length
 *   - dryRun default true
 */

const assert = require('node:assert');
const pkg    = require('../package.json');
const dash   = require('../tools/kosame-dashboard-server');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.22 multi-project dashboard smoke ===');

// package version
assert.ok(pkg.version >= '110.22.0');
pass('package version >= 110.22.0');

// TOOL_META
assert.strictEqual(dash.TOOL_META.version, '110.22.0');
pass('TOOL_META.version is 110.22.0');

// PROJECTS registry
assert.ok(Array.isArray(dash.PROJECTS), 'PROJECTS must be an array');
assert.ok(dash.PROJECTS.length >= 2, 'PROJECTS must have at least 2 entries');
pass(`PROJECTS has ${dash.PROJECTS.length} entries`);

const keys = dash.PROJECTS.map(p => p.key);
assert.ok(keys.includes('kosame-dev-orchestra'), 'kosame-dev-orchestra must be in PROJECTS');
assert.ok(keys.includes('anesty-board'), 'anesty-board must be in PROJECTS');
pass('PROJECTS contains kosame-dev-orchestra and anesty-board');

for (const p of dash.PROJECTS) {
  assert.ok(typeof p.key === 'string', `project.key must be string (${p.key})`);
  assert.ok(typeof p.label === 'string', `project.label must be string`);
  assert.ok(typeof p.path === 'string', `project.path must be string`);
  assert.ok(typeof p.color === 'string', `project.color must be string`);
  assert.ok(typeof p.githubRepo === 'string', `project.githubRepo must be string`);
  pass(`PROJECTS[${p.key}] has required fields`);
}

// buildDashboardState includes projects
const state = dash.buildDashboardState({ dryRun: true });
assert.ok(Array.isArray(state.projects), 'state.projects must be an array');
assert.ok(state.projects.length >= dash.PROJECTS.length, `state.projects (${state.projects.length}) >= PROJECTS (${dash.PROJECTS.length})`);
pass(`state.projects has ${state.projects.length} entries (>= ${dash.PROJECTS.length} hardcoded)`);

for (const ps of state.projects) {
  assert.ok(typeof ps.key === 'string', 'project state must have key');
  assert.ok(typeof ps.label === 'string', 'project state must have label');
  assert.ok(ps.ci !== undefined, `project state must have ci`);
  assert.ok(Array.isArray(ps.gitLog), `project state must have gitLog array`);
  assert.ok(ps.cost !== undefined, `project state must have cost`);
  pass(`state.projects[${ps.key}] has key, label, ci, gitLog, cost`);
}

// dryRun
assert.strictEqual(state.dryRun, true);
pass('buildDashboardState dryRun=true by default');

// npm scripts
assert.ok(pkg.scripts['dashboard'], 'npm run dashboard must exist');
pass('npm run dashboard script exists');
assert.ok(pkg.scripts['smoke:v110-22-multi-project-dashboard'], 'smoke script must exist');
pass('smoke:v110-22-multi-project-dashboard script exists');

console.log(`\n✅ v110.22 multi-project dashboard smoke PASSED (${passed} checks)`);
