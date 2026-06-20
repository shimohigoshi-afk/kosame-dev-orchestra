#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const RUNTIME_PATH = path.join(ROOT, 'tools', 'kosame-cheap-first-runtime.js');

async function main() {
  console.log('=== v113.3.4 human-gate + policy-block smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.4'), `version must be >= 113.3.4 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-4'], 'smoke:v113-3-4 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-4'), 'verify must include smoke:v113-3-4');
  console.log('  PASS: package wiring');

  const src = fs.readFileSync(RUNTIME_PATH, 'utf8');

  // ❶ isIrreversible opts support
  assert.ok(src.includes('isIrreversible'), 'isIrreversible must be present in source');
  assert.ok(src.includes('isIrreversible  = false'), 'isIrreversible must default to false in opts');
  assert.ok(src.includes('isHigh && isIrreversible'), 'human_gate must gate on isHigh && isIrreversible');
  assert.ok(src.includes('irreversible high task rejected'), 'rejection reason must name irreversible');
  assert.ok(!src.includes('isHigh && !skipHumanGate'), 'high-only gate (without isIrreversible) must NOT exist');
  console.log('  PASS: ❶ isIrreversible gate wiring');

  // ❷ DeepSeek policy block excluded from failure count
  assert.ok(src.includes('policyBlocked: true'), 'DeepSeek guard must set policyBlocked: true');
  assert.ok(src.includes('attempts.filter(a => !a.policyBlocked)'), 'failure analysis must filter policyBlocked');
  assert.ok(src.includes('realFailures'), 'realFailures variable must exist');
  // old pattern must be gone
  assert.ok(!src.includes('attempts.every(a => !a.success)'), 'raw attempts.every must be replaced by realFailures');
  assert.ok(!src.includes('attempts.map(a => resolveWorker'), 'raw attempts.map for providers must be replaced by realFailures');
  console.log('  PASS: ❷ policyBlocked excluded from failure analysis');

  // Regressions
  assert.ok(src.includes('waitForHumanApproval'), 'waitForHumanApproval must still be exported');
  assert.ok(src.includes('skipHumanGate'), 'skipHumanGate must still exist');
  assert.ok(src.includes('cheapFirstRun'), 'cheapFirstRun must still exist');
  assert.ok(src.includes('humanGateRequired'), 'humanGateRequired must still exist in return');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.4 human-gate + policy-block smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
