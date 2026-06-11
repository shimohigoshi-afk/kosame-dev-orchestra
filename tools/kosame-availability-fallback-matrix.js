#!/usr/bin/env node
'use strict';

/**
 * KOSAME Availability Fallback Matrix v110.56.0
 *
 * Worker/model が unavailable, rate-limited, unsafe, over-budget のときに
 * どこへ退避するかを決める軽量マトリクス。
 */

const scorecard = require('./kosame-worker-scorecard');

const TOOL_META = {
  version: '110.56.0',
  feature: 'v110-56-availability-fallback-matrix',
  slug: 'kosame-availability-fallback-matrix',
};

const WORKER_STATES = {
  healthy: 'healthy',
  rate_limited: 'rate_limited',
  unavailable: 'unavailable',
  unsafe_for_task: 'unsafe_for_task',
  over_budget: 'over_budget',
  human_gate_required: 'human_gate_required',
};

const ROUTE_CLASSES = {
  routine: 'routine',
  implementation: 'implementation',
  review: 'review',
  google: 'google',
  critical: 'critical',
};

const HUMAN = 'human_gate';
const MINI = 'gpt-5.4-mini';
const STANDARD = 'gpt-5.4';
const EXPENSIVE = 'gpt-5.5';
const DEEPSEEK = 'deepseek-chat';
const GEMINI = 'gemini-2.5-flash-lite';
const GROK = 'grok';
const CLAUDE = 'claude-sonnet-4-6';

