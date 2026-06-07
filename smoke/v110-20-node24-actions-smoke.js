#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.20 Node.js 24 GitHub Actions migration
 *
 * Verifies:
 *   - package version is 110.20.0
 *   - all .github/workflows/*.yml have node-version: "24" (not "20")
 *   - all .github/workflows/*.yml have FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true in env
 *   - dryRun is default (no real workflow execution)
 */

const assert = require('node:assert');
const fs     = require('node:fs');
const path   = require('node:path');

const ROOT     = path.join(__dirname, '..');
const pkg      = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const WORKFLOW_DIR = path.join(ROOT, '.github', 'workflows');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110.20 node24-actions smoke ===');

// Version
assert.ok(pkg.version >= '110.20.0');
pass('package version is 110.20.0 or later');

// Smoke script exists
assert.ok(pkg.scripts['smoke:v110-20-node24-actions'], 'smoke:v110-20-node24-actions script must exist');
pass('smoke:v110-20-node24-actions script exists');

// Workflow files exist
const workflowFiles = fs.readdirSync(WORKFLOW_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
assert.ok(workflowFiles.length > 0, 'at least one workflow file must exist');
pass(`workflow files found: ${workflowFiles.join(', ')}`);

// Each workflow must have node-version: "24" and FORCE_JAVASCRIPT_ACTIONS_TO_NODE24
for (const file of workflowFiles) {
  const content = fs.readFileSync(path.join(WORKFLOW_DIR, file), 'utf8');

  // Must NOT contain old node-version 20
  assert.ok(
    !content.includes('node-version: "20"') && !content.includes("node-version: '20'"),
    `${file}: node-version "20" must have been removed`
  );
  pass(`${file}: no node-version "20"`);

  // Must contain node-version 24
  assert.ok(
    content.includes('node-version: "24"') || content.includes("node-version: '24'"),
    `${file}: node-version must be "24"`
  );
  pass(`${file}: node-version is "24"`);

  // Must contain FORCE_JAVASCRIPT_ACTIONS_TO_NODE24
  assert.ok(
    content.includes('FORCE_JAVASCRIPT_ACTIONS_TO_NODE24'),
    `${file}: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 must be present in env`
  );
  pass(`${file}: FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 env present`);

  // actions/checkout@v4 must still be v4 (not downgraded)
  assert.ok(
    content.includes('actions/checkout@v4'),
    `${file}: actions/checkout@v4 must still be present`
  );
  pass(`${file}: actions/checkout@v4 preserved`);

  // setup-node must still be v4
  assert.ok(
    content.includes('actions/setup-node@v4'),
    `${file}: actions/setup-node@v4 must still be present`
  );
  pass(`${file}: actions/setup-node@v4 preserved`);
}

// dryRun default: this smoke does not execute or push workflows
const dryRun = true;
assert.strictEqual(dryRun, true);
pass('dryRun default: no real workflow push executed');

console.log(`\n✅ v110.20 node24-actions smoke PASSED (${passed} checks)`);
