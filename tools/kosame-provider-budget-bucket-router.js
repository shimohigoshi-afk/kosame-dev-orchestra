#!/usr/bin/env node
'use strict';

/**
 * KOSAME Provider Budget Bucket Router v110.62.0
 *
 * Free tier / ultra low cost / mid cost / high cost human approval の
 * 軽量バケツ判定レイヤー。
 * 実API呼び出しは行わず、dryRun / mock / fixture 前提で
 * provider 選定と escalation 理由を記録する。
 */

const workerScorecard = require('./kosame-worker-scorecard');
const availabilityFallbackMatrix = require('./kosame-availability-fallback-matrix');

const TOOL_META = {
  version: '110.62.0',
  feature: 'v110-62-provider-budget-bucket-router',
  slug: 'kosame-provider-budget-bucket-router',
};

const HUMAN_GATE = 'HUMAN_GATE_REQUIRED';

const BUDGET_BUCKETS = {
  free_tier: {
    name: 'free_tier',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
  },
  ultra_low_cost: {
    name: 'ultra_low_cost',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
  },
  mid_cost: {
    name: 'mid_cost',
    costEstimateBand: 'medium',
    estimatedRisk: 'medium',
  },
  high_cost_human_approval: {
    name: 'high_cost_human_approval',
    costEstimateBand: 'high',
    estimatedRisk: 'high',
  },
};

const BUCKET_ORDER = [
  'free_tier',
  'ultra_low_cost',
  'mid_cost',
  'high_cost_human_approval',
];

const PROVIDER_CATALOG = {
  'fixture-mock': {
    providerId: 'fixture-mock',
    providerName: 'Fixture/mock provider',
    providerFamily: 'fixture',
    budgetBucket: 'free_tier',
    modelTier: 'free_tier',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    sanitizedOnly: true,
    recommendedUse: 'DryRun / mock / fixture only',
    bestTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskTypes: ['security', 'ip_core', 'final_review', 'breakthrough_review'],
    scorecardKey: null,
  },
  'gemini-2.5-flash-lite': {
    providerId: 'gemini-2.5-flash-lite',
    providerName: 'Gemini free-tier cautious worker',
    providerFamily: 'gemini',
    budgetBucket: 'free_tier',
    modelTier: 'standard',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Free/low cost cautious review for Google/IAM/Cloud Run.',
    bestTaskTypes: ['google_iam_caution', 'cloud_run_caution', 'gcp_review', 'routine_docs'],
    blockedTaskTypes: ['gpt-5.5_only', 'mandatory_governance'],
    scorecardKey: 'gemini',
  },
  'gpt-5.4-mini': {
    providerId: 'gpt-5.4-mini',
    providerName: 'GPT-mini cheap worker',
    providerFamily: 'openai',
    budgetBucket: 'ultra_low_cost',
    modelTier: 'cheap',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Default cheap-first model for routine/docs/smoke/UI/light code.',
    bestTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskTypes: ['security', 'ip_core', 'breakthrough_review'],
    scorecardKey: 'gpt-5.4-mini',
  },
  'deepseek-chat': {
    providerId: 'deepseek-chat',
    providerName: 'DeepSeek/opencode sanitized worker',
    providerFamily: 'deepseek',
    budgetBucket: 'ultra_low_cost',
    modelTier: 'external_sanitized',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    sanitizedOnly: true,
    recommendedUse: 'External sanitized-only work.',
    bestTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskTypes: ['security', 'ip_core', 'customer_data', 'secret'],
    scorecardKey: 'deepseek-chat',
  },
  'gpt-5.4': {
    providerId: 'gpt-5.4',
    providerName: 'GPT standard worker',
    providerFamily: 'openai',
    budgetBucket: 'mid_cost',
    modelTier: 'standard',
    costEstimateBand: 'medium',
    estimatedRisk: 'medium',
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Standard implementation fallback.',
    bestTaskTypes: ['implementation', 'routine_light_code', 'security', 'ip_core'],
    blockedTaskTypes: ['gpt-5.5_only'],
    scorecardKey: 'gpt-5.4',
  },
  grok: {
    providerId: 'grok',
    providerName: 'Grok review/breakthrough worker',
    providerFamily: 'grok',
    budgetBucket: 'mid_cost',
    modelTier: 'standard',
    costEstimateBand: 'medium',
    estimatedRisk: 'medium',
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Review / breakthrough work, not default governance.',
    bestTaskTypes: ['breakthrough_review', 'exploration', 'review'],
    blockedTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'mandatory_governance'],
    scorecardKey: 'grok',
  },
  'claude-sonnet-4-6': {
    providerId: 'claude-sonnet-4-6',
    providerName: 'Claude final quality review worker',
    providerFamily: 'anthropic',
    budgetBucket: 'high_cost_human_approval',
    modelTier: 'standard',
    costEstimateBand: 'high',
    estimatedRisk: 'high',
    approvalRequired: true,
    sanitizedOnly: false,
    recommendedUse: 'Optional final audit; not a mandatory delivery gate.',
    bestTaskTypes: ['final_review', 'quality_review', 'release_review'],
    blockedTaskTypes: ['mandatory_gate', 'routine_docs'],
    scorecardKey: 'claude',
  },
  'gpt-5.5': {
    providerId: 'gpt-5.5',
    providerName: 'GPT expensive worker',
    providerFamily: 'openai',
    budgetBucket: 'high_cost_human_approval',
    modelTier: 'expensive',
    costEstimateBand: 'high',
    estimatedRisk: 'high',
    approvalRequired: true,
    sanitizedOnly: false,
    recommendedUse: 'Explicit human approval only; never auto-select.',
    bestTaskTypes: ['security', 'ip_core', 'breakthrough_review', 'final_review'],
    blockedTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    scorecardKey: 'gpt-5.5',
  },
};

