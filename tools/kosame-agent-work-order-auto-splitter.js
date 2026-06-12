#!/usr/bin/env node
'use strict';

/**
 * KOSAME Agent Work Order Auto Splitter v110.69.0
 *
 * One-line / large request を GPT / Claude / Gemini / Grok / DeepSeek/opencode 向けの
 * dryRun work order に安全分割する。
 *
 * - 実AI呼び出しなし
 * - 実API送信なし
 * - Secret / customer / salesDX / transcriber / IP-core / billing / lead management は遮断
 * - DeepSeek/opencode は sanitized_only のみ
 * - v110.66 provider health / v110.67 merge guard / v110.68 readiness summary と接続しやすい出力
 */

const fs = require('fs');
const path = require('path');

const budgetRouter = require('./kosame-provider-budget-bucket-router');
const providerHealthSnapshot = require('./kosame-provider-availability-health-snapshot');
const securityPolicy = require('./kosame-worker-security-policy');
const ipGate = require('./kosame-ip-protection-gate');
const workerScorecard = require('./kosame-worker-scorecard');
const explainability = require('./kosame-router-explainability-dashboard');
const sanitizedTaskPackGenerator = require('./kosame-sanitized-task-pack-generator');

const TOOL_META = {
  version: '110.69.0',
  feature: 'v110-69-agent-work-order-auto-splitter',
  slug: 'kosame-agent-work-order-auto-splitter',
  dryRunOnly: true,
};

const STATUS = {
  safe: 'safe',
  caution: 'caution',
  blocked: 'blocked',
  human_gate: 'human_gate',
};

const AGENTS = {
  gpt_codex: {
    key: 'gpt_codex',
    agent: 'GPT / Codex',
    role: '設計・裁定・検収・安全分解・長距離実装',
    modelId: 'gpt-5.4-mini',
    providerKey: 'gpt_codex',
    providerLabel: 'GPT / Codex',
    workerClass: 'cheap',
    preferredTaskHint: 'implementation',
    defaultTargetFiles: ['tools/**', 'smoke/**', 'docs/**', 'package.json'],
    expectedSmoke: ['npm run smoke:v110-69', 'npm run verify'],
    maxTargetFiles: 3,
    includeByDefault: true,
  },
  claude: {
    key: 'claude',
    agent: 'Claude',
    role: '品質監査・境界監査・高難度仕上げ',
    modelId: 'claude-sonnet-4-6',
    providerKey: 'claude',
    providerLabel: 'Claude',
    workerClass: 'standard',
    preferredTaskHint: 'final_review',
    defaultTargetFiles: ['docs/**', 'smoke/**', 'tools/**'],
    expectedSmoke: ['npm run smoke:v110-69', 'npm run verify'],
    maxTargetFiles: 2,
    includeByDefault: false,
  },
  gemini: {
    key: 'gemini',
    agent: 'Gemini',
    role: 'Google / IAM / Cloud Run / Scheduler / 環境確認',
    modelId: 'gemini-2.5-flash-lite',
    providerKey: 'gemini',
    providerLabel: 'Gemini',
    workerClass: 'standard',
    preferredTaskHint: 'google_iam_caution',
    defaultTargetFiles: ['tools/**', 'smoke/**', 'fixtures/**', 'docs/**'],
    expectedSmoke: ['npm run smoke:v110-66', 'npm run smoke:v110-69'],
    maxTargetFiles: 2,
    includeByDefault: false,
  },
  grok: {
    key: 'grok',
    agent: 'Grok',
    role: '穴探し・反対意見・リスクレビュー',
    modelId: 'grok',
    providerKey: 'grok',
    providerLabel: 'Grok',
    workerClass: 'standard',
    preferredTaskHint: 'review',
    defaultTargetFiles: ['docs/**', 'smoke/**', 'tools/**'],
    expectedSmoke: ['npm run smoke:v110-67', 'npm run smoke:v110-69'],
    maxTargetFiles: 2,
    includeByDefault: false,
  },
  deepseek_opencode: {
    key: 'deepseek_opencode',
    agent: 'DeepSeek / opencode',
    role: 'sanitized_only の低リスク・小タスク・土木作業',
    modelId: 'deepseek-chat',
    providerKey: 'deepseek_opencode',
    providerLabel: 'DeepSeek / opencode',
    workerClass: 'sanitized_only',
    preferredTaskHint: 'routine_light_code',
    defaultTargetFiles: ['docs/**', 'smoke/**', 'tools/**'],
    expectedSmoke: ['npm run smoke:v110-58', 'npm run smoke:v110-59', 'npm run smoke:v110-69'],
    maxTargetFiles: 1,
    includeByDefault: false,
  },
};

