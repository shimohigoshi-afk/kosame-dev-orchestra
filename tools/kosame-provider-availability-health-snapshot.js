#!/usr/bin/env node
'use strict';

/**
 * KOSAME Provider Availability Health Snapshot v110.66.0
 *
 * GPT / Codex / Gemini / Claude / Grok / DeepSeek / opencode の
 * 現在の利用可能状態を dryRun / mock / fixture で一覧化する。
 * 実API呼び出し、実課金、Secret 読み取り、deploy、IAM 変更はしない。
 */

const scorecard = require('./kosame-worker-scorecard');
const budgetRouter = require('./kosame-provider-budget-bucket-router');
const availabilityFallbackMatrix = require('./kosame-availability-fallback-matrix');
const securityPolicy = require('./kosame-worker-security-policy');
const ipGate = require('./kosame-ip-protection-gate');

const TOOL_META = {
  version: '110.66.0',
  feature: 'v110-66-provider-availability-health-snapshot',
  slug: 'kosame-provider-availability-health-snapshot',
};

const STATES = {
  available: 'available',
  limited: 'limited',
  blocked: 'blocked',
  unknown: 'unknown',
  human_gate: 'human_gate',
};

const PROVIDER_KEYS = {
  gpt_codex: 'gpt_codex',
  gemini: 'gemini',
  claude: 'claude',
  grok: 'grok',
  deepseek_opencode: 'deepseek_opencode',
};

const PROVIDER_PROFILES = [
  {
    key: PROVIDER_KEYS.gpt_codex,
    provider: 'GPT / Codex',
    role: '司令塔・検収・統治',
    family: 'openai',
    modelIds: ['gpt-5.4-mini', 'gpt-5.4', 'gpt-5.5'],
    defaultModelId: 'gpt-5.4-mini',
    allowedTaskClass: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code', 'implementation', 'security', 'ip_core', 'review', 'breakthrough_review'],
    blockedTaskClass: [],
    fallbackCandidates: ['gpt-5.4-mini', 'gpt-5.4', 'human_gate'],
    recommendedUse: 'Command tower, verification, and governance.',
    nextAllowedActionForStatus: {
      available: 'proceed_with_gpt_codex',
      limited: 'consider_cheaper_or_more_specific_fallback',
      blocked: 'route_to_human_gate',
      unknown: 'inspect_context',
      human_gate: 'request_human_approval',
    },
  },
  {
    key: PROVIDER_KEYS.gemini,
    provider: 'Gemini',
    role: 'Google/IAM/Cloud Run 補助',
    family: 'gemini',
    modelIds: ['gemini-2.5-flash-lite', 'gemini-2.5-pro'],
    defaultModelId: 'gemini-2.5-flash-lite',
    allowedTaskClass: ['google_iam_caution', 'cloud_run_caution', 'gcp_review', 'routine_docs', 'routine_smoke'],
    blockedTaskClass: ['secret', 'ip_core'],
    fallbackCandidates: ['gpt-5.4', 'gpt-5.4-mini', 'claude-sonnet-4-6', 'human_gate'],
    recommendedUse: 'Preferred for Google/IAM/Cloud Run caution review.',
    nextAllowedActionForStatus: {
      available: 'use_gemini_for_google_work',
      limited: 'use_gpt_codex_or_request_human_review',
      blocked: 'route_to_human_gate',
      unknown: 'inspect_context',
      human_gate: 'request_human_approval',
    },
  },
  {
    key: PROVIDER_KEYS.claude,
    provider: 'Claude',
    role: 'optional final audit',
    family: 'anthropic',
    modelIds: ['claude-sonnet-4-6'],
    defaultModelId: 'claude-sonnet-4-6',
    allowedTaskClass: ['final_review', 'quality_review', 'release_review', 'implementation'],
    blockedTaskClass: ['mandatory_gate'],
    fallbackCandidates: ['gpt-5.4', 'gpt-5.4-mini', 'human_gate'],
    recommendedUse: 'Optional final quality review; not a mandatory delivery gate.',
    nextAllowedActionForStatus: {
      available: 'use_claude_for_optional_final_audit',
      limited: 'prefer_gpt_codex_for_delivery_or_request_approval',
      blocked: 'route_to_human_gate',
      unknown: 'inspect_context',
      human_gate: 'request_human_approval',
    },
  },
  {
    key: PROVIDER_KEYS.grok,
    provider: 'Grok',
    role: '安全レビュー・穴探し',
    family: 'grok',
    modelIds: ['grok'],
    defaultModelId: 'grok',
    allowedTaskClass: ['breakthrough_review', 'review', 'exploration'],
    blockedTaskClass: ['mandatory_governance'],
    fallbackCandidates: ['gpt-5.4', 'claude-sonnet-4-6', 'human_gate'],
    recommendedUse: 'Review, contradiction finding, and breakthrough work.',
    nextAllowedActionForStatus: {
      available: 'use_grok_for_review',
      limited: 'prefer_gpt_codex_or_claude_review',
      blocked: 'route_to_human_gate',
      unknown: 'inspect_context',
      human_gate: 'request_human_approval',
    },
  },
  {
    key: PROVIDER_KEYS.deepseek_opencode,
    provider: 'DeepSeek / opencode',
    role: 'sanitized_only 量産',
    family: 'deepseek',
    modelIds: ['deepseek-chat'],
    defaultModelId: 'deepseek-chat',
    allowedTaskClass: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskClass: ['secret', 'customer_data', 'salesdx', 'transcriber', 'ip_core', 'billing', 'lead_management', 'real_api', 'real_deploy', 'real_iam'],
    fallbackCandidates: ['gpt-5.4-mini', 'gpt-5.4', 'human_gate'],
    recommendedUse: 'External sanitized-only work; no secrets, IP core, or customer data.',
    nextAllowedActionForStatus: {
      available: 'use_sanitized_only_pack',
      limited: 'fall_back_to_gpt_mini_or_request_human_review',
      blocked: 'request_human_approval',
      unknown: 'inspect_context',
      human_gate: 'request_human_approval',
    },
  },
];

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
  return parts
    .filter(Boolean)
    .map(part => String(part))
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ')
    .trim();
}