const TASK_BUCKET_PRESETS = {
  routine_docs: 'ultra_low_cost',
  routine_smoke: 'ultra_low_cost',
  routine_ui: 'ultra_low_cost',
  routine_light_code: 'ultra_low_cost',
  implementation: 'mid_cost',
  security: 'mid_cost',
  ip_core: 'mid_cost',
  google_iam_caution: 'free_tier',
  cloud_run_caution: 'free_tier',
  gcp_review: 'free_tier',
  review: 'mid_cost',
  breakthrough_review: 'mid_cost',
  final_review: 'mid_cost',
  quality_review: 'mid_cost',
  release_review: 'mid_cost',
  unknown: 'ultra_low_cost',
};

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : [values])
    .flatMap(item => (item == null ? [] : [String(item).trim()]))
    .filter(Boolean))];
}

function resolveTaskType(task, context = {}) {
  const classified = workerScorecard.classifyTaskType(task, context);
  if (task?.isSalesDx || task?.isConfidential) return 'security';
  if (task?.hasProdImpact && classified === 'unknown') return 'implementation';
  return classified || 'unknown';
}

function bucketIndex(bucket) {
  return BUCKET_ORDER.indexOf(bucket);
}

function nextBucket(bucket) {
  const idx = bucketIndex(bucket);
  if (idx < 0 || idx >= BUCKET_ORDER.length - 1) return null;
  return BUCKET_ORDER[idx + 1];
}

