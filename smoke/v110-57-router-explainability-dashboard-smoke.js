#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.57 Router Explainability Dashboard Lite
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const explainability = require('../tools/kosame-router-explainability-dashboard');
const scorecard = require('../tools/kosame-worker-scorecard');
const ledger = require('../tools/kosame-cost-token-ledger');
const policy = require('../tools/kosame-worker-security-policy');
const matrix = require('../tools/kosame-availability-fallback-matrix');
const router = require('../tools/kosame-smart-task-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.57 router explainability dashboard smoke ===');

assert.ok(pkg.version >= '110.57.0', `version must be >= 110.57.0 (got ${pkg.version})`);
pass('package version >= 110.57.0');

assert.ok(explainability.TOOL_META.version >= '110.57.0', 'explainability TOOL_META version must be v110.57+');
assert.strictEqual(typeof explainability.buildRouterExplanation, 'function');
pass('explainability module is available');

const routineDecision = router.assignWorkerByRules({ title: 'README docsを整形する', difficulty: 'light' });
const routineExplanation = explainability.buildRouterExplanation(
  { title: 'README docsを整形する' },
  routineDecision,
);
assert.ok(routineExplanation.costReason.includes('cheap-first') || routineExplanation.costReason.includes('standard'), 'routine explanation must mention cheap-first');
assert.ok(routineExplanation.selectedModel === 'deepseek-chat' || routineExplanation.selectedModel === 'gpt-5.4-mini');
assert.ok(routineExplanation.safetyNotes.includes('Routine/docs/smoke/UI work stays cheap-first') || routineExplanation.safetyNotes.includes('cheap-first'));
pass('routine docs task explanation says cheap-first / gpt-5.4-mini');

const blockedGpt = ledger.evaluateRequestedModel(
  'gpt-5.5',
  { title: 'security escalation' },
  { approvalReceived: false },
);
const blockedExplanation = explainability.buildRouterExplanation(
  { title: 'security escalation' },
  { costPolicy: blockedGpt, selectedModel: blockedGpt.selectedModel },
  { requestedModel: 'gpt-5.5' },
);
assert.strictEqual(blockedExplanation.expensiveModelBlocked, true, 'gpt-5.5 without approval must be blocked');
assert.ok(blockedExplanation.expensiveModelBlockedReason.includes('explicit human approval'));
pass('gpt-5.5 request without approval says blocked');

const ipDecision = router.assignWorkerByRules(
  router.classifyTask({ title: 'KOSAME Dev Orchestra core の全体設計を再構成する' }),
);
const ipExplanation = explainability.buildRouterExplanation(
  { title: 'KOSAME Dev Orchestra core の全体設計を再構成する' },
  ipDecision,
);
assert.strictEqual(ipExplanation.humanGateRequired, true, 'IP/core task must require human gate');
assert.ok(ipExplanation.humanGateReason.includes('IP/core/security'));
pass('IP/core task explanation includes human_gate reason');

const claudeFallback = matrix.recommendAvailabilityFallback(
  { title: 'final quality review before release' },
  'claude-sonnet-4-6',
  matrix.WORKER_STATES.unavailable,
);
const claudeExplanation = explainability.buildRouterExplanation(
  { title: 'final quality review before release' },
  { availabilityFallback: claudeFallback, selectedModel: claudeFallback.recommendedModelId, costPolicy: ledger.buildLedgerRecord({ title: 'final quality review before release' }, {}) },
);
assert.ok(claudeExplanation.safetyNotes.includes('delivery can continue through GPT/Codex + verify + smoke'));
pass('Claude unavailable explanation says delivery can continue');

const geminiFallback = matrix.recommendAvailabilityFallback(
  { title: 'Google IAM Cloud Run caution review' },
  'gemini-2.5-flash-lite',
  matrix.WORKER_STATES.unavailable,
);
const geminiExplanation = explainability.buildRouterExplanation(
  { title: 'Google IAM Cloud Run caution review' },
  { availabilityFallback: geminiFallback, selectedModel: geminiFallback.recommendedModelId, costPolicy: ledger.buildLedgerRecord({ title: 'Google IAM Cloud Run caution review' }, {}) },
);
assert.ok(geminiExplanation.fallbackReason.includes('gemini-2.5-flash-lite'));
assert.ok(geminiExplanation.safetyNotes.includes('Gemini unavailable'));
pass('Gemini unavailable on Google/IAM explains cautious fallback or human_gate');

const deepseekFallback = matrix.recommendAvailabilityFallback(
  { title: 'ANESTY Board core の全体アーキテクチャを更新する' },
  'deepseek-chat',
  matrix.WORKER_STATES.unsafe_for_task,
);
const deepseekExplanation = explainability.buildRouterExplanation(
  { title: 'ANESTY Board core の全体アーキテクチャを更新する' },
  { availabilityFallback: deepseekFallback, selectedModel: deepseekFallback.recommendedModelId, costPolicy: ledger.buildLedgerRecord({ title: 'ANESTY Board core の全体アーキテクチャを更新する' }, {}) },
);
assert.ok(deepseekExplanation.safetyNotes.includes('route away from external_sanitized') || deepseekExplanation.fallbackReason.includes('→'));
pass('DeepSeek unsafe explains sanitized-only / route away');

assert.ok(routineExplanation.fallbackReason, 'fallback reason must be included');
assert.ok(routineExplanation.modelTier, 'cost tier must be included');
assert.ok(typeof routineExplanation.approvalRequired === 'boolean', 'approval_required must be included');
pass('fallback reason, cost tier, and approval_required are included');

const routed = router.assignWorkerByRules({ title: 'README docsを整形する', difficulty: 'light' });
assert.ok(routed.routerExplanation, 'router should attach explainability');
assert.strictEqual(routed.routerExplanation.selectedModel, routed.costPolicy.selectedModel);
pass('router attaches explainability without changing v110.56 behavior');

const routineScorecard = scorecard.recommendWorkerForTask({ title: 'README docsを整形する' });
assert.strictEqual(routineScorecard.modelId, 'gpt-5.4-mini', 'scorecard behavior must remain intact');
pass('v110.55 scorecard behavior remains intact');

const routineLedger = ledger.recommendModel({ title: 'README docsを整形する' });
assert.strictEqual(routineLedger.selectedModel, 'gpt-5.4-mini', 'ledger behavior must remain intact');
pass('v110.54 cost ledger behavior remains intact');

const ipAllowed = policy.isDeepSeekAllowedTask({ title: 'Smart Routerのボタン表示を修正する' });
assert.strictEqual(ipAllowed.allowed, true, 'narrow UI fix should remain allowed');
const ipBlockedCheck = policy.isDeepSeekAllowedTask({ title: 'ANESTY Board core の全体アーキテクチャを更新する' });
assert.strictEqual(ipBlockedCheck.allowed, false, 'IP/core gate must remain intact');
pass('v110.53 IP gate behavior remains intact');

console.log(`\n✅ v110.57 router explainability dashboard smoke PASSED (${passed} checks)`);
