#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const budgetRouter = require('../tools/kosame-provider-budget-bucket-router');
const costLedger = require('../tools/kosame-cost-token-ledger');
const explainability = require('../tools/kosame-router-explainability-dashboard');
const router = require('../tools/kosame-smart-task-router');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function includesText(value, fragment) {
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function buildTask(id, title, description, file_scope) {
  return { id, title, description, file_scope };
}

console.log('=== v110.62 provider budget bucket router smoke ===');

check('package version >= 110.62.0', versionAtLeast(pkg.version, 110, 62));
check('budget router module is available', typeof budgetRouter.recommendProviderBudgetBucket === 'function');

const docsTask = buildTask(
  'T-DOCS',
  'Update router docs',
  'Refresh one docs section for the provider budget bucket router.',
  ['docs/provider-budget-bucket-router.md'],
);
const smokeTask = buildTask(
  'T-SMOKE',
  'Update budget smoke',
  'Refresh one smoke file for the provider budget bucket router.',
  ['smoke/v110-62-provider-budget-bucket-router-smoke.js'],
);
const uiTask = buildTask(
  'T-UI',
  'Adjust UI label text',
  'Change one UI label for the budget bucket router.',
  ['web/ui/router-labels.tsx'],
);
const implTask = buildTask(
  'T-IMPL',
  'Implement budget bucket router',
  'Add the dryRun provider budget bucket router integration.',
  ['tools/kosame-provider-budget-bucket-router.js'],
);
const googleTask = buildTask(
  'T-GOOGLE',
  'Google IAM caution review',
  'Cautious Google/IAM/Cloud Run review for one safe note.',
  ['docs/google-iam-caution.md'],
);
const reviewTask = buildTask(
  'T-REVIEW',
  'Optional final review',
  'Run an optional final quality review for one safe patch.',
  ['docs/final-review.md'],
);

const docsDecision = budgetRouter.recommendProviderBudgetBucket(docsTask, {});
check('routine docs goes to ultra_low_cost', docsDecision.providerBudgetBucket === 'ultra_low_cost');
check('routine docs selects gpt-5.4-mini', docsDecision.selectedModel === 'gpt-5.4-mini');
check('routine docs reason mentions cheap-first', includesText(docsDecision.providerBudgetBucketReason, 'cheap-first') || includesText(docsDecision.providerBudgetBucketReason, 'routine'));

const smokeDecision = budgetRouter.recommendProviderBudgetBucket(smokeTask, {});
check('routine smoke goes to ultra_low_cost', smokeDecision.providerBudgetBucket === 'ultra_low_cost');
check('routine smoke selects gpt-5.4-mini', smokeDecision.selectedModel === 'gpt-5.4-mini');

const uiDecision = budgetRouter.recommendProviderBudgetBucket(uiTask, {});
check('routine UI goes to ultra_low_cost', uiDecision.providerBudgetBucket === 'ultra_low_cost');
check('routine UI selects gpt-5.4-mini', uiDecision.selectedModel === 'gpt-5.4-mini');

const implDecision = budgetRouter.recommendProviderBudgetBucket(implTask, {});
check('implementation goes to mid_cost', implDecision.providerBudgetBucket === 'mid_cost');
check('implementation selects gpt-5.4', implDecision.selectedModel === 'gpt-5.4');

const googleDecision = budgetRouter.recommendProviderBudgetBucket(googleTask, {});
check('Google/IAM caution goes to free_tier', googleDecision.providerBudgetBucket === 'free_tier');
check('Google/IAM caution selects Gemini', googleDecision.selectedModel === 'gemini-2.5-flash-lite');
check('Google/IAM reason mentions free tier or Google', includesText(googleDecision.providerBudgetBucketReason, 'google') || includesText(googleDecision.providerBudgetBucketReason, 'free'));

const googleFallback = budgetRouter.recommendProviderBudgetBucket(googleTask, {
  providerStates: {
    'gemini-2.5-flash-lite': 'unavailable',
  },
});
check('unavailable Gemini falls back away from Gemini', googleFallback.selectedModel !== 'gemini-2.5-flash-lite');
check('unavailable Gemini falls back to a safe GPT route', googleFallback.selectedModel === 'gpt-5.4' || googleFallback.humanGateRequired === true);
check('unavailable Gemini fallback records path', Array.isArray(googleFallback.providerBudgetBucketPath) && googleFallback.providerBudgetBucketPath.includes('free_tier') && googleFallback.providerBudgetBucketPath.includes('ultra_low_cost'));
check('unavailable Gemini fallback explains fallback reason', includesText(googleFallback.fallbackReason, 'unavailable') || includesText(googleFallback.escalationReason, 'bucket escalated'));

const deepseekBlocked = budgetRouter.providerAllowedByPolicy('deepseek-chat', 'routine_docs', {
  externalSanitized: false,
});
check('DeepSeek without sanitized_only is blocked', deepseekBlocked.allowed === false);
check('DeepSeek without sanitized_only requires human gate', deepseekBlocked.humanGateRequired === true);

const deepseekDecision = budgetRouter.recommendProviderBudgetBucket(docsTask, {
  requestedModel: 'deepseek-chat',
  externalSanitized: true,
});
check('DeepSeek sanitized_only stays ultra_low_cost', deepseekDecision.providerBudgetBucket === 'ultra_low_cost');
check('DeepSeek sanitized_only is selected when explicitly allowed', deepseekDecision.selectedModel === 'deepseek-chat');
check('DeepSeek sanitized_only notes sanitized delivery', includesText(deepseekDecision.safetyNotes.join(' '), 'sanitized'));

const blockedHighCost = budgetRouter.recommendProviderBudgetBucket(implTask, {
  requestedModel: 'gpt-5.5',
  approvalReceived: false,
});
check('gpt-5.5 without approval is not selected', blockedHighCost.selectedModel !== 'gpt-5.5');
check('gpt-5.5 without approval is blockedHighCost', blockedHighCost.blockedHighCost === true);
check('gpt-5.5 without approval keeps bucket below high cost', blockedHighCost.providerBudgetBucket !== 'high_cost_human_approval');

const approvedHighCost = budgetRouter.recommendProviderBudgetBucket(implTask, {
  requestedModel: 'gpt-5.5',
  approvalReceived: true,
  providerStates: {
    'claude-sonnet-4-6': 'unavailable',
  },
});
check('approved high-cost request can select gpt-5.5', approvedHighCost.selectedModel === 'gpt-5.5');
check('approved high-cost request uses high_cost_human_approval bucket', approvedHighCost.providerBudgetBucket === 'high_cost_human_approval');
check('approved high-cost request keeps approvalRequired true', approvedHighCost.approvalRequired === true);

const claudeFallback = budgetRouter.recommendProviderBudgetBucket(reviewTask, {
  preferClaudeFinalAudit: true,
  approvalReceived: true,
  providerStates: {
    'claude-sonnet-4-6': 'unavailable',
    'gpt-5.5': 'unavailable',
  },
});
check('Claude unavailable does not block delivery', claudeFallback.selectedModel !== 'claude-sonnet-4-6');
check('Claude unavailable falls back to GPT/Codex route', claudeFallback.selectedModel === 'gpt-5.4');
check('Claude unavailable fallback keeps human gate false', claudeFallback.humanGateRequired === false);
check('Claude unavailable explanation mentions fallback', includesText(claudeFallback.fallbackReason, 'fallback') || includesText(claudeFallback.escalationReason, 'fallback'));

const ledger = costLedger.buildLedgerRecord(implTask, {
  requestedModel: 'gpt-5.5',
  approvalReceived: false,
});
check('ledger includes provider budget decision', !!ledger.providerBudgetDecision);
check('ledger includes provider budget bucket', ledger.providerBudgetBucket === blockedHighCost.providerBudgetBucket);
check('ledger includes bucket reason', typeof ledger.providerBudgetBucketReason === 'string' && ledger.providerBudgetBucketReason.length > 0);
check('ledger includes escalation reason', typeof ledger.providerBudgetEscalationReason === 'string' || ledger.providerBudgetEscalationReason === null);
check('ledger includes bucket path', Array.isArray(ledger.providerBudgetBucketPath));
check('ledger keeps high-cost block field', ledger.providerBudgetBlockedHighCost === true);

const explanation = explainability.buildRouterExplanation(implTask, {
  costPolicy: ledger,
  providerBudgetBucketDecision: ledger.providerBudgetBucketDecision,
  workerScorecard: ledger.workerScorecard,
  availabilityFallback: ledger.availabilityFallback,
}, {
  requestedModel: 'gpt-5.5',
  approvalReceived: false,
});
check('explanation includes provider budget bucket', explanation.providerBudgetBucket === ledger.providerBudgetBucket);
check('explanation includes provider budget provider', typeof explanation.providerBudgetProvider === 'string' || explanation.providerBudgetProvider === null);
check('explanation includes blocked high cost reason', includesText(explanation.expensiveModelBlockedReason, 'approval') || includesText(explanation.providerBudgetBlockedHighCostReason, 'approval'));
check('explanation includes human gate reason field', typeof explanation.humanGateReason === 'string');
check('explanation includes bucket reason', typeof explanation.providerBudgetBucketReason === 'string' && explanation.providerBudgetBucketReason.length > 0);

const routed = router.assignWorkerByRules(docsTask, {});
check('smart router attaches provider budget bucket decision', !!routed.providerBudgetBucketDecision);
check('smart router attaches ultra_low_cost bucket for docs', routed.providerBudgetBucket === 'ultra_low_cost');
check('smart router keeps gpt-5.4-mini for docs', routed.providerBudgetBucketDecision?.selectedModel === 'gpt-5.4-mini');
check('smart router explanation mentions budget bucket', includesText(routed.routerExplanation.providerBudgetBucketReason, 'bucket') || includesText(routed.routerExplanation.safetyNotes, 'Budget bucket'));

if (failures > 0) {
  console.log(`\nFAIL: v110.62 provider budget bucket router smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.62 provider budget bucket router smoke PASSED');
