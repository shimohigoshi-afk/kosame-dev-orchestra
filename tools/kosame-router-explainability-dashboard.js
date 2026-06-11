#!/usr/bin/env node
'use strict';

/**
 * KOSAME Router Explainability Dashboard Lite v110.57.0
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
  version: '110.57.0',
  feature: 'v110-57-router-explainability-dashboard-lite',
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

function buildRouterExplanation(task, decision = {}, context = {}) {
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
    || decision.selectedWorker
    || decision.recommendedWorker
    || decision.primary
    || decision.costPolicy?.recommendedWorker
    || null;

  const selectedModel = decision.costPolicy?.selectedModel
    || decision.availabilityFallback?.recommendedModelId
    || decision.workerScorecard?.modelId
    || decision.selectedModel
    || decision.primary
    || null;

  const modelTier = decision.costPolicy?.modelTier
    || decision.availabilityFallback?.recommendedTier
    || decision.workerScorecard?.modelTier
    || null;

  const approvalRequired = !!(
    decision.costPolicy?.approvalRequired
    || decision.workerScorecard?.approvalRequired
    || decision.availabilityFallback?.approvalRequired
  );

  const humanGateRequired = !!(
    decision.availabilityFallback?.humanGateRequired
    || decision.humanGate
    || decision.costPolicy?.selectionBlocked
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
  );

  const approvalReason = approvalRequired
    ? compactText(
        decision.costPolicy?.approvalRequired ? 'approval required' : '',
        decision.costPolicy?.notes,
        decision.workerScorecard?.recommendedUse,
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
    : 'no expensive model block';

  const humanGateReason = humanGateRequired
    ? compactText(
        decision.availabilityFallback?.reason,
        decision.costPolicy?.selectionBlocked ? 'cost gate blocked' : '',
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
  );

  return {
    selectedWorker,
    selectedModel,
    modelTier,
    taskType,
    decisionReason: compactText(
      decision.reason,
      decision.method ? `method=${decision.method}` : '',
      decision.primary ? `primary=${decision.primary}` : '',
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
