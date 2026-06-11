#!/usr/bin/env node
'use strict';

/**
 * KOSAME Worker Scorecard v110.55.0
 *
 * Cheap First / Expensive Last を支える worker/model scorecard.
 * どの worker がどの task に向くかを軽量に記録する。
 */

const TOOL_META = {
  version: '110.55.0',
  feature: 'v110-55-worker-scorecard',
  slug: 'kosame-worker-scorecard',
};

const DEFAULT_SCORECARDS = {
  'gpt-5.4-mini': {
    workerName: 'GPT-mini cheap worker',
    modelId: 'gpt-5.4-mini',
    modelTier: 'cheap',
    bestTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskTypes: ['security', 'ip_core', 'google_iam_caution', 'breakthrough_review'],
    costRisk: 'low',
    reliabilityScore: 78,
    safetyScore: 86,
    speedScore: 96,
    qualityScore: 74,
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Default for routine/docs/smoke/UI/light code work.',
    aliases: ['cheap_general_worker', 'cheap_worker', 'gpt-mini'],
  },
  'gpt-5.4': {
    workerName: 'GPT standard worker',
    modelId: 'gpt-5.4',
    modelTier: 'standard',
    bestTaskTypes: ['implementation', 'routine_light_code', 'security', 'ip_core'],
    blockedTaskTypes: ['gpt-5.5_only'],
    costRisk: 'medium',
    reliabilityScore: 84,
    safetyScore: 82,
    speedScore: 72,
    qualityScore: 82,
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Standard implementation fallback when mini is not enough.',
    aliases: ['standard_worker', 'gpt_standard_worker'],
  },
  'gpt-5.5': {
    workerName: 'GPT expensive worker',
    modelId: 'gpt-5.5',
    modelTier: 'expensive',
    bestTaskTypes: ['security', 'ip_core', 'breakthrough_review', 'final_review'],
    blockedTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    costRisk: 'high',
    reliabilityScore: 90,
    safetyScore: 78,
    speedScore: 50,
    qualityScore: 93,
    approvalRequired: true,
    sanitizedOnly: false,
    recommendedUse: 'Explicit human approval only; do not drift here by default.',
    aliases: ['expensive_worker', 'gpt5.5'],
  },
  'deepseek-chat': {
    workerName: 'DeepSeek/opencode sanitized worker',
    modelId: 'deepseek-chat',
    modelTier: 'external_sanitized',
    bestTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'routine_light_code'],
    blockedTaskTypes: ['security', 'ip_core', 'google_iam_caution', 'customer_data', 'secret'],
    costRisk: 'low',
    reliabilityScore: 73,
    safetyScore: 92,
    speedScore: 95,
    qualityScore: 68,
    approvalRequired: false,
    sanitizedOnly: true,
    recommendedUse: 'External sanitized-only work; no secrets, IP core, or customer data.',
    aliases: ['deepseek', 'opencode', 'cheap_code_worker', 'sanitized_worker'],
  },
  grok: {
    workerName: 'Grok review/breakthrough worker',
    modelId: 'grok',
    modelTier: 'standard',
    bestTaskTypes: ['breakthrough_review', 'exploration', 'review'],
    blockedTaskTypes: ['routine_docs', 'routine_smoke', 'routine_ui', 'mandatory_governance'],
    costRisk: 'medium',
    reliabilityScore: 80,
    safetyScore: 77,
    speedScore: 74,
    qualityScore: 81,
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Review and breakthrough work, not default governance.',
    aliases: ['grok-review', 'breakthrough_worker', 'grok_worker'],
  },
  gemini: {
    workerName: 'Gemini Google/IAM cautious worker',
    modelId: 'gemini-2.5-flash-lite',
    modelTier: 'standard',
    bestTaskTypes: ['google_iam_caution', 'cloud_run_caution', 'gcp_review', 'routine_docs'],
    blockedTaskTypes: ['gpt-5.5_only', 'mandatory_governance'],
    costRisk: 'medium',
    reliabilityScore: 86,
    safetyScore: 89,
    speedScore: 84,
    qualityScore: 80,
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Preferred for Google/IAM/Cloud Run caution review and cautious preprocessing.',
    aliases: ['general_worker', 'gemini_worker', 'google_iam_worker'],
  },
  claude: {
    workerName: 'Claude final quality review worker',
    modelId: 'claude-sonnet-4-6',
    modelTier: 'standard',
    bestTaskTypes: ['final_review', 'quality_review', 'release_review'],
    blockedTaskTypes: ['mandatory_gate', 'routine_docs'],
    costRisk: 'medium',
    reliabilityScore: 89,
    safetyScore: 87,
    speedScore: 69,
    qualityScore: 94,
    approvalRequired: false,
    sanitizedOnly: false,
    recommendedUse: 'Optional final quality review; not a mandatory delivery gate.',
    aliases: ['claude_sonnet', 'claude_code', 'claude_review_worker'],
  },
};

