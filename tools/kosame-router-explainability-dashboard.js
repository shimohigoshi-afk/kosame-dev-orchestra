#!/usr/bin/env node
'use strict';

/**
 * KOSAME Router Explainability Dashboard Lite v110.64.0
 *
 * 小さな説明生成レイヤー。
 * 既存の router / ledger / scorecard / fallback の出力を読み、
 * どの理由でその選択になったかを人間向けに整形する。
 */

const scorecard = require('./kosame-worker-scorecard');
const availabilityFallbackMatrix = require('./kosame-availability-fallback-matrix');

const CLAUDE = 'claude-sonnet-4-6';
const GEMINI = 'gemini-2.5-flash-lite';
const DEEPSEEK = 'deepseek-chat';

const TOOL_META = {
  version: '110.64.0',
  feature: 'v110-64-agent-handoff-coordination-gate',
  slug: 'kosame-router-explainability-dashboard',
};

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

function buildRouterExplanation(task, decision = {}, context = {}) {
  const budgetDecision = decision.providerBudgetBucketDecision
    || decision.costPolicy?.providerBudgetBucketDecision
    || decision.costPolicy?.providerBudgetDecision
    || context.providerBudgetBucketDecision
    || null;
  const requestedModel = String(context.requestedModel || decision.requestedModel || '').trim();
  const currentModel = decision.availabilityFallback?.currentModel
    || decision.currentModel
    || decision.selectedModel
    || decision.primary
    || null;
  const taskType = decision.taskType
    || decision.costPolicy?.taskType
    || decision.availabilityFallback?.taskType
    || scorecard.classifyTaskType(task, context);

  const selectedWorker = decision.workerScorecard?.workerName
    || budgetDecision?.selectedProviderName
    || decision.selectedWorker
    || decision.recommendedWorker
    || decision.primary
    || decision.costPolicy?.recommendedWorker
    || null;

  const selectedModel = decision.selectedModel
    || budgetDecision?.selectedModel
    || decision.availabilityFallback?.recommendedModelId
    || decision.costPolicy?.providerBudgetDecision?.selectedModel
    || decision.costPolicy?.selectedModel
    || decision.workerScorecard?.modelId
    || decision.primary
    || null;

  const modelTier = budgetDecision?.modelTier
    || decision.costPolicy?.providerBudgetDecision?.modelTier
    || decision.costPolicy?.modelTier
    || decision.availabilityFallback?.recommendedTier
    || decision.workerScorecard?.modelTier
    || null;

  const providerBudgetBucket = budgetDecision?.providerBudgetBucket
    || decision.costPolicy?.providerBudgetBucket
    || null;

  const providerBudgetBucketReason = budgetDecision?.providerBudgetBucketReason
    || decision.costPolicy?.providerBudgetBucketReason
    || null;

  const providerBudgetBucketPath = budgetDecision?.providerBudgetBucketPath
    || decision.costPolicy?.providerBudgetBucketPath
    || [];

  const providerBudgetEscalationReason = budgetDecision?.escalationReason
    || decision.costPolicy?.providerBudgetEscalationReason
    || null;

  const providerBudgetHumanGateRequired = !!(
    budgetDecision?.humanGateRequired
    || decision.costPolicy?.providerBudgetHumanGateRequired
  );

  const providerBudgetHumanGateReason = budgetDecision?.humanGateReason
    || decision.costPolicy?.providerBudgetHumanGateReason
    || null;

  const providerBudgetBlockedHighCost = !!(
    budgetDecision?.blockedHighCost
    || decision.costPolicy?.providerBudgetBlockedHighCost
  );

  const providerBudgetBlockedHighCostReason = budgetDecision?.blockedHighCostReason
    || decision.costPolicy?.providerBudgetBlockedHighCostReason
    || null;

  const providerBudgetProvider = budgetDecision?.selectedProvider
    || budgetDecision?.selectedModel
    || decision.costPolicy?.providerBudgetDecision?.selectedProvider
    || null;

  const coordinationGate = decision.coordinationGate
    || decision.costPolicy?.coordinationGate
    || context.coordinationGate
    || null;

  const coordinationStatus = coordinationGate?.status || null;
  const coordinationReason = coordinationGate?.coordinationReason
    || coordinationGate?.humanGateReason
    || coordinationGate?.coordinationSummary?.nextAllowedAction
    || null;
  const coordinationBlockedReasons = uniqueList(coordinationGate?.blockedReasons || []);
  const coordinationCautions = uniqueList(coordinationGate?.cautions || []);
  const coordinationNextAllowedAction = coordinationGate?.nextAllowedAction || null;
  const coordinationAssignedAgent = coordinationGate?.assignedAgent || null;
  const coordinationTargetVersion = coordinationGate?.targetVersion || null;
  const coordinationTargetRepo = coordinationGate?.targetRepo || null;

  const approvalRequired = !!(
    decision.costPolicy?.approvalRequired
    || decision.workerScorecard?.approvalRequired
    || decision.availabilityFallback?.approvalRequired
    || budgetDecision?.approvalRequired
  );

  const humanGateRequired = !!(
    decision.availabilityFallback?.humanGateRequired
    || decision.humanGate
    || decision.costPolicy?.selectionBlocked
    || providerBudgetHumanGateRequired
    || coordinationGate?.humanGateRequired
  );

  const fallbackReason = decision.availabilityFallback?.reason
    || (decision.fallback && selectedModel && decision.fallback !== selectedModel
      ? `fallback from ${decision.fallback} to ${selectedModel}`
      : 'no fallback needed');

  const costReason = compactText(
    decision.costPolicy?.notes,
    taskType === 'routine_docs'
    || taskType === 'routine_smoke'
    || taskType === 'routine_ui'
    || taskType === 'routine_light_code'
      ? 'cheap-first / gpt-5.4-mini preferred route'
      : '',
    approvalRequired ? 'approval required cost tier' : 'cheap-first / standard path',
    providerBudgetBucket ? `bucket=${providerBudgetBucket}` : '',
    providerBudgetBucketReason,
    providerBudgetEscalationReason,
  );

  const approvalReason = approvalRequired
    ? compactText(
        decision.costPolicy?.approvalRequired ? 'approval required' : '',
        decision.costPolicy?.notes,
        decision.workerScorecard?.recommendedUse,
        providerBudgetBucketReason,
      )
    : 'approval not required';

  const expensiveModelBlocked = requestedModel === 'gpt-5.5'
    && !(
      decision.costPolicy?.approvalReceived
      || context.approvalReceived
      || decision.approvalReceived
    );

  const expensiveModelBlockedReason = expensiveModelBlocked
    ? 'gpt-5.5 requires explicit human approval and is never auto-selected'
    : (
      providerBudgetBlockedHighCost
        ? providerBudgetBlockedHighCostReason || 'high-cost provider blocked until explicit approval'
        : 'no expensive model block'
    );

  const humanGateReason = humanGateRequired
    ? compactText(
        decision.availabilityFallback?.reason,
        decision.costPolicy?.selectionBlocked ? 'cost gate blocked' : '',
        providerBudgetHumanGateReason,
        coordinationGate?.humanGateReason,
        taskType === 'ip_core' || taskType === 'security'
          ? 'IP/core/security requires human gate'
          : '',
      )
    : 'human gate not required';

  const safetyNotes = compactText(
    currentModel === CLAUDE && selectedModel !== CLAUDE
      ? 'Claude unavailable; delivery can continue through GPT/Codex + verify + smoke.'
      : '',
    currentModel === GEMINI && selectedModel !== GEMINI
      ? 'Gemini unavailable; use cautious fallback or human gate for Google/IAM/Cloud Run tasks.'
      : '',
    currentModel === DEEPSEEK && selectedModel !== DEEPSEEK
      ? 'DeepSeek unsafe for this task; route away from external_sanitized.'
      : '',
    taskType === 'security' || taskType === 'ip_core'
      ? 'Security/IP/core work stays behind human gate or standard fallback.'
      : '',
    taskType === 'routine_docs' || taskType === 'routine_smoke' || taskType === 'routine_ui'
      ? 'Routine/docs/smoke/UI work stays cheap-first.'
      : '',
    selectedModel === 'deepseek-chat' || decision.workerScorecard?.sanitizedOnly
      ? 'External worker path is sanitized-only.'
      : '',
    selectedModel === 'claude-sonnet-4-6'
      ? 'Claude is optional final review, not a mandatory delivery gate.'
      : '',
    selectedModel === 'gemini-2.5-flash-lite'
      ? 'Gemini is preferred for Google/IAM/Cloud Run caution review.'
      : '',
    selectedModel === 'gpt-5.4'
      ? 'Standard model is the normal implementation fallback.'
      : '',
    providerBudgetBucket
      ? `Budget bucket: ${providerBudgetBucket}.`
      : '',
    providerBudgetProvider
      ? `Budget provider: ${providerBudgetProvider}.`
      : '',
    providerBudgetEscalationReason
      ? `Budget escalation: ${providerBudgetEscalationReason}.`
      : '',
    coordinationStatus
      ? `Coordination status: ${coordinationStatus}.`
      : '',
    coordinationReason
      ? `Coordination reason: ${coordinationReason}.`
      : '',
    coordinationBlockedReasons.length > 0
      ? `Coordination blocked: ${coordinationBlockedReasons.join('; ')}.`
      : '',
    coordinationCautions.length > 0
      ? `Coordination cautions: ${coordinationCautions.join('; ')}.`
      : '',
  );

  return {
    selectedWorker,
    selectedModel,
    modelTier,
    providerBudgetBucket,
    providerBudgetProvider,
    providerBudgetBucketReason,
    providerBudgetBucketPath,
    providerBudgetEscalationReason,
    providerBudgetHumanGateRequired,
    providerBudgetHumanGateReason,
    providerBudgetBlockedHighCost,
    providerBudgetBlockedHighCostReason,
    coordinationStatus,
    coordinationReason,
    coordinationBlockedReasons,
    coordinationCautions,
    coordinationNextAllowedAction,
    coordinationAssignedAgent,
    coordinationTargetVersion,
    coordinationTargetRepo,
    taskType,
    decisionReason: compactText(
      decision.reason,
      decision.method ? `method=${decision.method}` : '',
      decision.primary ? `primary=${decision.primary}` : '',
      coordinationReason ? `coordination=${coordinationReason}` : '',
    ),
    costReason,
    approvalRequired,
    approvalReason,
    fallbackReason,
    humanGateRequired,
    humanGateReason,
    expensiveModelBlocked,
    expensiveModelBlockedReason,
    safetyNotes,
  };
}

function explainRoute(task, decision = {}, context = {}) {
  const explanation = buildRouterExplanation(task, decision, context);
  return {
    ...decision,
    routerExplanation: explanation,
  };
}

module.exports = {
  TOOL_META,
  buildRouterExplanation,
  explainRoute,
};
