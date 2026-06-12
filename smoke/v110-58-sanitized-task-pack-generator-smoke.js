#!/usr/bin/env node
'use strict';

const pkg = require('../package.json');
const generator = require('../tools/kosame-sanitized-task-pack-generator');
const ipGate = require('../tools/kosame-ip-protection-gate');
const costLedger = require('../tools/kosame-cost-token-ledger');
const workerScorecard = require('../tools/kosame-worker-scorecard');
const fallbackMatrix = require('../tools/kosame-availability-fallback-matrix');
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

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function includesText(value, fragment) {
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function buildPack(task, workerType, context = {}) {
  return generator.buildSanitizedTaskPack(task, {
    ...context,
    workerType,
    requestedModel: context.requestedModel || workerType,
  });
}

console.log('=== v110.58 sanitized task pack generator smoke ===');

check('package version >= 110.58.0', versionAtLeast(pkg.version, 110, 58));
check('generator module is available', typeof generator.buildSanitizedTaskPack === 'function');

const docsTask = {
  id: 'T-DOCS',
  title: 'Update router explanation docs',
  description: 'Refresh one docs section for the router explanation text.',
  file_scope: ['docs/router-explainability.md'],
};

const smokeTask = {
  id: 'T-SMOKE',
  title: 'Add sanitized task pack smoke',
  description: 'Add one smoke file for the new sanitized task pack generator.',
  file_scope: ['smoke/v110-58-sanitized-task-pack-generator-smoke.js'],
};

const utilTask = {
  id: 'T-UTIL',
  title: 'Refactor one utility function',
  description: 'Keep this to one small utility function.',
  file_scope: ['tools/kosame-sanitized-task-pack-generator.js'],
};

const secretTask = {
  id: 'T-SECRET',
  title: 'Handle KOSAME_API_KEY and .env',
  description: 'Update API key and secret handling for .env / credentials.',
  file_scope: ['.env', 'tools/kosame-secret-loader.js'],
};

const customerTask = {
  id: 'T-CUSTOMER',
  title: 'Customer data cleanup',
  description: 'Touch customer data and customer_name handling.',
  file_scope: ['data/customer.json'],
};

const ipTask = {
  id: 'T-IP',
  title: 'Smart Router core full architecture update',
  description: 'Revise the full architecture, billing flow, and orchestration core.',
  file_scope: ['docs/architecture.md'],
};

const billingTask = {
  id: 'T-BILL',
  title: 'Billing and lead management redesign',
  description: 'Change billing flow and lead management orchestration.',
  file_scope: ['docs/billing.md'],
};

const docsPack = buildPack(docsTask, 'deepseek-chat', { specText: docsTask.description });
check('safe docs task creates sanitized task pack', docsPack.humanGateRequired === false);
check('docs pack is sanitized_only', docsPack.allowedWorkerClass === 'sanitized_only');
check('docs allowedFiles is safe', Array.isArray(docsPack.allowedFiles) && docsPack.allowedFiles.length === 1 && docsPack.allowedFiles[0] === 'docs/router-explainability.md');
check('docs allowedScope is small', Array.isArray(docsPack.allowedScope) && docsPack.allowedScope.includes('one docs section'));
check('docs forbiddenScope is present', Array.isArray(docsPack.forbiddenScope) && docsPack.forbiddenScope.length > 0);
check('docs expectedOutputFormat is present', typeof docsPack.expectedOutputFormat === 'string' && docsPack.expectedOutputFormat.length > 0);
check('docs verifyCommands are present', Array.isArray(docsPack.verifyCommands) && docsPack.verifyCommands.length > 0);
check('docs redaction applied for external worker', docsPack.redactionApplied === true);

const smokePack = buildPack(smokeTask, 'opencode', { specText: smokeTask.description });
check('safe smoke task creates sanitized task pack', smokePack.humanGateRequired === false);
check('smoke pack is sanitized_only', smokePack.allowedWorkerClass === 'sanitized_only');
check('smoke allowedFiles is safe', Array.isArray(smokePack.allowedFiles) && smokePack.allowedFiles.length === 1 && smokePack.allowedFiles[0] === 'smoke/v110-58-sanitized-task-pack-generator-smoke.js');
check('smoke allowedScope is small', Array.isArray(smokePack.allowedScope) && smokePack.allowedScope.includes('one smoke file'));

const utilPack = buildPack(utilTask, 'grok', { specText: utilTask.description });
check('one-function utility task creates sanitized task pack', utilPack.humanGateRequired === false);
check('utility pack is sanitized_only', utilPack.allowedWorkerClass === 'sanitized_only');
check('utility allowedScope is small', Array.isArray(utilPack.allowedScope) && utilPack.allowedScope.includes('one utility function'));

const secretPack = buildPack(secretTask, 'deepseek-chat', { specText: secretTask.description });
check('Secret/API key task is blocked or redacted with human_gate', secretPack.humanGateRequired === true);
check('Secret/API key task reports redaction or removal', secretPack.redactionApplied === true || secretPack.secretRemoved === true);
check('Secret/API key task human gate reason mentions secret', includesText(secretPack.humanGateReason, 'secret') || includesText(secretPack.humanGateReason, 'api'));
check('allowedFiles does not include forbidden files', Array.isArray(secretPack.allowedFiles) && !secretPack.allowedFiles.some(file => includesText(file, '.env') || includesText(file, 'credentials')));

const customerPack = buildPack(customerTask, 'deepseek-chat', { specText: customerTask.description });
check('customer data task is blocked or redacted with human_gate', customerPack.humanGateRequired === true);
check('customer data task reports redaction or removal', customerPack.redactionApplied === true || customerPack.customerDataRemoved === true);
check('customer data task human gate reason mentions customer', includesText(customerPack.humanGateReason, 'customer') || includesText(customerPack.humanGateReason, '顧客'));

const ipPack = buildPack(ipTask, 'deepseek-chat', { specText: ipTask.description });
check('IP/core/full architecture task returns HUMAN_GATE_REQUIRED', ipPack.humanGateRequired === true);
check('IP/core pack human gate reason mentions IP/core', includesText(ipPack.humanGateReason, 'ip') || includesText(ipPack.humanGateReason, 'architecture') || includesText(ipPack.humanGateReason, 'core'));

const billingPack = buildPack(billingTask, 'deepseek-chat', { specText: billingTask.description });
check('billing/lead management task returns HUMAN_GATE_REQUIRED', billingPack.humanGateRequired === true);
check('billing pack human gate reason mentions billing or lead management', includesText(billingPack.humanGateReason, 'billing') || includesText(billingPack.humanGateReason, 'lead'));

const deepseekPack = buildPack(docsTask, 'deepseek-chat', { specText: docsTask.description });
const opencodePack = buildPack(docsTask, 'opencode', { specText: docsTask.description });
check('DeepSeek receives sanitized_only pack', deepseekPack.allowedWorkerClass === 'sanitized_only');
check('opencode receives sanitized_only pack', opencodePack.allowedWorkerClass === 'sanitized_only');

const classifiedDocs = router.classifyTask(docsTask, { specText: docsTask.description });
const docsRules = router.assignWorkerByRules(classifiedDocs, { specText: docsTask.description });
const docsExplanation = explainability.buildRouterExplanation(classifiedDocs, docsRules, { requestedModel: 'gpt-5.4-mini' });
check('v110.57 explainability says cheap-first / gpt-5.4-mini for routine docs', includesText(docsExplanation.costReason, 'cheap-first') && includesText(docsExplanation.costReason, 'gpt-5.4-mini'));
check('v110.57 explainability includes cost tier', typeof docsExplanation.modelTier === 'string' && docsExplanation.modelTier.length > 0);
check('v110.57 explainability includes approval_required', typeof docsExplanation.approvalRequired === 'boolean');

const blockedExplanation = explainability.buildRouterExplanation(
  classifiedDocs,
  docsRules,
  { requestedModel: 'gpt-5.5', approvalReceived: false },
);
check('gpt-5.5 request without approval says blocked', blockedExplanation.expensiveModelBlocked === true && includesText(blockedExplanation.expensiveModelBlockedReason, 'explicit human approval'));

const ipExplanation = explainability.buildRouterExplanation(
  router.classifyTask(ipTask, { specText: ipTask.description }),
  router.assignWorkerByRules(router.classifyTask(ipTask, { specText: ipTask.description }), { specText: ipTask.description }),
  { requestedModel: 'gpt-5.4' },
);
check('IP/core task explanation includes human_gate reason', includesText(ipExplanation.humanGateReason, 'human gate') || includesText(ipExplanation.humanGateReason, 'ip/core'));

const claudeFallback = fallbackMatrix.recommendAvailabilityFallback(
  docsTask,
  'claude-sonnet-4-6',
  fallbackMatrix.WORKER_STATES.unavailable,
  { approvalReceived: false },
);
const claudeExplanation = explainability.buildRouterExplanation(
  docsTask,
  {
    currentModel: 'claude-sonnet-4-6',
    selectedModel: claudeFallback.recommendedModelId,
    availabilityFallback: claudeFallback,
    workerScorecard: workerScorecard.recommendWorkerForTask(docsTask),
    costPolicy: costLedger.buildLedgerRecord(docsTask),
  },
  {},
);
check('Claude unavailable explanation says delivery can continue', includesText(claudeExplanation.safetyNotes, 'delivery can continue'));

const geminiTask = {
  id: 'T-GCP',
  title: 'Google IAM Cloud Run caution review',
  description: 'Review Google IAM and Cloud Run behavior.',
};
const geminiFallback = fallbackMatrix.recommendAvailabilityFallback(
  geminiTask,
  'gemini-2.5-flash-lite',
  fallbackMatrix.WORKER_STATES.unavailable,
  { approvalReceived: false },
);
const geminiExplanation = explainability.buildRouterExplanation(
  geminiTask,
  {
    currentModel: 'gemini-2.5-flash-lite',
    selectedModel: geminiFallback.recommendedModelId,
    availabilityFallback: geminiFallback,
    workerScorecard: workerScorecard.recommendWorkerForTask(geminiTask),
    costPolicy: costLedger.buildLedgerRecord(geminiTask),
  },
  {},
);
check('Gemini unavailable on Google/IAM explains cautious fallback or human_gate', includesText(geminiExplanation.safetyNotes, 'cautious fallback or human gate') || includesText(geminiExplanation.humanGateReason, 'human gate'));

const deepseekUnsafeFallback = fallbackMatrix.recommendAvailabilityFallback(
  ipTask,
  'deepseek-chat',
  fallbackMatrix.WORKER_STATES.unsafe_for_task,
  { approvalReceived: false },
);
const deepseekUnsafeExplanation = explainability.buildRouterExplanation(
  ipTask,
  {
    currentModel: 'deepseek-chat',
    selectedModel: deepseekUnsafeFallback.recommendedModelId,
    availabilityFallback: deepseekUnsafeFallback,
    workerScorecard: workerScorecard.recommendWorkerForTask(ipTask, { externalSanitized: true }),
    costPolicy: costLedger.buildLedgerRecord(ipTask, { externalSanitized: true }),
  },
  {},
);
check('DeepSeek unsafe explains sanitized-only / route away', includesText(deepseekUnsafeExplanation.safetyNotes, 'route away from external_sanitized') || includesText(deepseekUnsafeExplanation.safetyNotes, 'sanitized-only'));

const ledgerDocs = costLedger.buildLedgerRecord(docsTask, { verifyRunCount: 2 });
check('v110.54 cost ledger behavior remains intact', ledgerDocs.selectedModel === 'gpt-5.4-mini' && ledgerDocs.modelTier === 'cheap');

const ledgerBlocked = costLedger.evaluateRequestedModel('gpt-5.5', docsTask, {});
check('gpt-5.5 remains blocked unless approved', ledgerBlocked.selectionBlocked === true && ledgerBlocked.approvalRequired === true);

const scorecardDocs = workerScorecard.recommendWorkerForTask(docsTask);
check('v110.55 scorecard behavior remains intact', scorecardDocs.modelId === 'gpt-5.4-mini' && scorecardDocs.modelTier === 'cheap');

const ipGateCheck = ipGate.isIPProtectedTask(ipTask, {});
check('v110.53 IP gate behavior remains intact', ipGateCheck.allowed === false);

const fallbackCheck = fallbackMatrix.recommendAvailabilityFallback(
  docsTask,
  'gpt-5.4-mini',
  fallbackMatrix.WORKER_STATES.unavailable,
  {},
);
check('v110.56 fallback behavior remains intact', fallbackCheck.humanGateRequired === false && fallbackCheck.canProceed === true);

if (failures > 0) {
  console.error(`\nFAIL: v110.58 sanitized task pack generator smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.58 sanitized task pack generator smoke PASSED');
