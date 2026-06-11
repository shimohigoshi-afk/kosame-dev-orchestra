#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.55 Worker Scorecard
 */

const assert = require('node:assert');
const pkg = require('../package.json');
const scorecard = require('../tools/kosame-worker-scorecard');
const ledger = require('../tools/kosame-cost-token-ledger');
const policy = require('../tools/kosame-worker-security-policy');
const router = require('../tools/kosame-smart-task-router');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

console.log('=== v110.55 worker scorecard smoke ===');

assert.ok(pkg.version >= '110.55.0', `version must be >= 110.55.0 (got ${pkg.version})`);
pass('package version >= 110.55.0');

assert.ok(scorecard.TOOL_META.version >= '110.55.0', 'scorecard TOOL_META version must be v110.55+');
assert.ok(Array.isArray(scorecard.getDefaultScorecards()), 'default scorecards must be an array');
assert.ok(scorecard.getDefaultScorecards().length >= 7, 'must include the default scorecards');
pass('default scorecards are available');

const defaults = new Map(scorecard.getDefaultScorecards().map(entry => [entry.modelId, entry]));
const geminiCard = scorecard.getWorkerScorecard('gemini');
const grokCard = scorecard.getWorkerScorecard('grok');
const claudeCard = scorecard.getWorkerScorecard('claude');

assert.strictEqual(defaults.get('gpt-5.4-mini').modelTier, 'cheap');
assert.strictEqual(defaults.get('gpt-5.4-mini').approvalRequired, false);
assert.ok(defaults.get('gpt-5.4-mini').recommendedUse.includes('routine/docs/smoke/UI/light code'));
pass('gpt-5.4-mini is the default cheap worker');

assert.strictEqual(defaults.get('gpt-5.4').modelTier, 'standard');
assert.ok(defaults.get('gpt-5.4').recommendedUse.includes('Standard implementation fallback'));
pass('gpt-5.4 is standard implementation fallback');

assert.strictEqual(defaults.get('gpt-5.5').modelTier, 'expensive');
assert.strictEqual(defaults.get('gpt-5.5').approvalRequired, true);
assert.ok(defaults.get('gpt-5.5').recommendedUse.includes('Explicit human approval only'));
pass('gpt-5.5 is expensive and approval_required');

assert.strictEqual(defaults.get('deepseek-chat').modelTier, 'external_sanitized');
assert.strictEqual(defaults.get('deepseek-chat').sanitizedOnly, true);
assert.ok(defaults.get('deepseek-chat').recommendedUse.includes('sanitized-only'));
pass('DeepSeek/opencode is sanitized_only');

assert.ok(geminiCard.recommendedUse.includes('Google/IAM/Cloud Run'));
pass('Gemini is recommended for Google/IAM/Cloud Run caution review');

assert.ok(grokCard.recommendedUse.includes('breakthrough work'));
pass('Grok is review/breakthrough role');

assert.ok(claudeCard.recommendedUse.includes('Optional final quality review'));
assert.strictEqual(claudeCard.approvalRequired, false);
pass('Claude is optional final review, not a mandatory gate');

const routine = scorecard.recommendWorkerForTask({ title: 'README docsを整形する' });
assert.strictEqual(routine.modelId, 'gpt-5.4-mini', 'routine docs task should map to cheap worker');
assert.strictEqual(routine.modelTier, 'cheap');
pass('routine docs task maps to cheap worker');

const caution = scorecard.recommendWorkerForTask({ title: 'Cloud Run and IAM caution review' });
assert.strictEqual(caution.modelId, 'gemini-2.5-flash-lite', 'Google/IAM/Cloud Run caution should prefer Gemini');
assert.ok(caution.recommendedUse.includes('caution review'));
pass('Google/IAM/Cloud Run caution review prefers Gemini');

const review = scorecard.recommendWorkerForTask({ title: 'breakthrough review for new routing idea' });
assert.strictEqual(review.modelId, 'grok', 'breakthrough review should prefer Grok');
pass('breakthrough review prefers Grok');

const finalReview = scorecard.recommendWorkerForTask({ title: 'final quality review before release' });
assert.strictEqual(finalReview.modelId, 'claude-sonnet-4-6', 'final review should prefer Claude');
assert.ok(finalReview.recommendedUse.includes('Optional final quality review'));
pass('final quality review maps to Claude');

const security = scorecard.recommendWorkerForTask({ title: 'KOSAME Dev Orchestra core の全体設計を再構成する' });
assert.strictEqual(security.modelId, 'gpt-5.4', 'security/IP/core must not auto-select gpt-5.5');
assert.strictEqual(security.approvalRequired, true, 'security/IP/core requires approval before expensive escalation');
assert.notStrictEqual(security.modelId, 'gpt-5.5');
pass('IP/core/security does not auto-select gpt-5.5 without approval');

const requestedDenied = scorecard.evaluateRequestedWorkerModel(
  'gpt-5.5',
  { title: 'security escalation' },
  { approvalReceived: false },
);
assert.strictEqual(requestedDenied.allowed, false, 'gpt-5.5 must be blocked without approval');
assert.strictEqual(requestedDenied.approvalRequired, true);
pass('gpt-5.5 remains blocked unless approved');

const ledgerDocs = ledger.recommendModel({ title: 'README docsを整形する' });
assert.strictEqual(ledgerDocs.selectedModel, 'gpt-5.4-mini', 'v110.54 ledger behavior must stay intact');
const ledgerDenied = ledger.evaluateRequestedModel('gpt-5.5', { title: 'security escalation' }, { approvalReceived: false });
assert.strictEqual(ledgerDenied.allowed, false, 'v110.54 ledger gpt-5.5 gate must stay intact');
pass('v110.54 cost ledger behavior remains intact');

const safeIp = policy.isDeepSeekAllowedTask({ title: 'Smart Routerのボタン表示を修正する' });
assert.strictEqual(safeIp.allowed, true, 'narrow UI fix should stay allowed');
const blockedIp = policy.isDeepSeekAllowedTask({ title: 'ANESTY Board core の全体アーキテクチャを更新する' });
assert.strictEqual(blockedIp.allowed, false, 'IP core gate must remain intact');
pass('v110.53 IP gate remains intact');

const routed = router.assignWorkerByRules({ title: 'README docsを整形する', difficulty: 'light' });
assert.ok(routed.workerScorecard, 'router should attach worker scorecard');
assert.strictEqual(routed.workerScorecard.modelId, 'gpt-5.4-mini', 'router should preserve cheap-first routing');
pass('router integration attaches worker scorecard without changing cheap-first behavior');

console.log(`\n✅ v110.55 worker scorecard smoke PASSED (${passed} checks)`);
