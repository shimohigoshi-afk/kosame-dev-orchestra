#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cost & Token Ledger v110.62.0
 *
 * Cheap First / Expensive Last を守るための軽量モデル治理レイヤー。
 * - 默认は cheap
 * - gpt-5.5 は explicit human approval がない限り使わない
 * - routine/docs/smoke/UI/simple code は gpt-5.4-mini
 * - normal implementation は gpt-5.4
 * - security / IP / core / architecture は cost warning + human approval
 * - DeepSeek/opencode style sanitized worker は external_sanitized tier
 */

const TOOL_META = {
  version: '110.62.0',
  feature: 'v110-62-cost-token-ledger',
  slug: 'kosame-cost-token-ledger',
};

const MODEL_TIERS = {
  cheap: {
    tier: 'cheap',
    model: 'gpt-5.4-mini',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    note: 'default cheap-first model for routine work',
  },
  standard: {
    tier: 'standard',
    model: 'gpt-5.4',
    costEstimateBand: 'medium',
    estimatedRisk: 'medium',
    approvalRequired: false,
    note: 'normal implementation / mini fallback',
  },
  expensive: {
    tier: 'expensive',
    model: 'gpt-5.5',
    costEstimateBand: 'high',
    estimatedRisk: 'high',
    approvalRequired: true,
    note: 'explicit human approval only; never auto-escalate',
  },
  external_sanitized: {
    tier: 'external_sanitized',
    model: 'deepseek-chat',
    costEstimateBand: 'low',
    estimatedRisk: 'low',
    approvalRequired: false,
    note: 'DeepSeek/opencode style sanitized worker',
  },
};

const ROUTINE_RE = /\b(docs?|documentation|readme|smoke|test|ui|css|style|button|label|text fix|typo|copy edit|simple code|helper|lint|format)\b|(?:README|文言|表示|UI|微調整|文書|ドキュメント)/i;
const IMPLEMENTATION_RE = /\b(implement|build|create|add|feature|fix|refactor|rewrite|develop|code)\b|(?:実装|開発|追加|修正|機能)/i;
const SECURITY_RE = /\b(security|secret|credential|auth|token|api.?key|permission|iam|redact|sanitize|privacy|authorization|authentication)\b|(?:機密|秘密|顧客情報|個人情報|認証|認可|権限)/i;
const IP_CORE_RE = /\b(architecture|core|business model|pricing|billing|subscription|customer management|sales flow|orchestration|router|system design|product design)\b|(?:全体設計|中核設計|事業モデル|収益モデル|課金導線|顧客管理|営業導線|アーキテクチャ|Smart Router|ANESTY Board core|KOSAME Dev Orchestra core)/i;

function normalizeText(...parts) {
  return parts
    .filter(Boolean)
    .map(p => String(p))
    .join(' ')
    .toLowerCase()
    .replace(/[\s_-]+/g, ' ');
}

function classifyTaskType(task, context = {}) {
  const text = normalizeText(task?.title, task?.description, context.specText);

  if (ROUTINE_RE.test(text)) {
    if (/\b(smoke|test)\b/i.test(text) || /テスト|smoke/.test(text)) return 'routine_smoke';
    if (/\b(ui|css|style|button|label|text fix)\b/i.test(text) || /UI|表示|文言|ボタン|ラベル|微調整/.test(text)) return 'routine_ui';
    if (/\b(docs?|documentation|readme)\b/i.test(text) || /README|ドキュメント|文書/.test(text)) return 'routine_docs';
    return 'routine_simple_code';
  }

  if (SECURITY_RE.test(text)) return 'security';
  if (IP_CORE_RE.test(text)) return 'ip_core';
  if (IMPLEMENTATION_RE.test(text)) return 'implementation';
  return 'unknown';
}

function cloneTier(tierKey) {
  const tier = MODEL_TIERS[tierKey] || MODEL_TIERS.cheap;
  return { tierKey, ...tier };
}

function assessRisk(taskType) {
  if (taskType === 'security' || taskType === 'ip_core') return 'high';
  if (taskType === 'implementation') return 'medium';
  if (taskType.startsWith('routine_')) return 'low';
  return 'unknown';
}

function recommendModel(task, context = {}) {
  if (context.externalSanitized === true) {
    const tier = cloneTier('external_sanitized');
    return {
      taskType: classifyTaskType(task, context),
      selectedModel: tier.model,
      modelTier: tier.tier,
      approvalRequired: false,
      approvalReceived: false,
      costEstimateBand: tier.costEstimateBand,
      estimatedRisk: tier.estimatedRisk,
      notes: [tier.note, 'sanitized external work only'].filter(Boolean).join('; '),
      allowed: true,
      selectionBlocked: false,
    };
  }

  const taskType = classifyTaskType(task, context);

  if (taskType === 'security' || taskType === 'ip_core') {
    const tier = cloneTier('standard');
    return {
      taskType,
      selectedModel: tier.model,
      modelTier: tier.tier,
      approvalRequired: true,
      approvalReceived: false,
      costEstimateBand: tier.costEstimateBand,
      estimatedRisk: 'high',
      notes: [
        'security/IP/core/architecture work requires human approval before any gpt-5.5 use',
        'gpt-5.5 is never auto-selected',
      ].join('; '),
      allowed: true,
      selectionBlocked: false,
    };
  }

  if (taskType === 'implementation' || context.miniFailed === true) {
    const tier = cloneTier('standard');
    return {
      taskType,
      selectedModel: tier.model,
      modelTier: tier.tier,
      approvalRequired: false,
      approvalReceived: false,
      costEstimateBand: tier.costEstimateBand,
      estimatedRisk: tier.estimatedRisk,
      notes: context.miniFailed === true
        ? 'mini attempt failed; promote to gpt-5.4'
        : 'normal implementation uses standard tier',
      allowed: true,
      selectionBlocked: false,
    };
  }

  const tier = cloneTier('cheap');
  return {
    taskType,
    selectedModel: tier.model,
    modelTier: tier.tier,
    approvalRequired: false,
    approvalReceived: false,
    costEstimateBand: tier.costEstimateBand,
    estimatedRisk: assessRisk(taskType),
    notes: 'routine/smoke/UI/simple code stays on cheap-first tier',
    allowed: true,
    selectionBlocked: false,
  };
}