const FALLBACK_MATRIX = {
  cheap: {
    routine: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [STANDARD, CLAUDE],
      unavailable: [STANDARD, CLAUDE],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  standard: {
    routine: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [CLAUDE, MINI],
      unavailable: [CLAUDE, MINI],
      unsafe_for_task: [CLAUDE, MINI],
      over_budget: [MINI, HUMAN],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [HUMAN],
      unavailable: [HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  expensive: {
    routine: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD],
      unsafe_for_task: [STANDARD],
      over_budget: [STANDARD],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  external_sanitized: {
    routine: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI, STANDARD],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [MINI, STANDARD],
      unavailable: [MINI, STANDARD],
      unsafe_for_task: [MINI, STANDARD],
      over_budget: [MINI, STANDARD],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [CLAUDE, STANDARD],
      unavailable: [STANDARD, CLAUDE],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  gemini: {
    routine: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI, STANDARD],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [STANDARD, MINI],
      unavailable: [STANDARD, MINI],
      unsafe_for_task: [STANDARD, MINI],
      over_budget: [STANDARD, MINI],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [CLAUDE, STANDARD],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [HUMAN],
      unavailable: [HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  grok: {
    routine: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI, STANDARD],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [STANDARD, MINI],
      unavailable: [STANDARD, MINI],
      unsafe_for_task: [STANDARD, MINI],
      over_budget: [STANDARD, MINI],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [CLAUDE, STANDARD],
      unavailable: [CLAUDE, STANDARD],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [HUMAN],
      unavailable: [HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [HUMAN],
      human_gate_required: [HUMAN],
    },
  },
  claude: {
    routine: {
      rate_limited: [MINI],
      unavailable: [MINI],
      unsafe_for_task: [MINI, STANDARD],
      over_budget: [MINI],
      human_gate_required: [HUMAN],
    },
    implementation: {
      rate_limited: [STANDARD, MINI],
      unavailable: [STANDARD, MINI],
      unsafe_for_task: [STANDARD, MINI],
      over_budget: [STANDARD, MINI],
      human_gate_required: [HUMAN],
    },
    review: {
      rate_limited: [STANDARD, MINI],
      unavailable: [STANDARD, MINI],
      unsafe_for_task: [STANDARD, MINI],
      over_budget: [STANDARD, MINI],
      human_gate_required: [HUMAN],
    },
    google: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [STANDARD, HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
    critical: {
      rate_limited: [STANDARD, HUMAN],
      unavailable: [STANDARD, HUMAN],
      unsafe_for_task: [HUMAN],
      over_budget: [STANDARD, HUMAN],
      human_gate_required: [HUMAN],
    },
  },
};

function normalizeWorkerState(state) {
  const normalized = String(state || WORKER_STATES.healthy).trim().toLowerCase();
  return WORKER_STATES[normalized] || WORKER_STATES.healthy;
}

function classifyRouteClass(taskType) {
  if (taskType === 'security' || taskType === 'ip_core') return ROUTE_CLASSES.critical;
  if (taskType === 'google_iam_caution') return ROUTE_CLASSES.google;
  if (taskType === 'final_review' || taskType === 'breakthrough_review') return ROUTE_CLASSES.review;
  if (String(taskType || '').startsWith('routine_')) return ROUTE_CLASSES.routine;
  if (taskType === 'implementation') return ROUTE_CLASSES.implementation;
  return ROUTE_CLASSES.implementation;
}

function scorecardFamilyFor(scorecardEntry) {
  const modelId = String(scorecardEntry?.modelId || '').toLowerCase();
  if (modelId === EXPENSIVE) return 'expensive';
  if (modelId === MINI) return 'cheap';
  if (modelId === STANDARD) return 'standard';
  if (modelId === DEEPSEEK) return 'external_sanitized';
  if (modelId === GEMINI) return 'gemini';
  if (modelId === GROK) return 'grok';
  if (modelId === CLAUDE) return 'claude';
  return scorecardEntry?.sanitizedOnly ? 'external_sanitized' : (scorecardEntry?.modelTier || 'standard');
}

function isSafeCandidate(candidateModelId, taskType, context = {}) {
  const approvalReceived = context.approvalReceived === true;
  if (candidateModelId === EXPENSIVE && !approvalReceived) return false;
  if (candidateModelId === DEEPSEEK && (taskType === 'security' || taskType === 'ip_core')) return false;
  return true;
}

function buildDecision({
  task,
  taskType,
  routeClass,
  currentCard,
  currentState,
  approvalReceived,
  candidates,
  reason,
}) {
  const fallbackChain = [];
  for (const candidateModelId of candidates) {
    if (candidateModelId === HUMAN) {
      fallbackChain.push({
        workerState: WORKER_STATES.human_gate_required,
        humanGateRequired: true,
        deliveryBlocked: true,
        canProceed: false,
        reason: 'all automated routes are unsafe',
      });
      return {
        version: TOOL_META.version,
        timestamp: new Date().toISOString(),
        taskType,
        routeClass,
        currentWorker: currentCard.workerName,
        currentModel: currentCard.modelId,
        currentState,
        approvalRequired: !!currentCard.approvalRequired,
        approvalReceived: !!approvalReceived,
        humanGateRequired: true,
        deliveryBlocked: true,
        canProceed: false,
        recommendedWorker: null,
        recommendedModelId: null,
        recommendedTier: null,
        sanitizedOnly: false,
        fallbackChain,
        reason: `${reason}; HUMAN_GATE_REQUIRED`,
        notes: 'all automated routes exhausted or unsafe',
      };
    }

    const candidateCard = scorecard.getWorkerScorecard(candidateModelId);
    if (!isSafeCandidate(candidateCard.modelId, taskType, { approvalReceived })) continue;

    const candidateFamily = scorecardFamilyFor(candidateCard);
    fallbackChain.push({
      workerName: candidateCard.workerName,
      modelId: candidateCard.modelId,
      modelTier: candidateCard.modelTier,
      workerState: currentState,
      approvalRequired: !!candidateCard.approvalRequired,
      sanitizedOnly: !!candidateCard.sanitizedOnly,
      recommendedUse: candidateCard.recommendedUse,
    });

    return {
      version: TOOL_META.version,
      timestamp: new Date().toISOString(),
      taskType,
      routeClass,
      currentWorker: currentCard.workerName,
      currentModel: currentCard.modelId,
      currentState,
      approvalRequired: !!candidateCard.approvalRequired,
      approvalReceived: !!approvalReceived,
      humanGateRequired: false,
      deliveryBlocked: false,
      canProceed: true,
      recommendedWorker: candidateCard.workerName,
      recommendedModelId: candidateCard.modelId,
      recommendedTier: candidateCard.modelTier,
      sanitizedOnly: !!candidateCard.sanitizedOnly,
      fallbackChain,
      reason: `${reason}; ${currentCard.modelId} → ${candidateCard.modelId}`,
      notes: candidateCard.recommendedUse,
      candidateFamily,
    };
  }

  return {
    version: TOOL_META.version,
    timestamp: new Date().toISOString(),
    taskType,
    routeClass,
    currentWorker: currentCard.workerName,
    currentModel: currentCard.modelId,
    currentState,
    approvalRequired: true,
    approvalReceived: !!approvalReceived,
    humanGateRequired: true,
    deliveryBlocked: true,
    canProceed: false,
    recommendedWorker: null,
    recommendedModelId: null,
    recommendedTier: null,
    sanitizedOnly: false,
    fallbackChain,
    reason: `${reason}; no safe automated fallback found`,
    notes: 'all automated routes exhausted or unsafe',
  };
}

function recommendAvailabilityFallback(task, currentWorkerOrModel, workerState = WORKER_STATES.healthy, context = {}) {
  const taskType = scorecard.classifyTaskType(task, context);
  const routeClass = classifyRouteClass(taskType);
  const currentCard = scorecard.getWorkerScorecard(currentWorkerOrModel || context.currentWorker || context.currentModel || context.selectedModel || MINI);
  const state = normalizeWorkerState(workerState || context.workerState);
  const approvalReceived = context.approvalReceived === true;
  const family = scorecardFamilyFor(currentCard);
  const matrix = FALLBACK_MATRIX[family] || FALLBACK_MATRIX.standard;
  const stateMatrix = matrix[routeClass] || matrix.implementation;
  const selectedCandidates = stateMatrix[state] || stateMatrix[WORKER_STATES.human_gate_required] || [HUMAN];

  if (state === WORKER_STATES.healthy) {
    if (family === 'expensive' && !approvalReceived) {
      return buildDecision({
        task,
        taskType,
        routeClass,
        currentCard,
        currentState: state,
        approvalReceived,
        candidates: [HUMAN],
        reason: 'gpt-5.5 requires explicit approval',
      });
    }
    return {
      version: TOOL_META.version,
      timestamp: new Date().toISOString(),
      taskType,
      routeClass,
      currentWorker: currentCard.workerName,
      currentModel: currentCard.modelId,
      currentState: state,
      approvalRequired: !!currentCard.approvalRequired,
      approvalReceived,
      humanGateRequired: false,
      deliveryBlocked: false,
      canProceed: true,
      recommendedWorker: currentCard.workerName,
      recommendedModelId: currentCard.modelId,
      recommendedTier: currentCard.modelTier,
      sanitizedOnly: !!currentCard.sanitizedOnly,
      fallbackChain: [{
        workerName: currentCard.workerName,
        modelId: currentCard.modelId,
        modelTier: currentCard.modelTier,
        workerState: state,
        approvalRequired: !!currentCard.approvalRequired,
        sanitizedOnly: !!currentCard.sanitizedOnly,
        recommendedUse: currentCard.recommendedUse,
      }],
      reason: 'worker healthy; no fallback needed',
      notes: currentCard.recommendedUse,
      candidateFamily: family,
    };
  }

  if (family === 'expensive' && !approvalReceived) {
    return buildDecision({
      task,
      taskType,
      routeClass,
      currentCard,
      currentState: state,
      approvalReceived,
      candidates: [HUMAN],
      reason: 'gpt-5.5 requires explicit approval',
    });
  }

  return buildDecision({
    task,
    taskType,
    routeClass,
    currentCard,
    currentState: state,
    approvalReceived,
    candidates: selectedCandidates,
    reason: `state=${state}`,
  });
}

function isHealthyFallbackAllowed(task, currentWorkerOrModel, context = {}) {
  const result = recommendAvailabilityFallback(task, currentWorkerOrModel, WORKER_STATES.healthy, context);
  return !result.humanGateRequired;
}

module.exports = {
  TOOL_META,
  WORKER_STATES,
  ROUTE_CLASSES,
  FALLBACK_MATRIX,
  normalizeWorkerState,
  classifyRouteClass,
  recommendAvailabilityFallback,
  isHealthyFallbackAllowed,
};