function normalizeProviderId(providerId) {
  return String(providerId || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function getProviderEntry(providerId) {
  const key = normalizeProviderId(providerId);
  const entry = PROVIDER_CATALOG[key] || PROVIDER_CATALOG['gpt-5.4-mini'];
  const scorecard = entry.scorecardKey ? workerScorecard.getWorkerScorecard(entry.scorecardKey) : null;
  return {
    ...entry,
    providerId: entry.providerId,
    scorecard,
    bestTaskTypes: scorecard ? [...scorecard.bestTaskTypes] : [...entry.bestTaskTypes],
    blockedTaskTypes: scorecard ? [...scorecard.blockedTaskTypes] : [...entry.blockedTaskTypes],
    costRisk: scorecard ? scorecard.costRisk : entry.estimatedRisk,
    reliabilityScore: scorecard ? scorecard.reliabilityScore : 100,
    safetyScore: scorecard ? scorecard.safetyScore : 100,
    speedScore: scorecard ? scorecard.speedScore : 100,
    qualityScore: scorecard ? scorecard.qualityScore : 100,
    scorecardApprovalRequired: scorecard ? scorecard.approvalRequired : entry.approvalRequired,
    recommendedUse: scorecard ? scorecard.recommendedUse : entry.recommendedUse,
  };
}

function getProviderBudgetBucket(providerId) {
  return getProviderEntry(providerId).budgetBucket;
}

function getProviderCatalog() {
  return Object.values(PROVIDER_CATALOG).map(entry => getProviderEntry(entry.providerId));
}

function candidateProvidersForBucket(bucket, taskType, context = {}) {
  if (bucket === 'free_tier') {
    if (context.useFixtureProvider === true || context.mockProvider === true) {
      return ['fixture-mock', 'gemini-2.5-flash-lite'];
    }
    return ['gemini-2.5-flash-lite'];
  }

  if (bucket === 'ultra_low_cost') {
    if (context.externalSanitized === true || String(context.workerClass || '').toLowerCase() === 'sanitized_only') {
      return ['deepseek-chat', 'gpt-5.4-mini'];
    }
    return ['gpt-5.4-mini', 'deepseek-chat'];
  }

  if (bucket === 'mid_cost') {
    if (taskType === 'breakthrough_review') return ['grok', 'gpt-5.4'];
    if (taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review') {
      return [
        context.preferClaudeFinalAudit === true ? 'claude-sonnet-4-6' : 'gpt-5.4',
        'gpt-5.4',
        'grok',
      ];
    }
    return ['gpt-5.4', 'grok'];
  }

  if (bucket === 'high_cost_human_approval') {
    return ['claude-sonnet-4-6', 'gpt-5.5'];
  }

  return ['gpt-5.4-mini'];
}

function providerStateFor(providerId, context = {}) {
  const states = context.providerStates || {};
  const id = normalizeProviderId(providerId);
  return states[id]
    || context.providerState
    || context.workerState
    || availabilityFallbackMatrix.WORKER_STATES.healthy;
}

function providerStateReason(state) {
  switch (state) {
    case availabilityFallbackMatrix.WORKER_STATES.rate_limited:
      return 'rate limited';
    case availabilityFallbackMatrix.WORKER_STATES.unavailable:
      return 'unavailable';
    case availabilityFallbackMatrix.WORKER_STATES.unsafe_for_task:
      return 'unsafe for task';
    case availabilityFallbackMatrix.WORKER_STATES.over_budget:
      return 'over budget';
    case availabilityFallbackMatrix.WORKER_STATES.human_gate_required:
      return 'human gate required';
    default:
      return 'healthy';
  }
}

function providerAllowedByPolicy(providerId, taskType, context = {}) {
  const normalized = normalizeProviderId(providerId);
  const entry = getProviderEntry(normalized);
  const approvalReceived = context.approvalReceived === true;
  const externalSanitized = context.externalSanitized === true || String(context.workerClass || '').toLowerCase() === 'sanitized_only';

  if (normalized === 'gpt-5.5' && !approvalReceived) {
    return {
      allowed: false,
      blockedHighCost: true,
      blockedHighCostReason: 'gpt-5.5 requires explicit human approval and is never auto-selected',
      humanGateRequired: false,
      humanGateReason: 'gpt-5.5 blocked until explicit approval',
    };
  }

  if (
    normalized === 'claude-sonnet-4-6'
    && !approvalReceived
    && context.allowClaudeFinalAudit !== true
    && context.preferClaudeFinalAudit !== true
    && taskType !== 'final_review'
    && taskType !== 'quality_review'
    && taskType !== 'release_review'
  ) {
    return {
      allowed: false,
      blockedHighCost: false,
      blockedHighCostReason: 'Claude final audit is optional and not a mandatory gate',
      humanGateRequired: false,
      humanGateReason: 'Claude is optional final review, not a mandatory gate',
    };
  }

  if (entry.sanitizedOnly && !externalSanitized && normalized === 'deepseek-chat') {
    return {
      allowed: false,
      blockedHighCost: false,
      blockedHighCostReason: 'DeepSeek/opencode is sanitized_only',
      humanGateRequired: true,
      humanGateReason: 'DeepSeek/opencode requires sanitized_only task pack',
    };
  }

  if (entry.scorecard && entry.scorecard.blockedTaskTypes.includes(taskType)) {
    return {
      allowed: false,
      blockedHighCost: false,
      blockedHighCostReason: `${normalized} is blocked for ${taskType}`,
      humanGateRequired: false,
      humanGateReason: `${normalized} is blocked for ${taskType}`,
    };
  }

  return {
    allowed: true,
    blockedHighCost: false,
    blockedHighCostReason: '',
    humanGateRequired: false,
    humanGateReason: '',
  };
}

function flattenCandidateBuckets(startBucket, requestedBucket) {
  if (startBucket === 'high_cost_human_approval') {
    const buckets = [
      'high_cost_human_approval',
      'mid_cost',
      'ultra_low_cost',
      'free_tier',
    ];
    if (requestedBucket && !buckets.includes(requestedBucket)) {
      buckets.unshift(requestedBucket);
    }
    return uniqueList(buckets);
  }

  const buckets = [];
  let current = startBucket;
  while (current) {
    buckets.push(current);
    current = nextBucket(current);
  }
  if (requestedBucket && !buckets.includes(requestedBucket)) {
    buckets.push(requestedBucket);
  }
  return uniqueList(buckets);
}

function pickStartBucket(taskType, context = {}) {
  const requestedModel = normalizeProviderId(context.requestedModel || context.selectedModel || '');
  const requestedBucket = requestedModel ? getProviderBudgetBucket(requestedModel) : null;
  const approvalReceived = context.approvalReceived === true;

  if (requestedBucket === 'high_cost_human_approval' && approvalReceived) {
    return 'high_cost_human_approval';
  }

  if (taskType === 'google_iam_caution' || taskType === 'cloud_run_caution' || taskType === 'gcp_review') {
    return 'free_tier';
  }

  if (taskType === 'routine_docs' || taskType === 'routine_smoke' || taskType === 'routine_ui' || taskType === 'routine_light_code') {
    return 'ultra_low_cost';
  }

  if (context.externalSanitized === true || String(context.workerClass || '').toLowerCase() === 'sanitized_only') {
    return 'ultra_low_cost';
  }

  if (taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review') {
    return context.preferClaudeFinalAudit === true && approvalReceived
      ? 'high_cost_human_approval'
      : 'mid_cost';
  }

  if (taskType === 'implementation' || taskType === 'security' || taskType === 'ip_core' || taskType === 'breakthrough_review' || taskType === 'review') {
    return 'mid_cost';
  }

  return 'ultra_low_cost';
}

function buildCandidateRecords(providerIds, taskType, context = {}) {
  return providerIds.map(providerId => {
    const entry = getProviderEntry(providerId);
    const state = providerStateFor(providerId, context);
    const policy = providerAllowedByPolicy(providerId, taskType, context);
    return {
      providerId: entry.providerId,
      providerName: entry.providerName,
      providerFamily: entry.providerFamily,
      budgetBucket: entry.budgetBucket,
      modelTier: entry.modelTier,
      costEstimateBand: entry.costEstimateBand,
      estimatedRisk: entry.estimatedRisk,
      approvalRequired: entry.approvalRequired,
      sanitizedOnly: entry.sanitizedOnly,
      recommendedUse: entry.recommendedUse,
      state,
      stateReason: providerStateReason(state),
      allowed: policy.allowed,
      blockedHighCost: policy.blockedHighCost,
      blockedHighCostReason: policy.blockedHighCostReason,
      humanGateRequired: policy.humanGateRequired,
      humanGateReason: policy.humanGateReason,
      scorecard: entry.scorecard || null,
    };
  });
}

function selectHealthyCandidate(candidateRecords) {
  return candidateRecords.find(candidate => candidate.allowed && candidate.state === availabilityFallbackMatrix.WORKER_STATES.healthy) || null;
}

function buildProviderBudgetBucketDecision(task, context = {}) {
  const taskType = resolveTaskType(task, context);
  const requestedModel = normalizeProviderId(context.requestedModel || context.selectedModel || '');
  const requestedBucket = requestedModel ? getProviderBudgetBucket(requestedModel) : null;
  const approvalReceived = context.approvalReceived === true;
  const startBucket = pickStartBucket(taskType, context);
  const bucketPath = flattenCandidateBuckets(startBucket, requestedBucket);
  const candidateProviderIds = uniqueList(
    bucketPath.flatMap(bucket => candidateProvidersForBucket(bucket, taskType, context)),
  );
  const candidateRecords = buildCandidateRecords(candidateProviderIds, taskType, context);
  const selectedCandidate = selectHealthyCandidate(candidateRecords) || candidateRecords[0] || null;
  const selectedProviderId = selectedCandidate?.providerId || null;
  const selectedBucket = selectedCandidate?.budgetBucket || startBucket;
  const selectedScorecard = selectedProviderId ? workerScorecard.getWorkerScorecard(selectedProviderId) : null;
  const selectedModel = selectedProviderId || selectedScorecard?.modelId || null;
  const selectedProviderFamily = selectedCandidate?.providerFamily || null;
  const selectedProviderName = selectedCandidate?.providerName || null;
  const selectedProviderState = selectedCandidate?.state || availabilityFallbackMatrix.WORKER_STATES.human_gate_required;
  const blockedHighCost = requestedBucket === 'high_cost_human_approval'
    && !approvalReceived
    && selectedBucket !== 'high_cost_human_approval';

  const availabilityFallback = selectedProviderId
    ? availabilityFallbackMatrix.recommendAvailabilityFallback(
        task,
        selectedProviderId,
        selectedProviderState,
        {
          ...context,
          approvalReceived,
        },
      )
    : null;

  const bucketReason = selectedBucket === 'free_tier'
    ? 'Google/IAM/Cloud Run caution routes stay on free_tier first.'
    : selectedBucket === 'ultra_low_cost'
      ? 'Routine/docs/smoke/UI/light code stays cheap-first on ultra_low_cost.'
      : selectedBucket === 'mid_cost'
        ? 'Normal implementation and review work stays mid_cost before escalation.'
        : 'High-cost human-approval bucket is available only with explicit approval.';

  const blockedHighCostReason = blockedHighCost
    ? 'gpt-5.5 / high-cost providers are blocked until explicit human approval'
    : (selectedBucket === 'high_cost_human_approval' ? 'high-cost bucket selected with approval' : '');

  const fallbackReason = availabilityFallback?.reason
    || (candidateRecords.length > 1
      ? `same bucket fallback through ${candidateRecords[0]?.providerId || 'primary'} to ${selectedProviderId || 'human gate'}`
      : 'no fallback needed');

  const humanGateRequired = !!(
    !selectedCandidate
    || selectedCandidate?.humanGateRequired
    || selectedCandidate?.state === availabilityFallbackMatrix.WORKER_STATES.human_gate_required
    || (!selectedCandidate && bucketPath.length === 0)
    || (selectedCandidate?.blockedHighCost === true && !approvalReceived)
  );

  const humanGateReason = humanGateRequired
    ? compactText(
        selectedCandidate?.humanGateReason,
        blockedHighCostReason,
        selectedCandidate?.stateReason && selectedCandidate.stateReason !== 'healthy' ? `state=${selectedCandidate.stateReason}` : '',
      )
    : 'human gate not required';

  const escalationReason = compactText(
    blockedHighCostReason,
    selectedCandidate?.stateReason && selectedCandidate.stateReason !== 'healthy'
      ? `${selectedCandidate.providerId} ${selectedCandidate.stateReason}`
      : '',
    selectedBucket !== startBucket ? `bucket escalated from ${startBucket} to ${selectedBucket}` : '',
  );

  const budgetBucketPath = uniqueList([
    ...bucketPath,
    ...(humanGateRequired ? [HUMAN_GATE] : []),
  ]);

  const costEstimateBand = BUDGET_BUCKETS[selectedBucket]?.costEstimateBand || 'unknown';
  const estimatedRisk = BUDGET_BUCKETS[selectedBucket]?.estimatedRisk || 'unknown';

  const safetyNotes = uniqueList([
    bucketReason,
    blockedHighCostReason,
    fallbackReason,
    humanGateReason,
    selectedProviderId === 'deepseek-chat' ? 'DeepSeek/opencode remains sanitized_only.' : '',
    selectedProviderId === 'gpt-5.5' ? 'gpt-5.5 is explicit-approval only.' : '',
    selectedProviderId === 'claude-sonnet-4-6' ? 'Claude is optional final review, not a mandatory delivery gate.' : '',
    selectedProviderId === 'gemini-2.5-flash-lite' ? 'Gemini is preferred for Google/IAM/Cloud Run caution review.' : '',
  ]);

  const recommendedNextAction = humanGateRequired
    ? 'request_human_approval'
    : selectedBucket === 'free_tier'
      ? 'use_free_tier_provider'
      : selectedBucket === 'ultra_low_cost'
        ? 'use_ultra_low_cost_provider'
        : selectedBucket === 'mid_cost'
          ? 'use_mid_cost_provider'
          : 'use_high_cost_human_approval_provider';

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    taskTitle: String(task?.title || ''),
    taskType,
    requestedModel: requestedModel || null,
    requestedBucket: requestedBucket || null,
    providerBudgetBucket: selectedBucket,
    providerBudgetBucketReason: bucketReason,
    providerBudgetBucketPath: budgetBucketPath,
    providerBudgetCandidates: candidateRecords.map(candidate => ({
      providerId: candidate.providerId,
      providerName: candidate.providerName,
      budgetBucket: candidate.budgetBucket,
      state: candidate.state,
      allowed: candidate.allowed,
      blockedHighCost: candidate.blockedHighCost,
      humanGateRequired: candidate.humanGateRequired,
      recommendedUse: candidate.recommendedUse,
    })),
    selectedProvider: selectedProviderId,
    selectedProviderName,
    selectedProviderFamily,
    selectedModel: selectedModel,
    selectedBucket: selectedBucket,
    modelTier: selectedScorecard?.modelTier || selectedCandidate?.modelTier || null,
    approvalRequired: selectedCandidate?.approvalRequired === true || selectedBucket === 'high_cost_human_approval' || blockedHighCost,
    approvalReceived,
    humanGateRequired,
    humanGateReason,
    blockedHighCost,
    blockedHighCostReason,
    fallbackReason,
    escalationReason,
    availabilityFallback,
    costEstimateBand,
    estimatedRisk,
    recommendedNextAction,
    safetyNotes,
    providerScorecard: selectedScorecard,
    selectedCandidate,
    bucketPath,
  };
}

function recommendProviderBudgetBucket(task, context = {}) {
  return buildProviderBudgetBucketDecision(task, context);
}

function buildProviderBudgetBucketRecord(task, context = {}) {
  return buildProviderBudgetBucketDecision(task, context);
}

module.exports = {
  TOOL_META,
  HUMAN_GATE,
  BUDGET_BUCKETS,
  BUCKET_ORDER,
  PROVIDER_CATALOG,
  TASK_BUCKET_PRESETS,
  normalizeText,
  normalizeProviderId,
  resolveTaskType,
  bucketIndex,
  nextBucket,
  getProviderEntry,
  getProviderBudgetBucket,
  getProviderCatalog,
  candidateProvidersForBucket,
  providerStateFor,
  providerAllowedByPolicy,
  buildCandidateRecords,
  buildProviderBudgetBucketDecision,
  recommendProviderBudgetBucket,
  buildProviderBudgetBucketRecord,
};
