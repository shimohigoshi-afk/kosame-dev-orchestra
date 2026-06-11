#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.56 Availability Fallback Matrix
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const matrix = require('../tools/kosame-availability-fallback-matrix');
const scorecard = require('../tools/kosame-worker-scorecard');
const ledger = require('../tools/kosame-cost-token-ledger');
const policy = require('../tools/kosame-worker-security-policy');
const router = require('../tools/kosame-smart-task-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.56 availability fallback matrix smoke ===');

assert.ok(pkg.version >= '110.56.0', `version must be >= 110.56.0 (got ${pkg.version})`);
pass('package version >= 110.56.0');

assert.ok(matrix.TOOL_META.version >= '110.56.0', 'matrix TOOL_META version must be v110.56+');
assert.ok(typeof matrix.recommendAvailabilityFallback === 'function', 'matrix recommendation function must exist');
pass('availability matrix module is available');

const claudeFallback = matrix.recommendAvailabilityFallback(
  { title: 'final quality review before release' },
  'claude-sonnet-4-6',
  matrix.WORKER_STATES.unavailable,
);
assert.strictEqual(claudeFallback.humanGateRequired, false, 'Claude unavailable should not block delivery');
assert.strictEqual(claudeFallback.recommendedModelId, 'gpt-5.4');
pass('Claude unavailable does not block delivery');

const geminiFallback = matrix.recommendAvailabilityFallback(
  { title: 'Google IAM Cloud Run caution review' },
  'gemini-2.5-flash-lite',
  matrix.WORKER_STATES.unavailable,
);
assert.strictEqual(geminiFallback.humanGateRequired, false, 'Gemini unavailable should still permit cautious fallback when available');
assert.ok(['gpt-5.4', 'gpt-5.4-mini'].includes(geminiFallback.recommendedModelId), 'Gemini fallback must stay cautious');
pass('Gemini unavailable on Google/IAM returns cautious fallback or human gate');

const deepseekUnsafe = matrix.recommendAvailabilityFallback(
  { title: 'ANESTY Board core の全体アーキテクチャを更新する' },
  'deepseek-chat',
  matrix.WORKER_STATES.unsafe_for_task,
);
assert.strictEqual(deepseekUnsafe.humanGateRequired, true, 'unsafe DeepSeek task must gate');
assert.notStrictEqual(deepseekUnsafe.recommendedModelId, 'deepseek-chat', 'unsafe DeepSeek task must route away from external_sanitized');
pass('DeepSeek unsafe routes away from external_sanitized');

const expensiveBlocked = matrix.recommendAvailabilityFallback(
  { title: 'security escalation' },
  'gpt-5.5',
  matrix.WORKER_STATES.rate_limited,
  { approvalReceived: false },
);
assert.strictEqual(expensiveBlocked.humanGateRequired, true, 'gpt-5.5 must not auto-fallback without approval');
assert.strictEqual(expensiveBlocked.recommendedModelId, null, 'gpt-5.5 fallback must not auto-select another expensive route');
pass('gpt-5.5 is never auto-selected as fallback without approval');

const routineHealthy = matrix.recommendAvailabilityFallback(
  { title: 'README docsを整形する' },
  'gpt-5.4-mini',
  matrix.WORKER_STATES.healthy,
);
assert.strictEqual(routineHealthy.recommendedModelId, 'gpt-5.4-mini', 'healthy mini should remain mini');
const routineFallback = matrix.recommendAvailabilityFallback(
  { title: 'README docsを整形する' },
  'gpt-5.4-mini',
  matrix.WORKER_STATES.unavailable,
);
assert.strictEqual(routineFallback.recommendedModelId, 'gpt-5.4', 'mini failure should promote to gpt-5.4');
pass('routine task falls back from mini to gpt-5.4 only after mini failure');

const overBudget = matrix.recommendAvailabilityFallback(
  { title: 'KOSAME Dev Orchestra core の全体設計を再構成する' },
  'gpt-5.5',
  matrix.WORKER_STATES.over_budget,
  { approvalReceived: true },
);
assert.ok(
  overBudget.humanGateRequired || ['gpt-5.4', 'gpt-5.4-mini'].includes(overBudget.recommendedModelId),
  'over-budget expensive model must fall back to cheap/standard or human gate',
);
pass('over_budget expensive model routes to cheap/standard or human gate');

const unsafeGate = matrix.recommendAvailabilityFallback(
  { title: 'KOSAME Dev Orchestra core の全体設計を再構成する' },
  'gpt-5.4-mini',
  matrix.WORKER_STATES.human_gate_required,
);
assert.strictEqual(unsafeGate.humanGateRequired, true, 'unsafe routes must end in HUMAN_GATE_REQUIRED');
pass('all unsafe routes return HUMAN_GATE_REQUIRED');

const routineScorecard = scorecard.recommendWorkerForTask({ title: 'README docsを整形する' });
assert.strictEqual(routineScorecard.modelId, 'gpt-5.4-mini', 'scorecard behavior must remain intact');
pass('v110.55 worker scorecard behavior remains intact');

const routineLedger = ledger.recommendModel({ title: 'README docsを整形する' });
assert.strictEqual(routineLedger.selectedModel, 'gpt-5.4-mini', 'ledger behavior must remain intact');
pass('v110.54 cost ledger behavior remains intact');

const ledgerRecord = ledger.buildLedgerRecord(
  { title: 'README docsを整形する' },
  { verifyRunCount: 2, workerState: matrix.WORKER_STATES.unavailable },
);
assert.ok(ledgerRecord.modelTier, 'ledger record must include model tier');
assert.ok(Object.prototype.hasOwnProperty.call(ledgerRecord, 'approvalRequired'), 'ledger record must include approval field');
assert.ok(ledgerRecord.availabilityFallback, 'ledger record must include availability fallback data');
pass('ledger record includes model tier and approval fields');

const routed = router.assignWorkerByRules({ title: 'README docsを整形する', difficulty: 'light' });
assert.ok(routed.availabilityFallback, 'router should attach availability fallback');
assert.strictEqual(routed.availabilityFallback.recommendedModelId, 'deepseek-chat', 'router fallback metadata should reflect the existing sanitized cheap path');
assert.strictEqual(routed.availabilityFallback.recommendedTier, 'external_sanitized');
pass('router attaches availability fallback without changing cheap-first behavior');

const uiAllowed = policy.isDeepSeekAllowedTask({ title: 'Smart Routerのボタン表示を修正する' });
assert.strictEqual(uiAllowed.allowed, true, 'v110.53 UI allowance must remain intact');
const ipBlocked = policy.isDeepSeekAllowedTask({ title: 'ANESTY Board core の全体アーキテクチャを更新する' });
assert.strictEqual(ipBlocked.allowed, false, 'v110.53 IP gate must remain intact');
pass('v110.53 IP gate behavior remains intact');

console.log(`\n✅ v110.56 availability fallback matrix smoke PASSED (${passed} checks)`);
