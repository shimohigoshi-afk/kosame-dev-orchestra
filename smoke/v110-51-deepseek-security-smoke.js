#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.52 DeepSeek Security Policy
 *
 * Verifies:
 *   - Allowed: general code, smoke, docs
 *   - Forbidden: .env, credentials, gcloud, printenv, transcriber, customer info
 *   - Violation triggers HUMAN_GATE_REQUIRED
 */

const assert = require('node:assert');
const path = require('node:path');
const policy = require('../tools/kosame-worker-security-policy');
const router = require('../tools/kosame-smart-task-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.52 deepseek security smoke ===');

// ── 1. Policy Level Checks ──────────────────────────────────────────────────

function testPolicyChecks() {
  const t1 = { title: 'Fix bug in utils.js' };
  const r1 = policy.isDeepSeekAllowedTask(t1);
  assert.strictEqual(r1.allowed, true, 'General code fix should be allowed');
  pass('Policy: General code fix allowed');

  const t2 = { title: 'Add smoke test for feature' };
  const r2 = policy.isDeepSeekAllowedTask(t2);
  assert.strictEqual(r2.allowed, true, 'Smoke test addition should be allowed');
  pass('Policy: Smoke test allowed');

  const t3 = { title: 'Update docs/README.md' };
  const r3 = policy.isDeepSeekAllowedTask(t3);
  assert.strictEqual(r3.allowed, true, 'Doc update should be allowed');
  pass('Policy: Doc update allowed');

  const t4 = { title: 'Read .env file' };
  const r4 = policy.isDeepSeekAllowedTask(t4);
  assert.strictEqual(r4.allowed, false, '.env access should be forbidden');
  pass('Policy: .env access forbidden');

  const t5 = { title: 'Run printenv command' };
  const r5 = policy.isDeepSeekAllowedTask(t5);
  assert.strictEqual(r5.allowed, false, 'printenv should be forbidden');
  pass('Policy: printenv forbidden');

  const t6 = { title: 'Access customer_info' };
  const r6 = policy.isDeepSeekAllowedTask(t6);
  assert.strictEqual(r6.allowed, false, 'customer info should be forbidden');
  pass('Policy: customer info forbidden');

  const t7 = { title: 'Work on transcriber project', project: 'transcriber' };
  const r7 = policy.isDeepSeekAllowedTask(t7);
  assert.strictEqual(r7.allowed, false, 'transcriber project should be forbidden');
  pass('Policy: transcriber project forbidden');
}

// ── 2. Router Level Checks ──────────────────────────────────────────────────

function testRouterChecks() {
  const t1 = { title: 'Read .env', difficulty: 'light' };
  const r1 = router.assignWorkerByRules(t1);
  assert.strictEqual(r1.primary, 'general_worker', 'DeepSeek should be blocked for .env');
  assert.strictEqual(r1.humanGate, true, 'Violation should trigger humanGate');
  pass('Router: DeepSeek blocked and humanGate triggered for .env');

  const t2 = { title: 'Fix CSS', difficulty: 'light' };
  const r2 = router.assignWorkerByRules(t2);
  assert.strictEqual(r2.primary, 'cheap_code_worker', 'DeepSeek should be allowed for CSS fix');
  pass('Router: DeepSeek allowed for CSS fix');
}

// ── 3. Label Check ─────────────────────────────────────────────────────────

function testLabelCheck() {
  const label = router.WORKER_META.cheap_code_worker.label;
  assert.ok(label.includes('sanitized_only'), 'DeepSeek label should include sanitized_only');
  pass('Label: DeepSeek label updated');
}

try {
  testPolicyChecks();
  testRouterChecks();
  testLabelCheck();
  console.log(`\n✅ v110.52 deepseek security smoke PASSED (${passed} checks)`);
} catch (e) {
  console.error(`\n❌ smoke FAILED: ${e.message}`);
  process.exit(1);
}