const TYPE_HINTS = {
  routine_docs: [
    /\b(docs?|documentation|readme)\b/i,
    /(?:README|ドキュメント|文書|文言)/i,
  ],
  routine_smoke: [
    /\b(smoke|test)\b/i,
    /(?:smoke|テスト)/i,
  ],
  routine_ui: [
    /\b(ui|css|style|button|label|text fix|typo|copy edit)\b/i,
    /(?:UI|表示|文言|ボタン|ラベル|微調整)/i,
  ],
  routine_light_code: [
    /\b(helper|lint|format|simple code|light code)\b/i,
    /(?:軽微なコード|小修正)/i,
  ],
  implementation: [
    /\b(implement|build|create|add|feature|fix|refactor|rewrite|develop|code)\b/i,
    /(?:実装|開発|追加|修正|機能)/i,
  ],
  security: [
    /\b(security|secret|credential|auth|token|api.?key|permission|iam|redact|sanitize|privacy|authorization|authentication)\b/i,
    /(?:機密|秘密|顧客情報|個人情報|認証|認可|権限)/i,
  ],
  ip_core: [
    /\b(architecture|core|business model|pricing|billing|subscription|customer management|sales flow|orchestration|router|system design|product design)\b/i,
    /(?:全体設計|中核設計|事業モデル|収益モデル|課金導線|顧客管理|営業導線|アーキテクチャ|Smart Router|ANESTY Board core|KOSAME Dev Orchestra core)/i,
  ],
  google_iam_caution: [
    /\b(google|gcp|iam|cloud run|cloudrun|secret manager|cloud tasks|bigquery|firebase)\b/i,
    /(?:Google|IAM|Cloud Run|Secret Manager|Cloud Tasks)/i,
  ],
  final_review: [
    /\b(final review|quality review|release review|acceptance review|final quality)\b/i,
    /(?:最終レビュー|品質レビュー|最終品質|受入レビュー)/i,
  ],
  breakthrough_review: [
    /\b(breakthrough|explore|exploration|research|investigate|brainstorm|novel)\b/i,
    /(?:ブレークスルー|探索|研究|調査|発想)/i,
  ],
};

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

  if (TYPE_HINTS.google_iam_caution.some(pattern => pattern.test(text))) return 'google_iam_caution';

  for (const [type, patterns] of Object.entries(TYPE_HINTS)) {
    if (type === 'google_iam_caution') continue;
    if (patterns.some(pattern => pattern.test(text))) return type;
  }

  return 'unknown';
}

function cloneScorecard(scorecard) {
  return {
    ...scorecard,
    bestTaskTypes: [...scorecard.bestTaskTypes],
    blockedTaskTypes: [...scorecard.blockedTaskTypes],
    aliases: [...(scorecard.aliases || [])],
  };
}

function getDefaultScorecards() {
  return Object.values(DEFAULT_SCORECARDS).map(cloneScorecard);
}

function resolveScorecardKey(identifier) {
  const id = normalizeText(identifier).trim();
  if (!id) return null;

  for (const [key, scorecard] of Object.entries(DEFAULT_SCORECARDS)) {
    const aliases = new Set([key, scorecard.workerName, scorecard.modelId, ...(scorecard.aliases || [])]);
    for (const alias of aliases) {
      if (normalizeText(alias).trim() === id) return key;
    }
  }

  return null;
}

function getWorkerScorecard(identifier) {
  const key = resolveScorecardKey(identifier) || 'gpt-5.4-mini';
  return cloneScorecard(DEFAULT_SCORECARDS[key] || DEFAULT_SCORECARDS['gpt-5.4-mini']);
}

