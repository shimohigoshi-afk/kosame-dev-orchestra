'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Model Escalation Ladder Pack',
  slug: 'dev-agent-model-escalation-ladder-pack'
};

const TIERS = {
  CHEAP_DEFAULT:       'cheap_default',
  STANDARD:            'standard',
  HIGHER_TIER:         'higher_tier',
  PREMIUM_LAST_RESORT: 'premium_last_resort'
};

const ESCALATION_REASONS = {
  NONE:                    'none — routine work, no escalation needed',
  CONTEXT_TOO_LARGE:       'context_too_large — prefer snapshot/split/Gemini preprocessing first',
  PROVIDER_TIMEOUT:        'provider_timeout — prefer fallback provider before escalation',
  REPEATED_CODE_REPAIR:    'repeated_code_repair — higher tier allowed with human approval',
  BUDGET_NEAR_CAP:         'budget_near_cap — escalation blocked or warned',
  BUDGET_OVER_CAP:         'budget_over_cap — escalation blocked',
  AMBIGUOUS_OUTPUT:        'ambiguous_output — try different provider before escalating tier'
};

const BLOCKED_MODELS = ['openai_o1_max', 'claude_max_unlimited', 'gemini_ultra_max_quota'];

function evaluateEscalation(input) {
  const {
    currentTier      = TIERS.CHEAP_DEFAULT,
    issueType        = 'none',
    budgetUsedPct    = 0,
    budgetCapPct     = 100,
    repeatFailCount  = 0
  } = input || {};

  const budgetNearCap = budgetUsedPct >= budgetCapPct * 0.85;
  const budgetOverCap = budgetUsedPct >= budgetCapPct;

  if (issueType === 'none' || issueType === 'routine') {
    return _result(currentTier, currentTier, ESCALATION_REASONS.NONE, false, false, null, [], false);
  }

  if (budgetOverCap) {
    return _result(currentTier, currentTier, ESCALATION_REASONS.BUDGET_OVER_CAP, false, false,
      'Budget over cap — escalation blocked', [], true);
  }

  if (issueType === 'context_too_large') {
    return _result(currentTier, currentTier, ESCALATION_REASONS.CONTEXT_TOO_LARGE, false, false,
      null, ['use_failure_snapshot', 'split_input', 'gemini_preprocessing'], budgetNearCap);
  }

  if (issueType === 'provider_timeout') {
    return _result(currentTier, currentTier, ESCALATION_REASONS.PROVIDER_TIMEOUT, false, false,
      null, ['try_fallback_provider_first'], budgetNearCap);
  }

  if (issueType === 'repeated_code_repair' && repeatFailCount >= 2) {
    const nextTier = _nextTier(currentTier);
    const allowed  = !budgetOverCap;
    return _result(currentTier, nextTier, ESCALATION_REASONS.REPEATED_CODE_REPAIR, allowed, allowed,
      allowed ? `Human approval required to escalate to ${nextTier}` : 'Budget cap — escalation blocked',
      ['verify_failure_snapshot_first'], budgetNearCap);
  }

  if (issueType === 'ambiguous_output') {
    return _result(currentTier, currentTier, ESCALATION_REASONS.AMBIGUOUS_OUTPUT, false, false,
      null, ['try_different_provider', 'use_grok_for_breakthrough'], budgetNearCap);
  }

  if (budgetNearCap) {
    return _result(currentTier, currentTier, ESCALATION_REASONS.BUDGET_NEAR_CAP, false, true,
      'Budget near cap — escalation requires human approval', [], true);
  }

  return _result(currentTier, currentTier, 'no_escalation_condition_matched', false, false, null, [], false);
}

function _nextTier(current) {
  const order = [TIERS.CHEAP_DEFAULT, TIERS.STANDARD, TIERS.HIGHER_TIER, TIERS.PREMIUM_LAST_RESORT];
  const idx = order.indexOf(current);
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : TIERS.PREMIUM_LAST_RESORT;
}

function _result(currentTier, recommendedTier, escalationReason, escalationAllowed, humanApprovalRequired, approvalMessage, cheaperAlternatives, budgetGuardApplied) {
  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    currentTier,
    recommendedTier,
    escalationReason,
    escalationAllowed,
    humanApprovalRequired,
    approvalMessage,
    cheaperAlternatives,
    blockedModels: BLOCKED_MODELS,
    budgetGuardApplied
  };
}

function main() {
  const result = evaluateEscalation({ currentTier: TIERS.CHEAP_DEFAULT, issueType: 'none' });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  TIERS,
  ESCALATION_REASONS,
  BLOCKED_MODELS,
  evaluateEscalation
};