const AGENT_ORDER = ['gpt_codex', 'claude', 'gemini', 'grok', 'deepseek_opencode'];

const FORBIDDEN_SCOPE = [
  'Secret / API keys / .env / credentials',
  'customer data / customer_info / lead management',
  'IP core / full architecture / orchestration full design',
  'billing / pricing / subscription / revenue model',
  'lead management / sales flow / customer management core',
  '営業DX',
  'transcriber',
  'ANESTY Board',
];

const FORBIDDEN_FILE_RE = /(?:^|\/)(?:\.env(?:\..*)?|credentials?|secrets?|secret|customer(?:_?data|_?info)?|sales(?:-|_)?dx|transcriber|anesty(?:-|_)?board|billing|lead(?:-|_)?management|architecture|core)(?:$|[./-])/i;

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(item => (item == null ? [] : [String(item).trim()]))
    .filter(Boolean))];
}

function normalizeText(...parts) {
  return compactText(...parts)
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function normalizeRepoName(value) {
  return String(value || '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/.*\//, '')
    .toLowerCase();
}

function normalizeVersion(v) {
  const value = String(v || '').trim().replace(/^v/i, '');
  const [major = '110', minor = '69'] = value.split('.');
  return `${major}.${minor}`;
}

function normalizePackageVersion(v) {
  const [major = '110', minor = '69'] = normalizeVersion(v).split('.');
  return `${major}.${minor}.0`;
}

function safeText(value, max = 320) {
  const text = securityPolicy.redactForWorker(String(value || ''));
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trim()}…` : text;
}

function isForbiddenAgent(agentKey) {
  const normalized = normalizeText(agentKey);
  return [
    'gpt 5.5',
    'gpt5.5',
    'high cost model',
    'expensive model',
  ].some(token => normalized.includes(token));
}

function normalizeAgentKey(agent) {
  const normalized = normalizeText(agent);
  if (!normalized) return null;
  if (normalized.includes('gpt') || normalized.includes('codex')) return 'gpt_codex';
  if (normalized.includes('claude')) return 'claude';
  if (normalized.includes('gemini') || normalized.includes('google') || normalized.includes('iam') || normalized.includes('cloud run')) return 'gemini';
  if (normalized.includes('grok')) return 'grok';
  if (normalized.includes('deepseek') || normalized.includes('opencode') || normalized.includes('sanitized')) return 'deepseek_opencode';
  return null;
}

function toAgentKeys(values) {
  return uniqueList(values)
    .map(normalizeAgentKey)
    .filter(Boolean);
}

function includesAny(text, patterns) {
  const source = normalizeText(text);
  return patterns.some(pattern => source.includes(normalizeText(pattern)));
}

function detectRiskSignals(request = {}, context = {}) {
  const text = compactText(
    request.userRequest,
    request.requestedOutcome,
    request.riskLevel,
    request.forbiddenContext,
    request.targetRepo,
    request.targetVersion,
    context.specText,
  );

  const secretHits = securityPolicy.detectSecretLikeText(text);
  const pathHits = securityPolicy.detectForbiddenPaths(text);
  const commandHits = securityPolicy.detectForbiddenCommands(text);
  const ipHits = ipGate.detectProtectedIP(text);

  const salesDx = includesAny(text, ['営業DX', 'sales dx', 'sales-dx', 'transcriber']);
  const anestyBoard = includesAny(text, ['ANESTY Board']);
  const customer = includesAny(text, ['customer data', 'customer info', 'customer_name', '顧客情報', '顧客データ', 'pii']);
  const billingLead = includesAny(text, ['billing', 'lead management', 'pricing', 'subscription', 'revenue model', '課金導線', '営業導線', '顧客管理']);
  const ipCore = ipHits.length > 0;
  const forbiddenRepo = normalizeRepoName(request.targetRepo || context.targetRepo || '') && normalizeRepoName(request.targetRepo || context.targetRepo || '') !== 'kosame-dev-orchestra';
  const realApi = context.realApiCall === true || includesAny(text, ['real api', 'live api', 'external api']);
  const realBilling = context.realBilling === true || includesAny(text, ['real billing', 'live billing']);
  const realDeploy = context.realDeploy === true || includesAny(text, ['deploy', 'cloud run deploy', 'release deploy']);
  const realIam = context.realIamMutation === true || includesAny(text, ['iam', 'service account', 'role binding']);
  const gpt55Requested = includesAny(text, ['gpt-5.5', 'gpt 5.5', 'high cost model', 'expensive model'])
    || toAgentKeys([request.requestedModel, context.requestedModel, request.preferredAgents, context.preferredAgents]).includes('gpt_codex')
      && includesAny(text, ['gpt-5.5']);
  const approvalReceived = context.approvalReceived === true || request.approvalReceived === true;

  return {
    text,
    secretHits,
    pathHits,
    commandHits,
    ipHits,
    salesDx,
    anestyBoard,
    customer,
    billingLead,
    ipCore,
    forbiddenRepo,
    realApi,
    realBilling,
    realDeploy,
    realIam,
    highCostWithoutApproval: gpt55Requested && !approvalReceived,
    hasSensitive:
      secretHits.length > 0
      || pathHits.length > 0
      || commandHits.length > 0
      || salesDx
      || anestyBoard
      || customer
      || billingLead
      || ipCore
      || realApi
      || realBilling
      || realDeploy
      || realIam,
  };
}

function filteredFiles(files, maxCount = 2) {
  return uniqueList(files)
    .map(file => String(file).trim())
    .filter(Boolean)
    .filter(file => !FORBIDDEN_FILE_RE.test(file))
    .slice(0, maxCount);
}

function pickTargetFiles(agent, request = {}, context = {}) {
  const candidates = filteredFiles(
    request.allowedFiles
      || context.allowedFiles
      || request.forbiddenFiles
      || agent.defaultTargetFiles,
    agent.maxTargetFiles,
  );
  if (candidates.length > 0) return candidates;
  return [...agent.defaultTargetFiles].slice(0, agent.maxTargetFiles);
}

function shouldIncludeAgent(agent, request = {}, risk = {}) {
  const text = compactText(request.userRequest, request.requestedOutcome, request.riskLevel, request.forbiddenContext);
  const preferred = new Set(toAgentKeys(request.preferredAgents || []));
  const includePreferred = preferred.has(agent.key);
  const hasSimpleLanguage = includesAny(text, ['docs', 'documentation', 'readme', 'smoke', 'ui', 'button', 'label', 'typo', 'text fix', 'utility', 'helper', 'small', 'simple']);
  const hasReviewLanguage = includesAny(text, ['review', 'audit', 'quality', 'release', 'acceptance', 'adversarial', 'hole', 'risk', 'counter', 'gap']);
  const hasGoogleLanguage = includesAny(text, ['google', 'gcp', 'iam', 'cloud run', 'cloudrun', 'scheduler', 'secret manager']);
  const hasImplementationLanguage = includesAny(text, ['implement', 'build', 'create', 'add', 'refactor', 'rewrite', 'code', 'feature', 'fix']);

  if (agent.key === 'gpt_codex') return true;
  if (agent.key === 'deepseek_opencode') return !risk.hasSensitive && (hasSimpleLanguage || includePreferred || includesAny(text, ['sanitized', 'low risk', 'small task']));
  if (agent.key === 'claude') return hasReviewLanguage || includePreferred || includesAny(text, ['final quality', 'final review']) || (request.riskLevel || '').toLowerCase() === 'high';
  if (agent.key === 'gemini') return hasGoogleLanguage || includePreferred;
  if (agent.key === 'grok') return hasReviewLanguage || includePreferred || (request.riskLevel || '').toLowerCase() === 'high';
  return hasImplementationLanguage || includePreferred;
}

function buildAgentSyntheticTask(request, agent, targetFiles) {
  const title = `${agent.agent} work order for ${safeText(request.requestedOutcome || request.userRequest || 'requested outcome', 120)}`;
  const description = compactText(
    agent.role,
    `target repo: ${safeText(request.targetRepo || 'kosame-dev-orchestra', 120)}`,
    `target version: ${normalizeVersion(request.targetVersion || '110.69')}`,
    `risk level: ${safeText(request.riskLevel || 'medium', 40)}`,
    `request: ${safeText(request.userRequest || request.requestedOutcome || '(no request)', 240)}`,
  );

  return {
    id: `${normalizeVersion(request.targetVersion || '110.69')}:${agent.key}:${Date.now()}`,
    title,
    description,
    difficulty: (request.riskLevel || '').toLowerCase() === 'high' ? 'high' : 'medium',
    file_scope: targetFiles,
    allowedFiles: targetFiles,
  };
}

function buildTopLevelBlockedReasons(risk, request = {}) {
  const reasons = [];
  if (risk.forbiddenRepo) reasons.push('targetRepo must be KOSAME Dev Orchestra only');
  if (risk.secretHits.length > 0) reasons.push('Secret/API key/.env/credentials must not be disclosed');
  if (risk.customer) reasons.push('customer data must not be disclosed');
  if (risk.salesDx) reasons.push('営業DX / transcriber is out of scope');
  if (risk.anestyBoard) reasons.push('ANESTY Board is out of scope');
  if (risk.ipCore) reasons.push('IP/core/full architecture must not be disclosed');
  if (risk.billingLead) reasons.push('billing / lead management must not be disclosed');
  if (risk.realApi) reasons.push('real API calls are not allowed');
  if (risk.realBilling) reasons.push('real billing is not allowed');
  if (risk.realDeploy) reasons.push('deploy is not allowed');
  if (risk.realIam) reasons.push('IAM mutation is not allowed');
  if (risk.highCostWithoutApproval) reasons.push('gpt-5.5 / high cost model requires explicit approval');
  if (isForbiddenAgent(request.requestedModel)) reasons.push('forbidden agent/model requested');
  return uniqueList(reasons);
}

function buildAgentWorkOrder(request, agent, context = {}, health = null, risk = null) {
  const effectiveRisk = risk || detectRiskSignals(request, context);
  const allowedFiles = pickTargetFiles(agent, request, context);
  const syntheticTask = buildAgentSyntheticTask(request, agent, allowedFiles);
  const pack = sanitizedTaskPackGenerator.buildSanitizedTaskPack(syntheticTask, {
    ...context,
    workerType: agent.modelId,
    requestedModel: agent.modelId,
    externalSanitized: agent.workerClass === 'sanitized_only',
    allowedFiles,
    specText: compactText(request.userRequest, request.requestedOutcome, request.forbiddenContext),
    targetRepo: request.targetRepo || context.targetRepo || 'kosame-dev-orchestra',
    approvalReceived: context.approvalReceived === true,
  });

  const budgetDecision = budgetRouter.recommendProviderBudgetBucket(syntheticTask, {
    ...context,
    requestedModel: agent.modelId,
    approvalReceived: context.approvalReceived === true,
    externalSanitized: agent.workerClass === 'sanitized_only',
    providerStates: context.providerStates || {},
    preferClaudeFinalAudit: agent.key === 'claude',
  });

  const healthItem = Array.isArray(health?.items)
    ? health.items.find(item => normalizeAgentKey(item.provider) === agent.key || normalizeAgentKey(item.providerKey) === agent.key || normalizeAgentKey(item.modelId) === agent.key)
    : null;
  let agentHealthItem = healthItem || null;
  if (agent.workerClass === 'sanitized_only' && (!agentHealthItem || agentHealthItem.status === 'blocked')) {
    try {
      const agentHealthSnapshot = providerHealthSnapshot.buildProviderAvailabilityHealthSnapshot(syntheticTask, {
        ...context,
        providerStates: context.providerStates || {},
        requestedModel: agent.modelId,
        approvalReceived: context.approvalReceived === true,
        externalSanitized: true,
        workerClass: 'sanitized_only',
      });
      agentHealthItem = Array.isArray(agentHealthSnapshot?.items)
        ? agentHealthSnapshot.items.find(item => normalizeAgentKey(item.provider) === agent.key || normalizeAgentKey(item.providerKey) === agent.key || normalizeAgentKey(item.modelId) === agent.key)
        : agentHealthItem;
    } catch (_) {
      agentHealthItem = healthItem || null;
    }
  }

  const forbiddenAgent = toAgentKeys(request.forbiddenAgents || []).includes(agent.key);
  const selectedModel = budgetDecision.selectedModel || agent.modelId;
  const modelTier = budgetDecision.modelTier || agent.workerClass;

  let status = STATUS.safe;
  const blockedReasons = [];
  const cautions = [];

  if (forbiddenAgent) {
    status = STATUS.blocked;
    blockedReasons.push(`agent ${agent.agent} is forbidden by request`);
  }
  if (agentHealthItem?.status === 'blocked') {
    status = status === STATUS.blocked ? STATUS.blocked : STATUS.blocked;
    blockedReasons.push(`${agent.providerLabel} is blocked`);
  }
  if (agentHealthItem?.status === 'human_gate') {
    status = STATUS.human_gate;
    blockedReasons.push(`${agent.providerLabel} requires human gate`);
  }
  if (agentHealthItem?.status === 'limited' || agentHealthItem?.status === 'unknown') {
    if (status === STATUS.safe) status = STATUS.caution;
    cautions.push(`${agent.providerLabel} is ${agentHealthItem.status}`);
  }
  if (budgetDecision.humanGateRequired) {
    status = STATUS.human_gate;
    blockedReasons.push(budgetDecision.humanGateReason || `${agent.agent} requires human approval`);
  }
  if (budgetDecision.blockedHighCost) {
    status = STATUS.human_gate;
    blockedReasons.push(budgetDecision.blockedHighCostReason || 'high cost model blocked');
  }
  if (agent.workerClass === 'sanitized_only' && pack.allowedWorkerClass !== 'sanitized_only') {
    status = STATUS.blocked;
    blockedReasons.push('DeepSeek/opencode must remain sanitized_only');
  }
  if (effectiveRisk.hasSensitive && agent.key === 'deepseek_opencode' && pack.humanGateRequired) {
    status = STATUS.human_gate;
  }

  const fallbackCandidates = uniqueList([
    ...(healthItem?.fallbackCandidates || []),
    ...(budgetDecision.providerBudgetCandidates || []).map(candidate => candidate.providerId || candidate.providerName || candidate.selectedModel || '').filter(Boolean),
    agent.key === 'gpt_codex' ? ['gpt-5.4-mini', 'gpt-5.4'] : [],
    agent.key === 'claude' ? ['gpt-5.4', 'gpt-5.4-mini'] : [],
    agent.key === 'gemini' ? ['gpt-5.4', 'gpt-5.4-mini'] : [],
    agent.key === 'grok' ? ['gpt-5.4', 'claude-sonnet-4-6'] : [],
    agent.key === 'deepseek_opencode' ? ['gpt-5.4-mini', 'gpt-5.4'] : [],
  ]);

  const nextAllowedAction = status === STATUS.safe
    ? 'dispatch_work_order'
    : status === STATUS.caution
      ? 'dispatch_with_fallback_candidates'
      : status === STATUS.human_gate
        ? 'request_human_approval'
        : 'regenerate_or_reduce_scope';

  const selectedPack = {
    taskId: pack.taskId,
    workerType: pack.workerType,
    allowedWorkerClass: pack.allowedWorkerClass,
    taskTitle: pack.taskTitle,
    taskSummary: pack.taskSummary,
    allowedFiles: pack.allowedFiles,
    allowedScope: pack.allowedScope,
    forbiddenScope: pack.forbiddenScope,
    redactionApplied: pack.redactionApplied,
    ipProtectionApplied: pack.ipProtectionApplied,
    customerDataRemoved: pack.customerDataRemoved,
    secretRemoved: pack.secretRemoved,
    expectedOutputFormat: pack.expectedOutputFormat,
    verifyCommands: pack.verifyCommands,
    humanGateRequired: pack.humanGateRequired,
    humanGateReason: pack.humanGateReason,
    safetyNotes: pack.safetyNotes,
  };

  return {
    agentKey: agent.key,
    agent: agent.agent,
    role: agent.role,
    provider: agent.providerLabel,
    providerKey: agent.providerKey,
    workerClass: agent.workerClass,
    modelId: selectedModel,
    modelTier,
    providerBudgetBucket: budgetDecision.providerBudgetBucket || null,
    providerBudgetBucketReason: budgetDecision.providerBudgetBucketReason || null,
    providerBudgetBucketPath: budgetDecision.providerBudgetBucketPath || [],
    providerBudgetCandidates: budgetDecision.providerBudgetCandidates || [],
    providerBudgetEscalationReason: budgetDecision.escalationReason || null,
    providerBudgetHumanGateRequired: budgetDecision.humanGateRequired || false,
    providerBudgetHumanGateReason: budgetDecision.humanGateReason || null,
    providerBudgetBlockedHighCost: budgetDecision.blockedHighCost || false,
    providerBudgetBlockedHighCostReason: budgetDecision.blockedHighCostReason || null,
    providerHealthStatus: agentHealthItem?.status || 'unknown',
    providerHealthItem: agentHealthItem || null,
    status,
    blockedReasons: uniqueList(blockedReasons),
    cautions: uniqueList(cautions),
    nextAllowedAction,
    humanApprovalRequired: status === STATUS.human_gate,
    preferred: toAgentKeys(request.preferredAgents || []).includes(agent.key),
    forbidden: forbiddenAgent,
    selectedTaskType: pack.taskSummary ? workerScorecard.classifyTaskType(syntheticTask, context) : workerScorecard.classifyTaskType(syntheticTask, context),
    version: normalizeVersion(request.targetVersion || '110.69'),
    packageVersion: normalizePackageVersion(request.targetVersion || '110.69'),
    targetRepo: request.targetRepo || 'kosame-dev-orchestra',
    targetFiles: allowedFiles,
    expectedSmoke: uniqueList(agent.expectedSmoke),
    allowedScope: pack.allowedScope,
    forbiddenScope: pack.forbiddenScope,
    sanitizedTaskPack: selectedPack,
    approvalRequired: budgetDecision.approvalRequired || false,
    approvalReceived: context.approvalReceived === true,
    costEstimateBand: budgetDecision.costEstimateBand || null,
    estimatedRisk: budgetDecision.estimatedRisk || null,
    selectedCandidate: budgetDecision.selectedCandidate || null,
    selectionReason: pack.humanGateRequired ? pack.humanGateReason : pack.taskSummary,
    fallbackCandidates,
    recommendedUse: workerScorecard.getWorkerScorecard(agent.modelId).recommendedUse,
  };
}

function buildAgentWorkOrderAutoSplit(requestInput, context = {}) {
  const request = typeof requestInput === 'string'
    ? { userRequest: requestInput }
    : (requestInput || {});

  const targetRepo = request.targetRepo || context.targetRepo || 'kosame-dev-orchestra';
  const targetVersion = normalizeVersion(request.targetVersion || context.targetVersion || '110.69');
  const packageVersion = normalizePackageVersion(targetVersion);
  const taskTitle = safeText(request.userRequest || request.requestedOutcome || request.taskTitle || 'agent work order split', 180);
  const requestedOutcome = safeText(request.requestedOutcome || request.userRequest || request.taskSummary || taskTitle, 320);
  const riskLevel = String(request.riskLevel || context.riskLevel || 'medium').toLowerCase();
  const preferredAgents = toAgentKeys(request.preferredAgents || context.preferredAgents || []);
  const forbiddenAgents = new Set(toAgentKeys(request.forbiddenAgents || context.forbiddenAgents || []));

  const risk = detectRiskSignals(request, context);
  const requestText = compactText(request.userRequest, request.requestedOutcome, request.forbiddenContext, targetRepo, targetVersion, riskLevel);
  const health = context.providerAvailabilityHealthSnapshot
    || providerHealthSnapshot.buildProviderAvailabilityHealthSnapshot(
      {
        title: taskTitle,
        description: requestedOutcome,
        project: normalizeRepoName(targetRepo),
      },
      {
        ...context,
        providerStates: context.providerStates || request.providerStates || {},
        requestedModel: request.requestedModel || context.requestedModel || null,
        approvalReceived: context.approvalReceived === true || request.approvalReceived === true,
        externalSanitized: context.externalSanitized === true || request.externalSanitized === true,
      },
    );

  const selectedAgents = AGENT_ORDER.filter(agentKey => {
    const agent = AGENTS[agentKey];
    if (!agent) return false;
    if (forbiddenAgents.has(agentKey)) return false;
    return agent.includeByDefault || shouldIncludeAgent(agent, request, risk);
  });

  if (selectedAgents.length === 0 && !risk.forbiddenRepo) {
    selectedAgents.push('gpt_codex');
  }

  const workOrders = selectedAgents.map(agentKey => buildAgentWorkOrder(
    { ...request, targetRepo, targetVersion, userRequest: request.userRequest || request.requestedOutcome, requestedOutcome },
    AGENTS[agentKey],
    context,
    health,
    risk,
  ));

  const blockedReasons = uniqueList([
    ...buildTopLevelBlockedReasons(risk, request),
    ...(selectedAgents.length === 0 ? ['no safe agent selected'] : []),
  ]);

  const cautions = uniqueList([
    ...(health?.providerHealth?.hasLimited ? ['provider health reports limited providers'] : []),
    ...(health?.providerHealth?.recommendedFallback ? [`provider health fallback: ${health.providerHealth.recommendedFallback}`] : []),
    ...(workOrders.some(w => w.status === STATUS.caution) ? ['one or more work orders need fallback consideration'] : []),
  ]);

  let status = STATUS.safe;
  if (risk.forbiddenRepo || blockedReasons.some(reason => /forbidden agent|no safe agent selected/.test(reason))) {
    status = STATUS.blocked;
  } else if (blockedReasons.some(reason => /Secret|customer|営業DX|ANESTY|IP\/core|billing|lead management|gpt-5\.5|high cost model|real API|deploy|IAM/i.test(reason))) {
    status = STATUS.human_gate;
  } else if (workOrders.some(w => w.status === STATUS.human_gate)) {
    status = STATUS.human_gate;
  } else if (workOrders.some(w => w.status === STATUS.blocked)) {
    status = STATUS.blocked;
  } else if (workOrders.some(w => w.status === STATUS.caution) || health?.providerHealth?.hasLimited) {
    status = STATUS.caution;
  }

  const humanApprovalRequired = status === STATUS.human_gate || workOrders.some(w => w.humanApprovalRequired || w.providerBudgetHumanGateRequired || w.providerBudgetBlockedHighCost);

  const workOrderSummaries = workOrders.map(w => ({
    agentKey: w.agentKey,
    agent: w.agent,
    status: w.status,
    modelId: w.modelId,
    budgetBucket: w.providerBudgetBucket,
    providerHealthStatus: w.providerHealthStatus,
    targetFiles: w.targetFiles,
    expectedSmoke: w.expectedSmoke,
    version: w.version,
    nextAllowedAction: w.nextAllowedAction,
  }));

  const topDecision = workOrders[0] || {
    agent: 'GPT / Codex',
    modelId: 'gpt-5.4-mini',
    status,
    providerBudgetBucket: 'ultra_low_cost',
  };

  const routerExplanation = explainability.buildRouterExplanation(
    {
      title: taskTitle,
      description: requestedOutcome,
    },
    {
      selectedWorker: topDecision.agent,
      selectedModel: topDecision.modelId,
      modelTier: topDecision.workerClass || topDecision.modelTier || null,
      taskType: workerScorecard.classifyTaskType({
        title: taskTitle,
        description: requestedOutcome,
      }, context),
      reason: compactText(
        `selected ${topDecision.agent}`,
        status === STATUS.caution ? 'caution route' : '',
        status === STATUS.human_gate ? 'human gate route' : '',
        status === STATUS.blocked ? 'blocked route' : '',
      ),
      providerBudgetBucketDecision: topDecision.providerBudgetBucket ? {
        providerBudgetBucket: topDecision.providerBudgetBucket,
        selectedModel: topDecision.modelId,
        modelTier: topDecision.modelTier || topDecision.workerClass,
        humanGateRequired: topDecision.humanApprovalRequired || false,
      } : null,
      providerHealth: health?.providerHealth || null,
      workOrderAutoSplitter: {
        status,
        workOrders: workOrderSummaries,
      },
    },
    {
      requestedModel: request.requestedModel || null,
      approvalReceived: context.approvalReceived === true || request.approvalReceived === true,
      providerHealth: health?.providerHealth || null,
      workOrderAutoSplitter: {
        status,
        workOrders: workOrderSummaries,
      },
    },
  );

  const summaryForDashboard = {
    status,
    version: packageVersion,
    targetVersion,
    targetRepo: normalizeRepoName(targetRepo) || targetRepo,
    requestedOutcome,
    riskLevel,
    workOrderCount: workOrders.length,
    safeWorkOrders: workOrders.filter(w => w.status === STATUS.safe).length,
    cautionWorkOrders: workOrders.filter(w => w.status === STATUS.caution).length,
    blockedWorkOrders: workOrders.filter(w => w.status === STATUS.blocked).length,
    humanGateWorkOrders: workOrders.filter(w => w.status === STATUS.human_gate).length,
    providerHealth: health?.providerHealth || null,
    releaseReadinessSummary: compactText(
      `v110.68 board compatible: targetVersion=${targetVersion}`,
      `workOrders=${workOrders.length}`,
      `status=${status}`,
      humanApprovalRequired ? 'human approval may be required' : '',
    ),
    items: workOrderSummaries,
    nextAllowedAction: status === STATUS.safe
      ? 'dispatch_split_work_orders'
      : status === STATUS.caution
        ? 'dispatch_with_fallback_candidates'
        : status === STATUS.human_gate
          ? 'request_human_approval'
          : 'regenerate_safe_request',
  };

  const result = {
    version: packageVersion,
    timestamp: new Date().toISOString(),
    dryRun: true,
    userRequest: safeText(request.userRequest || request.requestedOutcome || ''),
    requestedOutcome: safeText(requestedOutcome || ''),
    targetRepo: normalizeRepoName(targetRepo) || safeText(targetRepo || ''),
    targetVersion,
    packageVersion,
    riskLevel,
    status,
    workOrders,
    blockedReasons,
    cautions,
    nextAllowedAction: summaryForDashboard.nextAllowedAction,
    humanApprovalRequired,
    providerAvailabilityHealthSnapshot: health,
    providerHealth: health?.providerHealth || null,
    routerExplanation,
    summaryForDashboard,
    finalReleaseReadinessSummary: summaryForDashboard.releaseReadinessSummary,
  };

  return result;
}

module.exports = {
  TOOL_META,
  STATUS,
  AGENTS,
  AGENT_ORDER,
  FORBIDDEN_SCOPE,
  normalizeText,
  normalizeRepoName,
  normalizeVersion,
  normalizePackageVersion,
  detectRiskSignals,
  filteredFiles,
  pickTargetFiles,
  shouldIncludeAgent,
  buildAgentSyntheticTask,
  buildAgentWorkOrder,
  buildAgentWorkOrderAutoSplit,
};

if (require.main === module) {
  const demo = buildAgentWorkOrderAutoSplit({
    userRequest: 'One-line request: update a docs section and add a smoke test',
    requestedOutcome: 'Split a small safe docs + smoke task',
    targetRepo: 'kosame-dev-orchestra',
    targetVersion: '110.69',
    riskLevel: 'low',
    allowedFiles: ['docs/guide.md', 'smoke/v110-69-agent-work-order-auto-splitter-smoke.js'],
  });
  console.log(JSON.stringify({
    status: demo.status,
    workOrders: demo.workOrders.map(w => ({ agent: w.agent, status: w.status, modelId: w.modelId })),
  }, null, 2));
}
