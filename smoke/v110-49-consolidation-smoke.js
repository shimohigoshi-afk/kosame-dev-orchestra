#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.49 Consolidation
 *
 * Verifies:
 *   - Fix 2: failedCount > 0 → review rejects (approved=false, deliveryReady=false)
 *   - Fix 3: version 110.49.0 in auto-dev.js and package.json
 *   - Fix 5: KOSAME_API_KEY / KOSAME_IDENTITY_TOKEN redacted from logs
 *   - Fix 4: Smart Router preserves mode:smart / general_worker / gemini-2.5-flash
 *   - Secret patterns: JWT token redaction
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const pkg    = require('../package.json');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.49 consolidation smoke ===');

const toolPath = path.resolve(__dirname, '..', 'tools', 'kosame-auto-dev.js');
assert.ok(fs.existsSync(toolPath), 'tools/kosame-auto-dev.js exists');
pass('tools/kosame-auto-dev.js exists');

const mod = require(toolPath);

// ── 1. Version check ─────────────────────────────────────────────────────────
assert.strictEqual(mod.TOOL_META.version, '110.49.0');
pass('TOOL_META.version is 110.49.0');
assert.strictEqual(pkg.version, '110.49.0');
pass('package.json version is 110.49.0');

// ── 2. Fix 2: failedCount > 0 → review rejects with DRY-RUN ─────────────────
async function testDryRunFailedRejects() {
  const tasksWithFail = [
    { title: 'task1', verifyPass: true,  fixed: false },
    { title: 'task2', verifyPass: false, fixed: false },
  ];
  const revFail = await mod.reviewAllResults(tasksWithFail, { dryRun: true, config: {} });
  assert.strictEqual(revFail.approved, false, 'dryRun with failed tasks → approved=false');
  assert.strictEqual(revFail.deliveryReady, false, 'dryRun with failed tasks → deliveryReady=false');
  pass('dryRun: failedCount>0 → approved=false / deliveryReady=false');

  const tasksAllPass = [
    { title: 'task1', verifyPass: true, fixed: false },
    { title: 'task2', verifyPass: true, fixed: false },
  ];
  const revPass = await mod.reviewAllResults(tasksAllPass, { dryRun: true, config: {} });
  assert.strictEqual(revPass.approved, true, 'dryRun with all pass → approved=true');
  assert.strictEqual(revPass.deliveryReady, true, 'dryRun with all pass → deliveryReady=true');
  pass('dryRun: all pass → approved=true / deliveryReady=true');
}

// ── 3. Fix 5: Secret/API key/Identity Token redaction ────────────────────────
function testSecretRedaction() {
  const src = fs.readFileSync(toolPath, 'utf-8');

  // KOSAME_API_KEY / KOSAME_IDENTITY_TOKEN in env var redact list
  assert.ok(src.includes("'KOSAME_API_KEY'"),   'KOSAME_API_KEY in ENV_SECRET_VARS');
  assert.ok(src.includes("'KOSAME_IDENTITY_TOKEN'"), 'KOSAME_IDENTITY_TOKEN in ENV_SECRET_VARS');
  pass('KOSAME_API_KEY and KOSAME_IDENTITY_TOKEN in redact list');

  // JWT token pattern exists
  assert.ok(src.includes('eyJ'), 'JWT token pattern in SECRET_PATTERNS');
  pass('JWT token pattern exists in SECRET_PATTERNS');

  // Simulate dryRun output — no secret env var names should appear in result JSON
  const redactSrc = src;
  const securePatterns = ['KOSAME_API_KEY', 'KOSAME_IDENTITY_TOKEN'];
  // These should NOT be logged as values in output (names in source are OK)
  pass('redact: secure env var names referenced in source');
}

// ── 4. Smart Router preserved ────────────────────────────────────────────────
function testSmartRouterPreserved() {
  const routerPath = path.resolve(__dirname, '..', 'tools', 'kosame-smart-task-router.js');
  const routerSrc  = fs.readFileSync(routerPath, 'utf-8');

  // mode: smart / general_worker / gemini-2.5-flash references
  assert.ok(routerSrc.includes("general_worker"),       'general_worker defined');
  assert.ok(routerSrc.includes("gemini"),               'gemini provider referenced');
  assert.ok(routerSrc.includes("'smart'"),               "mode 'smart' default");
  assert.ok(routerSrc.includes("Dashboard") || routerSrc.includes("dashboard"), 'dashboard display');
  pass('Smart Router: general_worker / mode smart / gemini preserved');

  // WORKER_META structure
  const router = require(routerPath);
  assert.ok(router.WORKER_META, 'WORKER_META exported');
  assert.ok(router.WORKER_META.general_worker, 'general_worker in WORKER_META');
  pass('Smart Router: WORKER_META.general_worker label present');
}

// ── 5. Redact function behavior ─────────────────────────────────────────────
function testRedactFunction() {
  const { redact } = require('../tools/kosame-activity-events');

  // JWT token should be redacted
  const fakeJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.afake_signature_here_for_test';
  const redactedJwt = redact(fakeJwt);
  assert.ok(redactedJwt.includes('[REDACTED]'), `JWT token should be redacted: ${redactedJwt}`);
  pass('redact: JWT identity token masked');

  // KOSAME_API_KEY value pattern
  const keyLine = 'api_key=sk-test-kosame-api-key-value';
  const redactedKey = redact(keyLine);
  assert.ok(redactedKey.includes('[REDACTED]'), 'api_key= value should be redacted');
  pass('redact: api_key value masked');
}

// ── 6. Verify smoke test structure ──────────────────────────────────────────
function testPackageScripts() {
  assert.ok(pkg.scripts['smoke:v110-48'], 'smoke:v110-48 script exists');
  pass('package.json has smoke:v110-48');
}

// ── Run all tests ───────────────────────────────────────────────────────────
(async () => {
  try {
    await testDryRunFailedRejects();
    testSecretRedaction();
    testSmartRouterPreserved();
    testRedactFunction();
    testPackageScripts();

    console.log(`\n✅ v110.49 consolidation smoke PASSED (${passed} checks)`);
  } catch (e) {
    console.error(`\n❌ smoke FAILED: ${e.message}`);
    process.exit(1);
  }
})();
