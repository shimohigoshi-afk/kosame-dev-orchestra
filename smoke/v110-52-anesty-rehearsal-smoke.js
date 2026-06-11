#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.52 ANESTY Rehearsal
 */

const assert = require('node:assert');
const rehearsal = require('../tools/kosame-anesty-rehearsal');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.52 anesty rehearsal smoke ===');

async function testRehearsal() {
  // 1. Safe task should be allowed and deliveryReady
  console.log('\n--- Case 1: Safe task ---');
  const res1 = await rehearsal.runRehearsal('AnestyのUI表示を微調整する', { dryRun: true });
  assert.strictEqual(res1.ok, true, 'Safe task should be ok');
  assert.strictEqual(res1.deliveryReady, true, 'Safe task should be deliveryReady');
  pass('Safe task: allowed and deliveryReady');

  // 2. Sensitive task should trigger HUMAN_GATE
  console.log('\n--- Case 2: Sensitive task (.env) ---');
  const res2 = await rehearsal.runRehearsal('.envファイルを読み取って設定を確認する', { dryRun: true });
  assert.strictEqual(res2.ok, false, 'Sensitive task should not be ok');
  assert.strictEqual(res2.humanGate, true, 'Sensitive task should trigger humanGate');
  pass('Sensitive task (.env): humanGate triggered');

  // 3. Project violation task should trigger HUMAN_GATE
  console.log('\n--- Case 3: Project violation (transcriber) ---');
  const res3 = await rehearsal.runRehearsal('transcriberのバグを修正する', { project: 'transcriber', dryRun: true });
  assert.strictEqual(res3.ok, false, 'Project violation should not be ok');
  assert.strictEqual(res3.humanGate, true, 'Project violation should trigger humanGate');
  pass('Project violation: humanGate triggered');

  // 4. Redaction check
  console.log('\n--- Case 4: Redaction check ---');
  const autoDev = require('../tools/kosame-auto-dev');
  const redacted = autoDev.redact('My secret is KOSAME_API_KEY: sk-abcdefghijklmnopqrstuvwxyz123456');
  assert.ok(redacted.includes('[REDACTED]'), 'Secret should be redacted');
  pass('Redaction: secrets are masked');

  // 5. failedCount logic check (via manual review call if needed, or rehearsal simulate)
  console.log('\n--- Case 5: failedCount logic ---');
  const tasksWithFail = [{ title: 'Failed Task', verifyPass: false, fixed: false }];
  const review = await autoDev.reviewAllResults(tasksWithFail, { dryRun: true, config: {} });
  assert.strictEqual(review.deliveryReady, false, 'failedCount > 0 should lead to deliveryReady=false');
  pass('failedCount logic: deliveryReady=false when tasks fail');
}

(async () => {
  try {
    await testRehearsal();
    console.log(`\n✅ v110.52 anesty rehearsal smoke PASSED (${passed} checks)`);
  } catch (e) {
    console.error(`\n❌ smoke FAILED: ${e.message}`);
    process.exit(1);
  }
})();
