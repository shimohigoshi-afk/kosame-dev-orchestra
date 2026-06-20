#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const path   = require('node:path');

const pkg  = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');

const {
  loadContract,
  isSafetyStop,
  checkRuntimeContract,
  SAFETY_STOP_PATTERNS,
} = require('../tools/kosame-runtime-contract');

async function main() {
  console.log('=== v110.84.31 runtime contract smoke ===');

  // 1. Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.3.5'), `version must be >= 113.3.5 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-5'], 'smoke:v113-3-5 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-5'), 'verify must include smoke:v113-3-5');
  console.log('  PASS: package wiring');

  // 2. Config structure
  const contract = loadContract();
  assert.equal(contract.defaultDecision, 'YES', 'defaultDecision must be YES');
  assert.equal(contract.normalTaskRequiresConfirmation, false, 'normalTaskRequiresConfirmation must be false');
  assert.ok(contract.safetyStop?.enabled, 'safetyStop.enabled must be true');
  assert.equal(contract.waitForUserPolicy, 'failure_outside_safety_stop');
  console.log('  PASS: config structure');

  // 3. All 7 Safety Stop triggers declared in config
  const requiredTriggers = [
    'secret', 'production_deploy', 'billing', 'force_push',
    'mass_delete', 'target_repo_change', 'customer_data_external_send',
  ];
  for (const t of requiredTriggers) {
    assert.ok(contract.safetyStop.triggers.includes(t), `config must declare trigger: ${t}`);
    assert.ok(SAFETY_STOP_PATTERNS[t], `SAFETY_STOP_PATTERNS must have pattern for: ${t}`);
  }
  console.log('  PASS: all 7 Safety Stop triggers declared');

  // 4. normalTask → YES (no wait_for_user)
  const normal = checkRuntimeContract({ action: 'update package.json version', isWaitForUser: false });
  assert.equal(normal.decision, 'YES', 'normalTask must return YES');
  assert.equal(normal.triggers.length, 0, 'normalTask must have no triggers');
  console.log('  PASS: normalTask → YES');

  // 5. Each Safety Stop trigger text → STOP
  const triggerTexts = {
    secret:                     'api_key="sk-live-abc123" found in .env',
    production_deploy:          'gcloud run deploy --image gcr.io/prod/app',
    billing:                    'update billing subscription plan',
    force_push:                 'git push origin main --force',
    mass_delete:                'rm -rf /data/kosame',
    target_repo_change:         'target_repo changed to kosame-sales-dx',
    customer_data_external_send:'顧客情報をS3バケットに外部送信',
  };
  for (const [trigger, text] of Object.entries(triggerTexts)) {
    const r = checkRuntimeContract({ action: text, isWaitForUser: false });
    assert.equal(r.decision, 'STOP', `"${trigger}" must trigger STOP`);
    assert.ok(r.triggers.includes(trigger), `triggers must include "${trigger}" for: ${text}`);
  }
  console.log('  PASS: all 7 Safety Stop texts → STOP');

  // 6. wait_for_user outside Safety Stop → FAILURE
  const w = checkRuntimeContract({ action: 'normal review task', isWaitForUser: true });
  assert.equal(w.decision, 'FAILURE', 'wait_for_user outside Safety Stop must return FAILURE');
  console.log('  PASS: wait_for_user outside Safety Stop → FAILURE');

  // 7. Safety Stop takes priority over wait_for_user
  const ws = checkRuntimeContract({ action: 'rm -rf /important', isWaitForUser: true });
  assert.equal(ws.decision, 'STOP', 'Safety Stop must take priority over wait_for_user');
  assert.ok(ws.triggers.includes('mass_delete'));
  console.log('  PASS: Safety Stop takes priority over wait_for_user');

  // 8. isSafetyStop standalone
  assert.equal(isSafetyStop('no danger here').detected, false);
  assert.equal(isSafetyStop('git push --force').detected, true);
  console.log('  PASS: isSafetyStop standalone');

  console.log('✅ v110.84.31 runtime contract smoke PASSED');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