function evaluateRequestedModel(model, task, context = {}) {
  const requested = String(model || '').trim();
  const taskType = classifyTaskType(task, context);

  if (requested === MODEL_TIERS.expensive.model) {
    const approvalReceived = context.approvalReceived === true;
    return {
      taskType,
      selectedModel: requested,
      modelTier: MODEL_TIERS.expensive.tier,
      approvalRequired: true,
      approvalReceived,
      costEstimateBand: MODEL_TIERS.expensive.costEstimateBand,
      estimatedRisk: assessRisk(taskType) === 'unknown' ? 'high' : assessRisk(taskType),
      notes: approvalReceived
        ? 'explicit human approval received for gpt-5.5'
        : 'gpt-5.5 blocked until explicit human approval',
      allowed: approvalReceived,
      selectionBlocked: !approvalReceived,
    };
  }

  const recommendation = recommendModel(task, context);
  if (requested && requested !== recommendation.selectedModel) {
    return {
      ...recommendation,
      selectedModel: requested,
      requestedModel: requested,
      notes: [recommendation.notes, `requested model ${requested}`].filter(Boolean).join('; '),
      allowed: true,
      selectionBlocked: false,
    };
  }

  return {
    ...recommendation,
    requestedModel: requested || recommendation.selectedModel,
  };
}

function buildLedgerRecord(task, context = {}) {
  const record = context.requestedModel
    ? evaluateRequestedModel(context.requestedModel, task, context)
    : recommendModel(task, context);
  let workerScorecard = null;
  let availabilityFallback = null;
  try {
    const scorecard = require('./kosame-worker-scorecard');
    workerScorecard = scorecard.recommendWorkerForTask(task, context);
  } catch (_) {
    workerScorecard = null;
  }
  try {
    const fallbackMatrix = require('./kosame-availability-fallback-matrix');
    availabilityFallback = fallbackMatrix.recommendAvailabilityFallback(
      task,
      record.selectedModel,
      context.workerState || fallbackMatrix.WORKER_STATES.healthy,
      {
        ...context,
        approvalReceived: context.approvalReceived ?? record.approvalReceived,
      },
    );
  } catch (_) {
    availabilityFallback = null;
  }
  let providerBudgetBucketDecision = null;
  try {
    const budgetRouter = require('./kosame-provider-budget-bucket-router');
    providerBudgetBucketDecision = context.providerBudgetBucketDecision
      || budgetRouter.recommendProviderBudgetBucket(task, {
        ...context,
        requestedModel: context.requestedModel || record.selectedModel,
        workerScorecard,
        availabilityFallback,
        approvalReceived: context.approvalReceived ?? record.approvalReceived,
      });
  } catch (_) {
    providerBudgetBucketDecision = context.providerBudgetBucketDecision || null;
  }
  let routerExplanation = null;
  try {
    const explainability = require('./kosame-router-explainability-dashboard');
    routerExplanation = explainability.buildRouterExplanation(task, {
      costPolicy: record,
      workerScorecard,
      availabilityFallback,
      providerBudgetBucketDecision,
    }, context);
  } catch (_) {
    routerExplanation = null;
  }

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    taskTitle: String(task?.title || ''),
    taskType: record.taskType,
    selectedModel: record.selectedModel,
    modelTier: record.modelTier,
    approvalRequired: !!record.approvalRequired,
    approvalReceived: !!(context.approvalReceived ?? record.approvalReceived),
    verifyRunCount: Number(context.verifyRunCount || 0),
    costEstimateBand: record.costEstimateBand,
    estimatedRisk: record.estimatedRisk,
    notes: record.notes,
    providerBudgetBucket: providerBudgetBucketDecision?.providerBudgetBucket || null,
    providerBudgetBucketReason: providerBudgetBucketDecision?.providerBudgetBucketReason || null,
    providerBudgetBucketPath: providerBudgetBucketDecision?.providerBudgetBucketPath || [],
    providerBudgetCandidates: providerBudgetBucketDecision?.providerBudgetCandidates || [],
    providerBudgetEscalationReason: providerBudgetBucketDecision?.escalationReason || null,
    providerBudgetFallbackReason: providerBudgetBucketDecision?.fallbackReason || null,
    providerBudgetHumanGateRequired: providerBudgetBucketDecision?.humanGateRequired || false,
    providerBudgetHumanGateReason: providerBudgetBucketDecision?.humanGateReason || null,
    providerBudgetBlockedHighCost: providerBudgetBucketDecision?.blockedHighCost || false,
    providerBudgetBlockedHighCostReason: providerBudgetBucketDecision?.blockedHighCostReason || null,
    providerBudgetDecision: providerBudgetBucketDecision,
    providerBudgetBucketDecision,
    recommendedWorker: workerScorecard?.workerName || null,
    recommendedModelId: workerScorecard?.modelId || null,
    workerScorecard,
    availabilityFallback,
    routerExplanation,
  };
}

module.exports = {
  TOOL_META,
  MODEL_TIERS,
  ROUTINE_RE,
  IMPLEMENTATION_RE,
  SECURITY_RE,
  IP_CORE_RE,
  normalizeText,
  classifyTaskType,
  recommendModel,
  evaluateRequestedModel,
  buildLedgerRecord,
};