function normalizeState(value) {
  const state = normalizeText(value);
  if (Object.values(STATES).includes(state)) return state;
  return STATES.unknown;
}

function normalizeProviderStateMap(context = {}) {
  const rawStates = context.providerStates || {};
  const out = {};
  for (const [key, value] of Object.entries(rawStates)) {
    const normalizedKey = normalizeText(key)
      .replace(/\s+/g, '_')
      .replace(/[^\w/]+/g, '_');
    out[normalizedKey] = normalizeState(value);
  }
  return out;
}

function taskText(task = {}, context = {}) {
  return compactText(
    task.title,
    task.description,
    task.project,
    task.repo,
    context.specText,
    context.taskTitle,
    context.taskSummary,
  );
}

function detectDangerSignals(task = {}, context = {}) {
  const fullText = taskText(task, context);
  const lower = fullText.toLowerCase();

  const secretPaths = securityPolicy.detectForbiddenPaths(fullText);
  const secretCommands = securityPolicy.detectForbiddenCommands(fullText);
  const secretKeywords = securityPolicy.detectSecretLikeText(fullText);
  const ipViolations = ipGate.detectProtectedIP(fullText);

  const customerSignals = uniqueList([
    ...secretKeywords.filter(v => /customer|顧客|customerdata|customer_data|customerinfo|customer_info|customer_name/i.test(v)),
    ...(/(customer|顧客)(?:\s|_)?(?:data|info|name)?/i.test(fullText) ? ['customer data'] : []),
  ]);

  const salesDxSignals = uniqueList([
    ...(task.project && String(task.project).toLowerCase() === 'transcriber' ? ['transcriber project'] : []),
    ...(lower.includes('sales dx') || lower.includes('営業dx') || lower.includes('transcriber') ? ['salesDX/transcriber'] : []),
  ]);

  const sensitiveSignals = uniqueList([
    ...secretPaths.map(v => `path:${v}`),
    ...secretCommands.map(v => `command:${v}`),
    ...secretKeywords.map(v => `secret:${v}`),
  ]);

  const billingLeadSignals = uniqueList([
    ...(ipViolations.filter(v => /billing|lead management/i.test(v)).length > 0 ? ['billing / lead management'] : []),
    ...(lower.includes('billing') || lower.includes('lead management') ? ['billing / lead management'] : []),
  ]);

  const apiDeployIamSignals = uniqueList([
    ...(context.realApiCall === true || /\breal api\b|\blive api\b|\bexternal api\b/i.test(fullText) ? ['real API call'] : []),
    ...(context.realDeploy === true || /\bdeploy\b|\bcloud run deploy\b/i.test(fullText) ? ['real deploy'] : []),
    ...(context.realIamMutation === true || /\biam\b|\bservice account\b|\brole binding\b/i.test(fullText) ? ['real IAM mutation'] : []),
  ]);

  const ipCoreSignals = uniqueList([
    ...ipViolations,
  ]);

  const highCostModelWithoutApproval = normalizeText(context.requestedModel || context.selectedModel) === 'gpt 5.5'
    && context.approvalReceived !== true;

  const externalWorkerNonSanitized = context.externalSanitized !== true
    && String(context.workerClass || '').toLowerCase() !== 'sanitized_only';

  const globalHumanGateReasons = uniqueList([
    ...sensitiveSignals.map(v => `Secret/API key/.env/credentials access (${v})`),
    ...customerSignals.map(v => `customer data access (${v})`),
    ...salesDxSignals.map(v => `salesDX/transcriber access (${v})`),
    ...ipCoreSignals.map(v => `IP/core/full architecture access (${v})`),
    ...billingLeadSignals.map(v => `billing / lead management access (${v})`),
    ...apiDeployIamSignals.map(v => `${v} is not allowed in dryRun snapshot`),
  ]);

  const providerSpecificBlockedReasons = uniqueList([
    ...(highCostModelWithoutApproval ? ['high cost model without approval'] : []),
    ...(externalWorkerNonSanitized ? ['external worker task must be sanitized_only'] : []),
  ]);

  return {
    fullText,
    secretPaths,
    secretCommands,
    secretKeywords,
    customerSignals,
    salesDxSignals,
    ipCoreSignals,
    billingLeadSignals,
    apiDeployIamSignals,
    globalHumanGateReasons,
    providerSpecificBlockedReasons,
    highCostModelWithoutApproval,
    externalWorkerNonSanitized,
  };
}

