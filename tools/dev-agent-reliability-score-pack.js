'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Agent Reliability Score Pack',
  slug: 'dev-agent-reliability-score-pack'
};

const SCORE_BANDS = {
  STRONG:     'STRONG',
  OK:         'OK',
  LIMITED:    'LIMITED',
  AVOID:      'AVOID',
  HUMAN_GATE: 'HUMAN_GATE'
};

const PROVIDER_TASK_BASELINES = {
  claude_code: {
    implementation:   85,
    code_repair:      80,
    long_preprocessing: 40,
    pm_decision:      20,
    log_summarization: 50
  },
  gemini: {
    long_preprocessing: 90,
    bulk_work:        88,
    implementation:   60,
    pm_decision:      30,
    log_summarization: 85
  },
  gpt: {
    log_summarization: 80,
    format_commands:  85,
    prompt_cleaning:  82,
    error_explanation: 80,
    pm_decision:      15,
    implementation:   55,
    task_ordering:    10
  },
  grok: {
    breakthrough:     78,
    stuck_state:      75,
    implementation:   55,
    pm_decision:      25
  },
  deepseek: {
    sanitized_advisory: 40,
    implementation:   20,
    pm_decision:      5
  },
  kimi: {
    sanitized_advisory: 38,
    implementation:   20,
    pm_decision:      5
  },
  human: {
    irreversible_approval: 100,
    routine_implementation: 0
  }
};

const PENALTIES = {
  recent_failure:          -8,
  verify_failed:           -12,
  smoke_failed:            -10,
  detour_detected:         -20,
  conservative_brake:      -18,
  context_overload:        -15,
  cost_risk_high:          -10,
  data_risk_high:          -25,
  unsafe_external_handoff: -30
};

function scoreReliability(input) {
  const {
    provider               = 'claude_code',
    taskType               = 'implementation',
    recentFailures         = 0,
    verifyPassed           = true,
    smokePassed            = true,
    detourDetected         = false,
    conservativeBrakeDetected = false,
    contextOverloadDetected  = false,
    costRisk               = 'low',
    dataRisk               = 'low'
  } = input || {};

  const baselines = PROVIDER_TASK_BASELINES[provider];
  const baseScore = baselines ? (baselines[taskType] || 50) : 30;

  let score = baseScore;
  const reasons = [];

  if (recentFailures > 0) {
    score += PENALTIES.recent_failure * Math.min(recentFailures, 3);
    reasons.push(`recent_failures: ${recentFailures}`);
  }
  if (!verifyPassed) {
    score += PENALTIES.verify_failed;
    reasons.push('verify_failed');
  }
  if (!smokePassed) {
    score += PENALTIES.smoke_failed;
    reasons.push('smoke_failed');
  }
  if (detourDetected) {
    score += PENALTIES.detour_detected;
    reasons.push('detour_detected — task order changed without approval');
  }
  if (conservativeBrakeDetected) {
    score += PENALTIES.conservative_brake;
    reasons.push('conservative_brake_detected — unnecessary halt');
  }
  if (contextOverloadDetected) {
    score += PENALTIES.context_overload;
    reasons.push('context_overload — prefer snapshot or Gemini preprocessing');
  }
  if (costRisk === 'high') {
    score += PENALTIES.cost_risk_high;
    reasons.push('cost_risk_high');
  }
  if (dataRisk === 'high') {
    score += PENALTIES.data_risk_high;
    reasons.push('data_risk_high');
  }

  const isExternalRisk = ['deepseek', 'kimi'].includes(provider);
  if (isExternalRisk && dataRisk !== 'low') {
    score += PENALTIES.unsafe_external_handoff;
    reasons.push('unsafe_external_handoff_risk');
  }

  score = Math.max(0, Math.min(100, score));

  const band = deriveBand(provider, taskType, score);
  const { shouldUse, shouldFallback, recommendedRole } = deriveRecommendation(provider, taskType, band);

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    provider,
    taskType,
    reliabilityScore: score,
    scoreBand: band,
    recommendedRole,
    shouldUse,
    shouldFallback,
    reasons
  };
}

function deriveBand(provider, taskType, score) {
  if (provider === 'human') return SCORE_BANDS.HUMAN_GATE;
  if (['deepseek', 'kimi'].includes(provider) && taskType !== 'sanitized_advisory') return SCORE_BANDS.AVOID;
  if (score >= 75) return SCORE_BANDS.STRONG;
  if (score >= 55) return SCORE_BANDS.OK;
  if (score >= 35) return SCORE_BANDS.LIMITED;
  return SCORE_BANDS.AVOID;
}

function deriveRecommendation(provider, taskType, band) {
  if (band === SCORE_BANDS.HUMAN_GATE) {
    return { shouldUse: true, shouldFallback: false, recommendedRole: 'approval_owner_only' };
  }
  if (band === SCORE_BANDS.AVOID) {
    return { shouldUse: false, shouldFallback: true, recommendedRole: 'do_not_use_for_this_task' };
  }
  if (band === SCORE_BANDS.LIMITED) {
    return { shouldUse: true, shouldFallback: false, recommendedRole: `limited_use_${taskType}` };
  }
  return { shouldUse: true, shouldFallback: false, recommendedRole: `${provider}_${taskType}` };
}

function main() {
  const result = scoreReliability({ provider: 'claude_code', taskType: 'implementation' });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SCORE_BANDS,
  PROVIDER_TASK_BASELINES,
  PENALTIES,
  scoreReliability,
  deriveBand,
  deriveRecommendation
};
