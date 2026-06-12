#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const splitter = require('../tools/kosame-agent-work-order-auto-splitter');
const healthSnapshot = require('../tools/kosame-provider-availability-health-snapshot');
const costLedger = require('../tools/kosame-cost-token-ledger');
const router = require('../tools/kosame-smart-task-router');
const mergeGuard = require('../tools/kosame-parallel-agent-merge-guard');
const explainability = require('../tools/kosame-router-explainability-dashboard');

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
  if (Array.isArray(value)) return value.some(v => includesText(v, fragment));
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

function task(id, title, description, file_scope) {
  return { id, title, description, file_scope };
}

console.log('=== v110.69 agent work order auto splitter smoke ===');

check('package version >= 110.69.0', versionAtLeast(pkg.version, 110, 69));
check('splitter module available', typeof splitter.buildAgentWorkOrderAutoSplit === 'function');
check('v110.68 smoke script retained in package.json', Object.prototype.hasOwnProperty.call(pkg.scripts || {}, 'smoke:v110-68'));
check('v110.68 tool file still exists on disk', fs.existsSync(path.join(__dirname, '../tools/kosame-final-release-readiness-board.js')));
check('v110.68 smoke file still exists on disk', fs.existsSync(path.join(__dirname, 'v110-68-final-release-readiness-board-smoke.js')));

const docsResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Update one docs section and add a small smoke test',
  requestedOutcome: 'Split a safe docs plus smoke task',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'low',
  allowedFiles: ['docs/work-order-splitter.md', 'smoke/v110-69-agent-work-order-auto-splitter-smoke.js'],
});

check('safe docs split stays safe', docsResult.status === 'safe' || docsResult.status === 'caution');
check('safe docs split has work orders', Array.isArray(docsResult.workOrders) && docsResult.workOrders.length >= 2);
check('safe docs split has provider health snapshot', !!docsResult.providerAvailabilityHealthSnapshot);
check('safe docs split has summaryForDashboard', !!docsResult.summaryForDashboard);
check('safe docs split has release readiness summary', includesText(docsResult.summaryForDashboard.releaseReadinessSummary, 'v110.68 board compatible'));
check('safe docs split includes GPT/Codex work order', docsResult.workOrders.some(w => w.agentKey === 'gpt_codex'));
check('safe docs split includes DeepSeek/opencode work order', docsResult.workOrders.some(w => w.agentKey === 'deepseek_opencode'));

const docsGpt = docsResult.workOrders.find(w => w.agentKey === 'gpt_codex');
check('GPT/Codex work order has version', docsGpt?.version === '110.69');
check('GPT/Codex work order has targetFiles', Array.isArray(docsGpt?.targetFiles) && docsGpt.targetFiles.length > 0);
check('GPT/Codex work order has expectedSmoke', Array.isArray(docsGpt?.expectedSmoke) && docsGpt.expectedSmoke.includes('npm run smoke:v110-69'));
check('GPT/Codex work order has sanitizedTaskPack', !!docsGpt?.sanitizedTaskPack && Array.isArray(docsGpt.sanitizedTaskPack.verifyCommands));
check('GPT/Codex work order exposes allowedScope', Array.isArray(docsGpt?.allowedScope) && docsGpt.allowedScope.length > 0);
check('GPT/Codex work order exposes forbiddenScope', Array.isArray(docsGpt?.forbiddenScope) && docsGpt.forbiddenScope.length > 0);

const docsDeepseek = docsResult.workOrders.find(w => w.agentKey === 'deepseek_opencode');
check('DeepSeek/opencode work order is sanitized_only', docsDeepseek?.sanitizedTaskPack?.allowedWorkerClass === 'sanitized_only');
check('DeepSeek/opencode work order keeps files safe', !(docsDeepseek?.targetFiles || []).some(f => /env|secret|customer|billing|lead|anesty|transcriber/i.test(f)));

const secretResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Handle KOSAME_API_KEY and .env data for a secret workflow',
  requestedOutcome: 'Split a secret handling request',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'high',
  forbiddenContext: 'Secret / API keys / .env / credentials',
});
check('secret request is human_gate or blocked', secretResult.status === 'human_gate' || secretResult.status === 'blocked');
check('secret request blocked reasons mention secrets', includesText(secretResult.blockedReasons, 'secret') || includesText(secretResult.blockedReasons, 'credentials'));

const customerResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Process customer data for a lead management workflow',
  requestedOutcome: 'Split a customer data request',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'high',
  forbiddenContext: 'customer data / lead management',
});
check('customer request is human_gate or blocked', customerResult.status === 'human_gate' || customerResult.status === 'blocked');
check('customer request blocked reasons mention customer', includesText(customerResult.blockedReasons, 'customer'));

const ipResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Revise full architecture, billing flow, and orchestration core',
  requestedOutcome: 'Split IP/core request',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'high',
  forbiddenContext: 'IP core / full architecture / billing / lead management',
});
check('IP/core request is human_gate or blocked', ipResult.status === 'human_gate' || ipResult.status === 'blocked');
check('IP/core request blocked reasons mention architecture', includesText(ipResult.blockedReasons, 'architecture') || includesText(ipResult.blockedReasons, 'core'));

const billingResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Update billing and lead management logic',
  requestedOutcome: 'Split billing / lead management request',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'high',
  forbiddenContext: 'billing / lead management',
});
check('billing request is human_gate or blocked', billingResult.status === 'human_gate' || billingResult.status === 'blocked');
check('billing request blocked reasons mention billing', includesText(billingResult.blockedReasons, 'billing'));

const googleResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Check Google IAM / Cloud Run environment',
  requestedOutcome: 'Split Google review request',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'medium',
  allowedFiles: ['tools/google-env-check.js', 'smoke/v110-69-agent-work-order-auto-splitter-smoke.js'],
  preferredAgents: ['gemini'],
});
check('Google request includes Gemini work order', googleResult.workOrders.some(w => w.agentKey === 'gemini'));
const geminiWorkOrder = googleResult.workOrders.find(w => w.agentKey === 'gemini');
check('Gemini work order has version', geminiWorkOrder?.version === '110.69');
check('Gemini work order has targetFiles', Array.isArray(geminiWorkOrder?.targetFiles) && geminiWorkOrder.targetFiles.length > 0);

const highCostResult = splitter.buildAgentWorkOrderAutoSplit({
  userRequest: 'Try gpt-5.5 for this split',
  requestedOutcome: 'Split with high-cost model',
  targetRepo: 'kosame-dev-orchestra',
  targetVersion: '110.69',
  riskLevel: 'high',
  preferredAgents: ['gpt_codex'],
  requestedModel: 'gpt-5.5',
});
check('gpt-5.5 without approval is blocked or human_gate', highCostResult.status === 'human_gate' || highCostResult.status === 'blocked');
check('gpt-5.5 without approval is noted in blocked reasons', includesText(highCostResult.blockedReasons, 'gpt-5.5') || includesText(highCostResult.blockedReasons, 'high cost'));

const ledger = costLedger.buildLedgerRecord(task('Work order split docs', 'Split one docs section and one smoke task'), {
  generateWorkOrderAutoSplitter: true,
  workOrderRequest: {
    userRequest: 'Update one docs section and add a small smoke test',
    requestedOutcome: 'Split a safe docs plus smoke task',
    targetRepo: 'kosame-dev-orchestra',
    targetVersion: '110.69',
    riskLevel: 'low',
    allowedFiles: ['docs/work-order-splitter.md'],
  },
});
check('ledger includes workOrderAutoSplitter', !!ledger.workOrderAutoSplitter);
check('ledger includes provider health snapshot', !!ledger.providerAvailabilityHealthSnapshot);

const explanation = explainability.buildRouterExplanation(
  task('Work order split docs', 'Split one docs section and one smoke task'),
  {
    costPolicy: ledger,
    workOrderAutoSplitter: ledger.workOrderAutoSplitter,
    providerHealth: ledger.providerHealth,
    providerAvailabilityHealthSnapshot: ledger.providerAvailabilityHealthSnapshot,
  },
  {},
);
check('router explanation includes workOrderAutoSplitter', !!explanation.workOrderAutoSplitter);
check('router explanation includes workOrder summary', includesText(explanation.safetyNotes, 'work-order split') || includesText(explanation.safetyNotes, 'v110.68 board'));

const routed = router.assignWorkerByRules(
  { title: 'Update one docs section and add a smoke test', description: 'splitter integration smoke' },
  {
    generateWorkOrderAutoSplitter: true,
    workOrderRequest: {
      userRequest: 'Update one docs section and add a small smoke test',
      requestedOutcome: 'Split a safe docs plus smoke task',
      targetRepo: 'kosame-dev-orchestra',
      targetVersion: '110.69',
      riskLevel: 'low',
      allowedFiles: ['docs/work-order-splitter.md', 'smoke/v110-69-agent-work-order-auto-splitter-smoke.js'],
    },
  },
);
check('router attaches workOrderAutoSplitter', !!routed.workOrderAutoSplitter);
check('router-attached workOrderAutoSplitter has work orders', Array.isArray(routed.workOrderAutoSplitter?.workOrders) && routed.workOrderAutoSplitter.workOrders.length >= 2);

check('v110.66 health snapshot behavior remains intact', healthSnapshot.buildProviderAvailabilityHealthSnapshot(
  task('Docs fix', 'Update one docs section only'),
  { providerStates: { gemini: 'healthy', claude: 'healthy', grok: 'healthy', deepseek_opencode: 'healthy' } },
).providerHealth?.hasBlocked === true || typeof healthSnapshot.buildProviderAvailabilityHealthSnapshot(
  task('Docs fix', 'Update one docs section only'),
  { providerStates: { gemini: 'healthy', claude: 'healthy', grok: 'healthy', deepseek_opencode: 'healthy' } },
).providerHealth?.hasLimited === 'boolean');

check('v110.67 merge guard module still exports version ownership checks', typeof mergeGuard.checkVersionOwnership === 'function');
check('v110.67 merge guard still recognizes 110.67 ownership', mergeGuard.checkVersionOwnership('110.67', 'claude', {}).ok === true);
check('v110.67 merge guard still recognizes 110.66 ownership collision', mergeGuard.checkVersionOwnership('110.66', 'claude', {}).ok === false);
check('v110.68 final readiness board file remains on disk', fs.existsSync(path.join(__dirname, '../tools/kosame-final-release-readiness-board.js')));

check('safe docs split attaches summaryForDashboard items', Array.isArray(docsResult.summaryForDashboard.items) && docsResult.summaryForDashboard.items.length >= 2);
check('safe docs split nextAllowedAction present', typeof docsResult.nextAllowedAction === 'string' && docsResult.nextAllowedAction.length > 0);
check('safe docs split humanApprovalRequired is boolean', typeof docsResult.humanApprovalRequired === 'boolean');

if (failures > 0) {
  console.log(`\nFAIL: v110.69 agent work order auto splitter smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.69 agent work order auto splitter smoke PASSED');