function taskTypeWeight(taskType) {
  if (taskType === 'google_iam_caution' || taskType === 'cloud_run_caution' || taskType === 'gcp_review') return 'google';
  if (taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review') return 'review';
  if (taskType === 'breakthrough_review' || taskType === 'review') return 'review';
  if (String(taskType || '').startsWith('routine_')) return 'routine';
  if (taskType === 'implementation' || taskType === 'security' || taskType === 'ip_core') return 'implementation';
  return 'unknown';
}

function pickModelId(profile, taskType, context = {}) {
  if (profile.key === PROVIDER_KEYS.gpt_codex) {
    if (normalizeText(context.requestedModel) === 'gpt 5.5') return 'gpt-5.5';
    if (taskType === 'implementation' || taskType === 'security' || taskType === 'ip_core' || taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review') {
      return 'gpt-5.4';
    }
    return 'gpt-5.4-mini';
  }

  if (profile.key === PROVIDER_KEYS.gemini) return 'gemini-2.5-flash-lite';
  if (profile.key === PROVIDER_KEYS.claude) return 'claude-sonnet-4-6';
  if (profile.key === PROVIDER_KEYS.grok) return 'grok';
  if (profile.key === PROVIDER_KEYS.deepseek_opencode) return 'deepseek-chat';

  return profile.defaultModelId;
}

function pickBudgetBucket(modelId) {
  try {
    return budgetRouter.getProviderBudgetBucket(modelId) || 'unknown';
  } catch (_) {
    if (modelId === 'gpt-5.5') return 'high_cost_human_approval';
    if (modelId === 'gpt-5.4') return 'mid_cost';
    if (modelId === 'gpt-5.4-mini') return 'ultra_low_cost';
    if (modelId === 'deepseek-chat') return 'ultra_low_cost';
    if (modelId === 'claude-sonnet-4-6') return 'high_cost_human_approval';
    if (modelId === 'gemini-2.5-flash-lite') return 'free_tier';
    if (modelId === 'grok') return 'mid_cost';
    return 'unknown';
  }
}

function candidateFallbacks(profile, taskType, context = {}) {
  const currentState = normalizeState(context.providerState || context.workerState);
  const fallbackChain = [];

  if (currentState !== STATES.available) {
    try {
      const matrixResult = availabilityFallbackMatrix.recommendAvailabilityFallback(
        { title: context.taskTitle || '', description: context.taskSummary || '' },
        profile.defaultModelId,
        currentState,
        {
          ...context,
          approvalReceived: context.approvalReceived === true,
          externalSanitized: context.externalSanitized === true,
          workerClass: context.workerClass,
        },
      );
      if (Array.isArray(matrixResult?.fallbackChain)) {
        fallbackChain.push(...matrixResult.fallbackChain.map(item => item.modelId || item.workerName || item.recommendedUse));
      }
    } catch (_) {
      // fall through to static defaults
    }
  }

  fallbackChain.push(...profile.fallbackCandidates);
  if (profile.key === PROVIDER_KEYS.gpt_codex && taskType === 'google_iam_caution') {
    fallbackChain.unshift('gemini-2.5-flash-lite');
  }
  if (profile.key === PROVIDER_KEYS.gemini) {
    fallbackChain.unshift('gpt-5.4');
  }
  if (profile.key === PROVIDER_KEYS.claude && (taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review')) {
    fallbackChain.unshift('gpt-5.4');
  }

  return uniqueList(fallbackChain);
}

function statusForProfile(profile, taskType, context = {}, danger = {}, modelId) {
  const stateMap = normalizeProviderStateMap(context);
  const state = stateMap[profile.key]
    || stateMap[profile.family]
    || stateMap[modelId]
    || normalizeState(context.providerState || context.workerState || STATES.available);
  const approvalReceived = context.approvalReceived === true;
  const externalSanitized = context.externalSanitized === true
    || String(context.workerClass || '').toLowerCase() === 'sanitized_only';
  const requestedModel = normalizeText(context.requestedModel || context.selectedModel);
  const isHighCostRequest = requestedModel === 'gpt 5.5';

  const globalGate = danger.globalHumanGateReasons.length > 0;

  if (globalGate) {
    return {
      status: STATES.human_gate,
      humanApprovalRequired: true,
      blockedReasons: [...danger.globalHumanGateReasons],
      cautions: ['human approval required before any provider can proceed'],
    };
  }

  if (profile.key === PROVIDER_KEYS.deepseek_opencode && !externalSanitized) {
    return {
      status: STATES.blocked,
      humanApprovalRequired: true,
      blockedReasons: ['external worker task must be sanitized_only'],
      cautions: ['DeepSeek/opencode must only receive sanitized tasks'],
    };
  }

  if (profile.key === PROVIDER_KEYS.gpt_codex && isHighCostRequest && !approvalReceived) {
    return {
      status: STATES.human_gate,
      humanApprovalRequired: true,
      blockedReasons: ['gpt-5.5 requires explicit human approval'],
      cautions: ['gpt-5.5 is never auto-selected'],
    };
  }

  if (state === STATES.human_gate) {
    return {
      status: STATES.human_gate,
      humanApprovalRequired: true,
      blockedReasons: ['worker state requires human gate'],
      cautions: [],
    };
  }

  if (state === STATES.blocked || state === STATES.unknown) {
    return {
      status: state,
      humanApprovalRequired: false,
      blockedReasons: state === STATES.blocked ? ['worker state blocked'] : [],
      cautions: state === STATES.unknown ? ['provider state unknown'] : [],
    };
  }

  if (state === STATES.unavailable || state === STATES.rate_limited || state === STATES.over_budget) {
    return {
      status: STATES.limited,
      humanApprovalRequired: false,
      blockedReasons: state === STATES.unavailable ? ['provider unavailable'] : [],
      cautions: [state.replace(/_/g, ' ')],
    };
  }

  const taskAllowed = profile.allowedTaskClass.includes(taskType);
  const blockedClass = profile.blockedTaskClass.includes(taskType);

  if (blockedClass) {
    return {
      status: STATES.blocked,
      humanApprovalRequired: false,
      blockedReasons: [`task class ${taskType} is blocked for ${profile.provider}`],
      cautions: [],
    };
  }

  if (!taskAllowed) {
    return {
      status: STATES.limited,
      humanApprovalRequired: profile.key === PROVIDER_KEYS.claude ? false : false,
      blockedReasons: [],
      cautions: [`${profile.provider} is not the primary lane for ${taskType}`],
    };
  }

  return {
    status: STATES.available,
    humanApprovalRequired: profile.key === PROVIDER_KEYS.claude ? false : false,
    blockedReasons: [],
    cautions: [],
  };
}

function chooseRecommendedFallback(items, taskType, context = {}, danger = {}) {
  if (danger.globalHumanGateReasons.length > 0) return 'human_gate';
  const order = [];
  if (taskType === 'google_iam_caution' || taskType === 'cloud_run_caution' || taskType === 'gcp_review') {
    order.push('Gemini', 'GPT / Codex', 'Claude', 'Grok');
  } else if (taskType === 'final_review' || taskType === 'quality_review' || taskType === 'release_review') {
    order.push('Claude', 'GPT / Codex', 'Grok', 'Gemini');
  } else if (taskType === 'breakthrough_review' || taskType === 'review') {
    order.push('Grok', 'Claude', 'GPT / Codex', 'Gemini');
  } else if (String(taskType || '').startsWith('routine_')) {
    order.push('GPT / Codex', 'DeepSeek / opencode', 'Gemini', 'Claude', 'Grok');
  } else {
    order.push('GPT / Codex', 'Gemini', 'Claude', 'Grok', 'DeepSeek / opencode');
  }

  const preferred = order
    .map(provider => items.find(item => item.provider === provider))
    .find(item => item && (item.status === STATES.available || item.status === STATES.limited));

  if (preferred) return preferred.provider;
  if (items.some(item => item.status === STATES.human_gate)) return 'human_gate';
  return items[0]?.provider || 'human_gate';
}

function buildProviderAvailabilityHealthSnapshot(task = {}, context = {}) {
  const taskType = scorecard.classifyTaskType(task, context);
  const taskClass = taskTypeWeight(taskType);
  const danger = detectDangerSignals(task, context);

  const items = PROVIDER_PROFILES.map(profile => {
    const modelId = pickModelId(profile, taskType, context);
    const budgetBucket = pickBudgetBucket(modelId);
    const statusInfo = statusForProfile(profile, taskType, context, danger, modelId);
    const scorecardEntry = scorecard.getWorkerScorecard(modelId);
    const fallbackCandidates = candidateFallbacks(profile, taskType, {
      ...context,
      providerState: context.providerStates?.[profile.key] || context.providerState || context.workerState,
      workerState: context.providerStates?.[profile.key] || context.providerState || context.workerState,
      taskTitle: task?.title || context.taskTitle || '',
      taskSummary: task?.description || context.taskSummary || '',
      approvalReceived: context.approvalReceived === true,
      externalSanitized: context.externalSanitized === true,
      workerClass: context.workerClass,
    });
    const cautions = uniqueList([
      ...statusInfo.cautions,
      ...(profile.key === PROVIDER_KEYS.gemini && !taskAllowedForGemini(taskType) ? ['Gemini is preferred for Google/IAM/Cloud Run caution review.'] : []),
      ...(profile.key === PROVIDER_KEYS.claude ? ['Claude is optional final audit, not a mandatory delivery gate.'] : []),
      ...(profile.key === PROVIDER_KEYS.grok ? ['Grok is review/breakthrough, not default governance.'] : []),
      ...(profile.key === PROVIDER_KEYS.deepseek_opencode ? ['DeepSeek/opencode is sanitized_only.'] : []),
      ...(profile.key === PROVIDER_KEYS.gpt_codex ? ['GPT/Codex is the command tower and cheap-first default.'] : []),
    ]);
    const blockedReasons = uniqueList([
      ...statusInfo.blockedReasons,
      ...(profile.key === PROVIDER_KEYS.deepseek_opencode && !context.externalSanitized && context.workerClass !== 'sanitized_only'
        ? ['external worker task must be sanitized_only']
        : []),
      ...(profile.key === PROVIDER_KEYS.gpt_codex && normalizeText(context.requestedModel) === 'gpt 5.5' && context.approvalReceived !== true
        ? ['gpt-5.5 requires explicit human approval']
        : []),
    ]);
    const nextAllowedAction = statusInfo.status === STATES.available
      ? profile.nextAllowedActionForStatus.available
      : statusInfo.status === STATES.limited
        ? profile.nextAllowedActionForStatus.limited
        : statusInfo.status === STATES.blocked
          ? profile.nextAllowedActionForStatus.blocked
          : statusInfo.status === STATES.human_gate
            ? profile.nextAllowedActionForStatus.human_gate
            : profile.nextAllowedActionForStatus.unknown;

    return {
      provider: profile.provider,
      providerKey: profile.key,
      role: profile.role,
      modelId,
      modelTier: scorecardEntry.modelTier,
      budgetBucket,
      allowedTaskClass: [...profile.allowedTaskClass],
      blockedReasons,
      cautions,
      fallbackCandidates,
      nextAllowedAction,
      humanApprovalRequired: !!statusInfo.humanApprovalRequired,
      status: blockedReasons.length > 0 && statusInfo.status === STATES.available ? STATES.blocked : statusInfo.status,
      recommendedUse: scorecardEntry.recommendedUse,
      costRisk: scorecardEntry.costRisk,
      reliabilityScore: scorecardEntry.reliabilityScore,
      safetyScore: scorecardEntry.safetyScore,
      speedScore: scorecardEntry.speedScore,
      qualityScore: scorecardEntry.qualityScore,
    };
  });

  const hasBlocked = items.some(item => item.status === STATES.blocked);
  const hasLimited = items.some(item => item.status === STATES.limited);
  const humanGateRequired = items.some(item => item.status === STATES.human_gate || item.humanApprovalRequired === true);
  const recommendedFallback = chooseRecommendedFallback(items, taskType, context, danger);

  const providerHealth = {
    hasBlocked,
    hasLimited,
    recommendedFallback,
    humanGateRequired,
    items,
  };

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    dryRun: true,
    taskTitle: String(task?.title || context.taskTitle || ''),
    taskSummary: String(task?.description || context.taskSummary || ''),
    taskType,
    taskClass,
    requestedModel: context.requestedModel || null,
    approvalReceived: context.approvalReceived === true,
    externalSanitized: context.externalSanitized === true,
    providerHealth,
    items,
    dangerSignals: danger,
    recommendedFallback,
  };
}

function taskAllowedForGemini(taskType) {
  return taskType === 'google_iam_caution'
    || taskType === 'cloud_run_caution'
    || taskType === 'gcp_review'
    || taskType === 'routine_docs'
    || taskType === 'routine_smoke';
}

module.exports = {
  TOOL_META,
  STATES,
  PROVIDER_KEYS,
  PROVIDER_PROFILES,
  normalizeText,
  normalizeState,
  normalizeProviderStateMap,
  taskText,
  detectDangerSignals,
  pickModelId,
  pickBudgetBucket,
  candidateFallbacks,
  statusForProfile,
  chooseRecommendedFallback,
  buildProviderAvailabilityHealthSnapshot,
};

if (require.main === module) {
  const snapshot = buildProviderAvailabilityHealthSnapshot({
    title: 'Refresh one docs section',
    description: 'Update a docs section only',
  });
  console.log(JSON.stringify(snapshot, null, 2));
}
