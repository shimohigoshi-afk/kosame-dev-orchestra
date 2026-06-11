#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.53 IP Protection Gate
 */

const assert = require('node:assert');
const ipGate = require('../tools/kosame-ip-protection-gate');
const policy = require('../tools/kosame-worker-security-policy');
const router = require('../tools/kosame-smart-task-router');
const autoDev = require('../tools/kosame-auto-dev');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.53 ip protection smoke ===');

function assertAllowed(title, msg, extra = {}) {
  const r = policy.isDeepSeekAllowedTask({ title, ...extra });
  assert.strictEqual(r.allowed, true, msg);
  pass(`Allowed: ${msg}`);
}

function assertHumanGate(title, msg, extra = {}) {
  const task = { title, difficulty: 'light', ...extra };
  const p = policy.isDeepSeekAllowedTask(task);
  assert.strictEqual(p.allowed, false, msg);
  const routed = router.assignWorkerByRules(task);
  assert.strictEqual(routed.humanGate, true, `${msg}: router must require human gate`);
  assert.ok(routed.securityViolation.length > 0, `${msg}: violations must be reported`);
  pass(`HUMAN_GATE_REQUIRED: ${msg}`);
}

async function main() {
  assertAllowed('ANESTYのUI表示を微調整する', 'ANESTY safe UI fix should be allowed');
  assertAllowed('ANESTY docsの文言を整形する', 'ANESTY docs fix should be allowed');
  assertAllowed('v110.53 smokeを追加する', 'Smoke addition should be allowed');
  assertAllowed('Smart Routerのボタン表示を修正する', 'Narrow Smart Router UI label fix should not over-block');

  assertHumanGate('アプリ全体設計を外部workerに実装させる', 'Full app design should be gated');
  assertHumanGate('課金導線とsubscription flowを設計する', 'Billing flow should be gated');
  assertHumanGate('顧客管理ロジックを修正する', 'Customer management logic should be gated');
  assertHumanGate('KOSAME Dev Orchestra core と Smart Router全体を再設計する', 'KOSAME core and Smart Router whole should be gated');
  assertHumanGate('ANESTY Board core の全体アーキテクチャを更新する', 'ANESTY Board core architecture should be gated');

  const secretCheck = policy.isDeepSeekAllowedTask({ title: 'Read .env and KOSAME_API_KEY' });
  assert.strictEqual(secretCheck.allowed, false, 'Secret gate must be preserved');
  pass('Secret redaction gate preserved');

  const redacted = autoDev.redact('token KOSAME_API_KEY: sk-abcdefghijklmnopqrstuvwxyz123456');
  assert.ok(redacted.includes('[REDACTED]'), 'auto-dev redaction must be preserved');
  pass('Secret redaction output preserved');

  const sanitized = policy.sanitizeTaskForWorker({
    id: 't1',
    title: '一般コード修正 sk-abcdefghijklmnopqrstuvwxyz123456',
    description: 'KOSAME_API_KEY and a long blob abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
    difficulty: 'light',
  });
  assert.ok(!sanitized.title.includes('sk-abcdefghijklmnopqrstuvwxyz123456'), 'Sanitized title must not include raw secret-like token');
  assert.ok(!sanitized.description.includes('KOSAME_API_KEY'), 'Sanitized description must not include secret var name');
  pass('External worker task is sanitized');

  const safeIp = ipGate.isIPProtectedTask({ title: 'Smart Routerのボタン表示を修正する' });
  assert.strictEqual(safeIp.allowed, true, 'Plain Smart Router UI fix should not be protected IP');
  pass('Over-block check: narrow UI task allowed');

  console.log(`\n✅ v110.53 ip protection smoke PASSED (${passed} checks)`);
}

main().catch(e => {
  console.error(`\n❌ smoke FAILED: ${e.message}`);
  process.exit(1);
});
