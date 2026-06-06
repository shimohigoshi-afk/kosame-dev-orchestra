'use strict';

const TOOL_META = {
  version: '110.8.0',
  title: 'Claude Timeout Fallback Router',
  slug: 'claude-timeout-fallback-router'
};

// Ordered fallback chain when Claude times out
const CLAUDE_TIMEOUT_FALLBACK_CHAIN = ['grok', 'gpt'];

// Providers that cannot make final decisions (advisory-only, must be sanitized)
const ADVISORY_ONLY_PROVIDERS = ['deepseek', 'kimi'];

// Default timeout threshold (ms) for Claude to be considered timed-out
const DEFAULT_TIMEOUT_MS = 30000;

// Operations that require human approval even after successful fallback
const HUMAN_APPROVAL_OPERATIONS = [
  'deploy', 'push', 'tag', 'commit', 'production',
  'billing', 'secret', 'customer_data', 'insurance_data', 'health_data'
];

function detectTimeout(input) {
  const {
    provider = 'claude',
    elapsedMs = 0,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    errorCode = null,
    errorMessage = ''
  } = input || {};

  const timedOutByDuration = elapsedMs >= timeoutMs;
  const timedOutByError = errorCode === 'ETIMEDOUT' || errorCode === 'ECONNABORTED'
    || /timeout/i.test(errorMessage);

  const timedOut = timedOutByDuration || timedOutByError;

  return {
    provider,
    elapsedMs,
    timeoutMs,
    timedOut,
    detectionMethod: timedOutByDuration
      ? 'duration'
      : timedOutByError
        ? 'error_code'
        : 'none'
  };
}

function buildFallbackPlan(input) {
  const {
    timedOutProvider = 'claude',
    operation = '',
    attemptedFallbacks = [],
    dryRun = true
  } = input || {};

  const remaining = CLAUDE_TIMEOUT_FALLBACK_CHAIN.filter(
    p => !attemptedFallbacks.includes(p)
  );
  const nextFallback = remaining[0] || null;
  const exhausted = remaining.length === 0;

  const op = operation.toLowerCase();
  const requiresHumanApproval = HUMAN_APPROVAL_OPERATIONS.some(o => op.includes(o));

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    timedOutProvider,
    fallbackChain: CLAUDE_TIMEOUT_FALLBACK_CHAIN,
    attemptedFallbacks,
    nextFallback,
    remainingFallbacks: remaining,
    exhausted,
    operation,
    requiresHumanApproval: requiresHumanApproval || exhausted,
    humanApprovalRequired: true,
    advisoryOnlyProviders: ADVISORY_ONLY_PROVIDERS,
    escalationPolicy: {
      onExhaustion: 'escalate_to_human',
      allowAdvisoryFromDeepseekKimi: false,
      finalDecisionProvider: exhausted ? null : nextFallback
    }
  };
}

function evaluateFallback(input) {
  const {
    timedOutProvider = 'claude',
    proposedFallback = '',
    operation = '',
    attemptedFallbacks = []
  } = input || {};

  const fallback = proposedFallback.toLowerCase();
  const isAdvisoryOnly = ADVISORY_ONLY_PROVIDERS.includes(fallback);
  const isInChain = CLAUDE_TIMEOUT_FALLBACK_CHAIN.includes(fallback);
  const alreadyAttempted = attemptedFallbacks.includes(fallback);
  const op = operation.toLowerCase();
  const isSensitiveOp = HUMAN_APPROVAL_OPERATIONS.some(o => op.includes(o));

  if (alreadyAttempted) {
    return {
      allowed: false,
      reason: `${proposedFallback} was already attempted`,
      humanApprovalRequired: true,
      advisoryOnly: false
    };
  }

  if (isAdvisoryOnly) {
    return {
      allowed: false,
      reason: `${proposedFallback} is advisory-only and cannot replace Claude as final-decision provider`,
      humanApprovalRequired: true,
      advisoryOnly: true,
      mustSanitize: true
    };
  }

  if (!isInChain) {
    return {
      allowed: false,
      reason: `${proposedFallback} is not in the Claude timeout fallback chain`,
      humanApprovalRequired: true,
      advisoryOnly: false
    };
  }

  return {
    allowed: true,
    reason: `${proposedFallback} is valid next fallback for timed-out ${timedOutProvider}`,
    humanApprovalRequired: isSensitiveOp,
    advisoryOnly: false,
    mustSanitize: false
  };
}

function main() {
  const detection = detectTimeout({ provider: 'claude', elapsedMs: 35000 });
  console.log('[detectTimeout]');
  console.log(JSON.stringify(detection, null, 2));

  const plan = buildFallbackPlan({
    timedOutProvider: 'claude',
    operation: 'code-review',
    attemptedFallbacks: []
  });
  console.log('\n[buildFallbackPlan]');
  console.log(JSON.stringify(plan, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  CLAUDE_TIMEOUT_FALLBACK_CHAIN,
  ADVISORY_ONLY_PROVIDERS,
  DEFAULT_TIMEOUT_MS,
  HUMAN_APPROVAL_OPERATIONS,
  detectTimeout,
  buildFallbackPlan,
  evaluateFallback
};
