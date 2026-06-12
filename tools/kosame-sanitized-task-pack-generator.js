#!/usr/bin/env node
'use strict';

/**
 * KOSAME Sanitized Task Pack Generator v110.58.0
 *
 * 外部 worker 向けの小さな安全タスクパックを生成する。
 * Secret / customer data / IP core / billing / lead management / full architecture は渡さない。
 */

const ipGate = require('./kosame-ip-protection-gate');
const securityPolicy = require('./kosame-worker-security-policy');
const costLedger = require('./kosame-cost-token-ledger');
const workerScorecard = require('./kosame-worker-scorecard');
const availabilityFallbackMatrix = require('./kosame-availability-fallback-matrix');
const explainability = require('./kosame-router-explainability-dashboard');

const TOOL_META = {
  version: '110.58.0',
  feature: 'v110-58-sanitized-task-pack-generator',
  slug: 'kosame-sanitized-task-pack-generator',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';

const EXTERNAL_ONLY_TYPES = new Set(['deepseek-chat', 'opencode', 'grok', 'cheap_code_worker', 'sanitized_worker']);

const FORBIDDEN_SCOPE = [
  'Secret / API keys / .env / credentials',
  'customer data / customer_info / lead management',
  'IP core / full architecture / orchestration full design',
  'billing / pricing / subscription / revenue model',
  'lead management / sales flow / customer management core',
];

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeWorkerType(workerType, task, context = {}) {
  const requested = String(workerType || context.workerType || task?.workerType || '').trim();
  if (requested) return requested;
  return workerScorecard.recommendWorkerForTask(task, context).modelId;
}

function normalizeWorkerClass(workerType, scorecardEntry) {
  const normalized = String(workerType || scorecardEntry?.modelId || '').toLowerCase();
  if (normalized === 'deepseek-chat' || normalized === 'opencode' || normalized === 'grok' || normalized === 'cheap_code_worker' || normalized === 'sanitized_worker') {
    return 'sanitized_only';
  }
  if (normalized === 'gpt-5.5') return 'expensive';
  if (normalized === 'gpt-5.4') return 'standard';
  if (normalized === 'gpt-5.4-mini') return 'cheap';
  if (normalized.includes('claude')) return 'final_review_optional';
  if (normalized.includes('gemini')) return 'cautious_review';
  return scorecardEntry?.modelTier || 'standard';
}

function isForbiddenFile(file) {
  const text = String(file || '');
  if (!text) return false;
  if (securityPolicy.detectForbiddenPaths(text).length > 0) return true;
  return /(?:^|\/)(?:\.env|credentials?|secret|customer(?:_?data)?|billing|lead(?:-?mgmt|(?:\s|_)?management)?|architecture|core)(?:$|[./-])/i.test(text);
}

function sanitizeAllowedFiles(files) {
  const list = Array.isArray(files) ? files : [];
  return list
    .map(file => String(file || '').trim())
    .filter(Boolean)
    .filter(file => !isForbiddenFile(file))
    .slice(0, 1);
}

function determineAllowedScope(taskType, task, context = {}) {
  const title = compactText(task?.title, task?.description, context.specText).toLowerCase();
  if (taskType === 'routine_docs' || /docs?|readme|document/i.test(title)) return ['one docs section'];
  if (taskType === 'routine_smoke' || /smoke|test/i.test(title)) return ['one smoke file'];
  if (taskType === 'routine_ui' || /ui|button|label|text fix|文言|表示/i.test(title)) return ['one UI wording change'];
  if (taskType === 'routine_light_code' || taskType === 'implementation' || /utility|helper|function|refactor/i.test(title)) return ['one utility function'];
  return [];
}

function determineExpectedOutputFormat(taskType) {
  if (taskType === 'routine_docs') return 'markdown summary + focused docs patch';
  if (taskType === 'routine_smoke') return 'single smoke patch + short verification notes';
  if (taskType === 'routine_ui') return 'copy change patch + screenshot/check notes';
  return 'single-function patch + concise verification notes';
}

function collectRiskSignals(task, context = {}) {
  const text = compactText(task?.title, task?.description, context.specText);
  const ipResult = ipGate.isIPProtectedTask(task || {}, context);
  const secretHits = securityPolicy.detectSecretLikeText(text);
  const pathHits = securityPolicy.detectForbiddenPaths(text);
  const commandHits = securityPolicy.detectForbiddenCommands(text);
  const customerDataHits = secretHits.filter(hit => /customer|顧客|personal/i.test(hit));

  return {
    ipResult,
    secretHits,
    pathHits,
    commandHits,
    customerDataHits,
    protectedHits: [
      ...new Set([
        ...ipResult.violations,
        ...secretHits,
        ...pathHits,
        ...commandHits,
      ]),
    ],
  };
}

function buildSafeSummary(task, taskType, risk, allowedWorkerClass) {
  const title = securityPolicy.redactForWorker(String(task?.title || '').slice(0, 160));
  const base = taskType === 'routine_docs'
    ? 'One docs section only'
    : taskType === 'routine_smoke'
      ? 'One smoke file only'
      : taskType === 'routine_ui'
        ? 'One UI wording change only'
        : 'One small function only';

  const riskNote = risk.protectedHits.length > 0
    ? 'Protected content removed; human review required.'
    : 'Sanitized for external worker delivery.';

  return compactText(
    `${base}:`,
    title,
    `(${allowedWorkerClass})`,
    riskNote,
  ).slice(0, 360);
}

function buildHumanGateReason(task, taskType, risk) {
  const reasons = [];
  if (!taskType || taskType === 'unknown') reasons.push('task cannot be safely classified into a small external-only pack');
  if (!taskType || taskType === 'unknown') reasons.push('small safe scope is not guaranteed');
  if (risk.ipResult.allowed === false) reasons.push(risk.ipResult.reason);
  if (risk.secretHits.length > 0) reasons.push(`secret/customer-like content detected (${risk.secretHits.slice(0, 3).join(', ')})`);
  if (risk.pathHits.length > 0) reasons.push(`forbidden path detected (${risk.pathHits.slice(0, 3).join(', ')})`);
  if (risk.commandHits.length > 0) reasons.push(`forbidden command detected (${risk.commandHits.slice(0, 3).join(', ')})`);
  return reasons.length > 0 ? reasons.join('; ') : 'human gate required';
}

function buildSanitizedTaskPack(task, context = {}) {
  const taskType = costLedger.classifyTaskType(task, context);
  const workerType = normalizeWorkerType(context.workerType, task, context);
  const scorecardEntry = workerScorecard.getWorkerScorecard(workerType);
  const workerClass = normalizeWorkerClass(workerType, scorecardEntry);
  const risk = collectRiskSignals(task, context);
  const externalSanitized = EXTERNAL_ONLY_TYPES.has(String(workerType).toLowerCase()) || workerClass === 'sanitized_only';
  const requestedModel = String(context.requestedModel || workerType || scorecardEntry.modelId || '').trim();

  const requestedEvaluation = requestedModel
    ? costLedger.evaluateRequestedModel(requestedModel, task, {
        ...context,
        approvalReceived: context.approvalReceived === true,
      })
    : costLedger.buildLedgerRecord(task, {
        ...context,
        externalSanitized,
      });

  const fallback = availabilityFallbackMatrix.recommendAvailabilityFallback(
    task,
    requestedEvaluation.selectedModel || scorecardEntry.modelId,
    context.workerState || availabilityFallbackMatrix.WORKER_STATES.healthy,
    {
      ...context,
      approvalReceived: context.approvalReceived === true,
    },
  );

  const explanation = explainability.buildRouterExplanation(task, {
    workerScorecard: scorecardEntry,
    costPolicy: requestedEvaluation,
    availabilityFallback: fallback,
    selectedWorker: scorecardEntry.workerName,
    selectedModel: requestedEvaluation.selectedModel || scorecardEntry.modelId,
    taskType,
    primary: requestedEvaluation.selectedModel || scorecardEntry.modelId,
    reason: requestedEvaluation.notes,
  }, context);

  const safeAllowedScope = determineAllowedScope(taskType, task, context);
  const safeAllowedFiles = sanitizeAllowedFiles(
    context.allowedFiles || task?.allowedFiles || task?.file_scope || [],
  );
  const secretRemoved = risk.secretHits.length > 0;
  const customerDataRemoved = risk.customerDataHits.length > 0 || /customer|顧客/i.test(compactText(task?.title, task?.description, context.specText));
  const ipProtectionApplied = true;
  const redactionApplied = externalSanitized || secretRemoved || customerDataRemoved || risk.pathHits.length > 0 || risk.commandHits.length > 0;

  const canSanitizeSafely = safeAllowedScope.length > 0
    && risk.ipResult.allowed !== false;

  const humanGateRequired = (
    !safeAllowedScope.length
    || risk.ipResult.allowed === false
    || secretRemoved
    || customerDataRemoved
    || workerType === 'gpt-5.5'
    || workerClass === 'expensive'
    || requestedEvaluation.selectionBlocked === true
    || (!canSanitizeSafely && externalSanitized)
  );

  const humanGateReason = humanGateRequired
    ? buildHumanGateReason(task, taskType, risk)
    : 'human gate not required';

  const allowedFiles = humanGateRequired ? safeAllowedFiles : safeAllowedFiles;
  const safetyNotes = [
    explanation.costReason,
    explanation.approvalRequired ? explanation.approvalReason : null,
    explanation.fallbackReason && explanation.fallbackReason !== 'no fallback needed' ? explanation.fallbackReason : null,
    explanation.humanGateRequired ? explanation.humanGateReason : null,
    workerClass === 'sanitized_only' ? 'External worker pack is sanitized_only.' : null,
    risk.ipResult.allowed === false ? 'IP/core/customer/billing scope is blocked from external delivery.' : null,
    redactionApplied ? 'Sensitive text redacted or removed before worker handoff.' : null,
  ].filter(Boolean);

  if (!safeAllowedScope.length || taskType === 'unknown') {
    return {
      version: TOOL_META.version,
      timestamp: new Date().toISOString(),
      taskId: String(task?.id || context.taskId || `pack-${Date.now()}`),
      workerType,
      allowedWorkerClass: workerClass,
      taskTitle: securityPolicy.redactForWorker(String(task?.title || '').slice(0, 160)),
      taskSummary: 'HUMAN_GATE_REQUIRED: task cannot be safely sanitized for external delivery.',
      allowedFiles: [],
      allowedScope: [],
      forbiddenScope: [...FORBIDDEN_SCOPE],
      redactionApplied,
      ipProtectionApplied,
      customerDataRemoved,
      secretRemoved,
      expectedOutputFormat: 'human review packet',
      verifyCommands: ['npm run smoke:v110-58'],
      humanGateRequired: true,
      humanGateReason,
      safetyNotes,
      routerExplanation: explanation,
      availabilityFallback: fallback,
      costPolicy: requestedEvaluation,
      workerScorecard: scorecardEntry,
    };
  }

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    taskId: String(task?.id || context.taskId || `pack-${Date.now()}`),
    workerType,
    allowedWorkerClass: workerClass,
    taskTitle: securityPolicy.redactForWorker(String(task?.title || '').slice(0, 160)),
    taskSummary: buildSafeSummary(task, taskType, risk, workerClass),
    allowedFiles: allowedFiles.length > 0 ? allowedFiles : [],
    allowedScope: safeAllowedScope,
    forbiddenScope: [...FORBIDDEN_SCOPE],
    redactionApplied,
    ipProtectionApplied,
    customerDataRemoved,
    secretRemoved,
    expectedOutputFormat: determineExpectedOutputFormat(taskType),
    verifyCommands: taskType === 'routine_smoke'
      ? ['node --check <smoke file>', 'npm run smoke:v110-58']
      : taskType === 'routine_docs'
        ? ['node --check <changed file>', 'npm run smoke:v110-58']
        : ['node --check <changed file>', 'npm run smoke:v110-58'],
    humanGateRequired,
    humanGateReason,
    safetyNotes,
    routerExplanation: explanation,
    availabilityFallback: fallback,
    costPolicy: requestedEvaluation,
    workerScorecard: scorecardEntry,
  };
}

module.exports = {
  TOOL_META,
  FORBIDDEN_SCOPE,
  normalizeWorkerType,
  normalizeWorkerClass,
  sanitizeAllowedFiles,
  determineAllowedScope,
  determineExpectedOutputFormat,
  collectRiskSignals,
  buildSanitizedTaskPack,
};
