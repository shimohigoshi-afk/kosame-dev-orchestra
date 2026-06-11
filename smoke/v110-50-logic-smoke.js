#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.50 Logic Verification
 *
 * Verifies:
 *   - failedCount > 0 → deliveryReady=false
 *   - Secret redaction maintains security
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.50 logic smoke ===');

const toolPath = path.resolve(__dirname, '..', 'tools', 'kosame-auto-dev.js');
const mod = require(toolPath);

// ── 1. failedCount logic ───────────────────────────────────────────────────
async function testFailedCountLogic() {
  const tasksWithFail = [
    { title: 'task1', verifyPass: true,  fixed: false },
    { title: 'task2', verifyPass: false, fixed: false },
  ];
  const revFail = await mod.reviewAllResults(tasksWithFail, { dryRun: true, config: {} });
  assert.strictEqual(revFail.approved, false, 'failedCount > 0 → approved=false');
  assert.strictEqual(revFail.deliveryReady, false, 'failedCount > 0 → deliveryReady=false');
  pass('failedCount > 0 → deliveryReady=false');

  const tasksAllPass = [
    { title: 'task1', verifyPass: true, fixed: false },
    { title: 'task2', verifyPass: true, fixed: false },
  ];
  const revPass = await mod.reviewAllResults(tasksAllPass, { dryRun: true, config: {} });
  assert.strictEqual(revPass.approved, true, 'all pass → approved=true');
  assert.strictEqual(revPass.deliveryReady, true, 'all pass → deliveryReady=true');
  pass('all pass → deliveryReady=true');
}

// ── 2. Secret redaction logic ──────────────────────────────────────────────
function testSecretRedaction() {
  const { redact } = mod;
  
  // Test JWT
  const fakeJwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIn0.afake_signature';
  const redactedJwt = redact(fakeJwt);
  assert.ok(redactedJwt.includes('[REDACTED]'), 'JWT should be redacted');
  pass('Redaction: JWT masked');

  // Test API Key pattern
  const fakeKey = 'api_key: sk-12345678901234567890';
  const redactedKey = redact(fakeKey);
  assert.ok(redactedKey.includes('[REDACTED]'), 'API Key should be redacted');
  pass('Redaction: API Key masked');
}

(async () => {
  try {
    await testFailedCountLogic();
    testSecretRedaction();
    console.log(`\n✅ v110.50 logic smoke PASSED (${passed} checks)`);
  } catch (e) {
    console.error(`\n❌ smoke FAILED: ${e.message}`);
    process.exit(1);
  }
})();
