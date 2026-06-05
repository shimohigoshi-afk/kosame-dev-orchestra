'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Quality Control Complete Gate Pack',
  slug: 'dev-agent-quality-control-complete-gate-pack'
};

const { checkHealth, STATUSES }    = require('./dev-agent-provider-health-check-pack.js');
const { evaluateEscalation, TIERS } = require('./dev-agent-model-escalation-ladder-pack.js');
const { runRedactionTest }          = require('./dev-agent-redaction-test-pack.js');
const { scoreReliability, SCORE_BANDS } = require('./dev-agent-reliability-score-pack.js');
const { measureBurden, BURDEN_BANDS }   = require('./dev-agent-human-burden-meter-pack.js');

const GATE_DECISIONS = {
  QUALITY_READY:               'QUALITY_READY',
  USE_DEFAULT_ROUTE:           'USE_DEFAULT_ROUTE',
  USE_FALLBACK_ROUTE:          'USE_FALLBACK_ROUTE',
  ESCALATION_NEEDS_APPROVAL:   'ESCALATION_NEEDS_APPROVAL',
  BLOCKED_REDACTION_FAILED:    'BLOCKED_REDACTION_FAILED',
  BLOCKED_PROVIDER_UNHEALTHY:  'BLOCKED_PROVIDER_UNHEALTHY',
  HUMAN_BURDEN_TOO_HIGH:       'HUMAN_BURDEN_TOO_HIGH',
  HUMAN_GATE_REQUIRED:         'HUMAN_GATE_REQUIRED'
};

function classifyQuality(input) {
  const {
    provider           = 'claude_code',
    taskType           = 'implementation',
    redactionInput     = null,
    escalationInput    = null,
    burdenInput        = null,
    reliabilityInput   = null,
    dangerGateActive   = false
  } = input || {};

  const health       = checkHealth({ provider });
  const reliability  = scoreReliability({ provider, taskType, ...(reliabilityInput || {}) });
  const burden       = measureBurden({ ...(burdenInput || {}), dangerGateActive });
  const escalation   = evaluateEscalation(escalationInput || { currentTier: TIERS.CHEAP_DEFAULT, issueType: 'none' });
  const redaction    = redactionInput ? runRedactionTest(redactionInput) : null;

  const reasons = [];

  // Danger gate
  if (dangerGateActive) {
    return _decision(GATE_DECISIONS.HUMAN_GATE_REQUIRED,
      'Danger gate active — human approval required',
      true, health, reliability, burden, escalation, redaction);
  }

  // Provider unhealthy
  if (health.status === STATUSES.UNAVAILABLE) {
    return _decision(GATE_DECISIONS.BLOCKED_PROVIDER_UNHEALTHY,
      `Provider ${provider} is unavailable`,
      true, health, reliability, burden, escalation, redaction);
  }

  // Redaction failed
  if (redaction && !redaction.redactionPassed) {
    return _decision(GATE_DECISIONS.BLOCKED_REDACTION_FAILED,
      `Redaction failed: ${redaction.blockedReasons.join('; ')}`,
      true, health, reliability, burden, escalation, redaction);
  }

  // Burden too high
  if (burden.burdenBand === BURDEN_BANDS.TOO_MUCH) {
    return _decision(GATE_DECISIONS.HUMAN_BURDEN_TOO_HIGH,
      'Human burden too high — compress confirmations and use gate-supervised autopilot',
      false, health, reliability, burden, escalation, redaction);
  }

  // Escalation needs approval
  if (escalation.escalationAllowed && escalation.humanApprovalRequired) {
    return _decision(GATE_DECISIONS.ESCALATION_NEEDS_APPROVAL,
      escalation.approvalMessage || 'Escalation requires human approval',
      true, health, reliability, burden, escalation, redaction);
  }

  // Provider is HOLD (deepseek/kimi without sanitized handoff route)
  if (health.status === STATUSES.HOLD) {
    return _decision(GATE_DECISIONS.BLOCKED_PROVIDER_UNHEALTHY,
      `Provider ${provider} is on HOLD — sanitized handoff required`,
      true, health, reliability, burden, escalation, redaction);
  }

  // GPT PM/judge role — downgrade to limited
  if (provider === 'gpt' && ['pm_decision', 'task_ordering'].includes(taskType)) {
    return _decision(GATE_DECISIONS.USE_FALLBACK_ROUTE,
      'GPT PM/judge role is not allowed — redirect to execution assistant tasks or use gemini/claude',
      false, health, reliability, burden, escalation, redaction);
  }

  // Reliability too low
  if (reliability.scoreBand === SCORE_BANDS.AVOID) {
    return _decision(GATE_DECISIONS.USE_FALLBACK_ROUTE,
      `Reliability score too low for ${provider}:${taskType} — use fallback`,
      false, health, reliability, burden, escalation, redaction);
  }

  // Healthy default route
  if (health.status === STATUSES.HEALTHY && reliability.scoreBand === SCORE_BANDS.STRONG) {
    return _decision(GATE_DECISIONS.QUALITY_READY,
      `${provider} is healthy and strong for ${taskType}`,
      false, health, reliability, burden, escalation, redaction);
  }

  return _decision(GATE_DECISIONS.USE_DEFAULT_ROUTE,
    `${provider} is operational for ${taskType}`,
    false, health, reliability, burden, escalation, redaction);
}

function _decision(gateDecision, reason, humanApprovalRequired, health, reliability, burden, escalation, redaction) {
  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    gateDecision,
    reason,
    humanApprovalRequired,
    shouldAskUser: humanApprovalRequired,
    shouldProceedAutomatically: !humanApprovalRequired,
    providerHealth: health,
    reliabilityScore: reliability,
    burdenMeter: burden,
    escalationLadder: escalation,
    redactionTest: redaction
  };
}

function main() {
  const result = classifyQuality({ provider: 'claude_code', taskType: 'implementation' });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  GATE_DECISIONS,
  classifyQuality
};