function summarizeScorecard(scorecard, taskType, notes, approvalRequired) {
  return {
    workerName: scorecard.workerName,
    modelId: scorecard.modelId,
    modelTier: scorecard.modelTier,
    taskType,
    bestTaskTypes: [...scorecard.bestTaskTypes],
    blockedTaskTypes: [...scorecard.blockedTaskTypes],
    costRisk: scorecard.costRisk,
    reliabilityScore: scorecard.reliabilityScore,
    safetyScore: scorecard.safetyScore,
    speedScore: scorecard.speedScore,
    qualityScore: scorecard.qualityScore,
    approvalRequired: !!approvalRequired,
    sanitizedOnly: !!scorecard.sanitizedOnly,
    recommendedUse: scorecard.recommendedUse,
    notes,
  };
}

function recommendWorkerForTask(task, context = {}) {
  if (context.externalSanitized === true) {
    const scorecard = getWorkerScorecard('deepseek-chat');
    return summarizeScorecard(
      scorecard,
      'routine_light_code',
      'sanitized external work only',
      false,
    );
  }

  const taskType = classifyTaskType(task, context);
  const title = normalizeText(task?.title, task?.description);

  if (taskType === 'security' || taskType === 'ip_core') {
    const scorecard = getWorkerScorecard('gpt-5.4');
    return summarizeScorecard(
      scorecard,
      taskType,
      'standard fallback for security/IP/core; gpt-5.5 only with explicit approval',
      true,
    );
  }

  if (taskType === 'google_iam_caution') {
    const scorecard = getWorkerScorecard('gemini');
    return summarizeScorecard(
      scorecard,
      taskType,
      'preferred for Google/IAM/Cloud Run caution review',
      false,
    );
  }

  if (taskType === 'final_review') {
    const scorecard = getWorkerScorecard('claude');
    return summarizeScorecard(
      scorecard,
      taskType,
      'optional final review, not a mandatory gate',
      false,
    );
  }

  if (taskType === 'breakthrough_review') {
    const scorecard = getWorkerScorecard('grok');
    return summarizeScorecard(
      scorecard,
      taskType,
      'review and breakthrough work only',
      false,
    );
  }

  if (
    taskType === 'routine_docs'
    || taskType === 'routine_smoke'
    || taskType === 'routine_ui'
    || taskType === 'routine_light_code'
  ) {
    const scorecard = getWorkerScorecard('gpt-5.4-mini');
    return summarizeScorecard(
      scorecard,
      taskType,
      'cheap-first default for routine/docs/smoke/UI/light code',
      false,
    );
  }

  if (taskType === 'implementation') {
    const scorecard = getWorkerScorecard('gpt-5.4');
    return summarizeScorecard(
      scorecard,
      taskType,
      'standard implementation fallback',
      false,
    );
  }

  if (/review|quality|acceptance/i.test(title)) {
    const scorecard = getWorkerScorecard('claude');
    return summarizeScorecard(
      scorecard,
      'final_review',
      'review-oriented task; Claude is optional final review',
      false,
    );
  }

  const scorecard = getWorkerScorecard('gpt-5.4-mini');
  return summarizeScorecard(
    scorecard,
    'routine_light_code',
    'default cheap-first fallback',
    false,
  );
}

function evaluateRequestedWorkerModel(modelId, task, context = {}) {
  const requested = String(modelId || '').trim();
  const scorecard = getWorkerScorecard(requested);
  const approvalReceived = context.approvalReceived === true;

  if (requested === 'gpt-5.5') {
    return {
      ...summarizeScorecard(
        scorecard,
        classifyTaskType(task, context),
        approvalReceived
          ? 'explicit human approval received for gpt-5.5'
          : 'gpt-5.5 blocked until explicit human approval',
        true,
      ),
      requestedModel: requested,
      allowed: approvalReceived,
      selectionBlocked: !approvalReceived,
    };
  }

  return {
    ...summarizeScorecard(scorecard, classifyTaskType(task, context), 'requested worker/model accepted', false),
    requestedModel: requested || scorecard.modelId,
    allowed: true,
    selectionBlocked: false,
  };
}

module.exports = {
  TOOL_META,
  DEFAULT_SCORECARDS,
  TYPE_HINTS,
  normalizeText,
  classifyTaskType,
  getDefaultScorecards,
  getWorkerScorecard,
  recommendWorkerForTask,
  evaluateRequestedWorkerModel,
};
