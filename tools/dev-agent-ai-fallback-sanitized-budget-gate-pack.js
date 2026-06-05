'use strict';

const TOOL_META = {
  version: '110.1.0',
  title: 'AI Fallback / Sanitized Handoff / Budget Guard Gate Pack',
  slug: 'dev-agent-ai-fallback-sanitized-budget-gate-pack'
};

const { buildRoute, evaluateFailover, BLOCKED_FINAL_DECISION_PROVIDERS } = require('./dev-agent-ai-fallback-router-pack');
const { evaluateHandoff } = require('./dev-agent-sanitized-handoff-guard-pack');
const { evaluateBudget, DEFAULT_THRESHOLDS } = require('./dev-agent-budget-governor-pack');

const GATE_STATUSES = [
  'READY',
  'NEEDS_HUMAN_APPROVAL',
  'BLOCKED_UNSANITIZED_HANDOFF',
  'BLOCKED_BUDGET',
  'BLOCKED_DANGEROUS_ACTION'
];

function runGate(input) {
  const {
    failedProvider    = null,
    requestedFallback = null,
    targetProvider    = null,
    sanitized         = true,
    contentTypes      = [],
    operation         = '',
    spentJpy          = 0,
    requestedModel    = '',
    thresholds        = DEFAULT_THRESHOLDS,
    isDangerousAction = false
  } = input || {};

  // Gate 1: dangerous action always blocked
  if (isDangerousAction) {
    return _result('BLOCKED_DANGEROUS_ACTION', {
      blockedReason: 'Dangerous action denied by OS policy — no override permitted',
      humanApprovalRequired: true
    }, input);
  }

  // Gate 2: sanitized handoff guard
  const handoffTarget = targetProvider || requestedFallback;
  let handoffResult = null;
  if (handoffTarget) {
    handoffResult = evaluateHandoff({ targetProvider: handoffTarget, sanitized, contentTypes });
    if (handoffResult.blocked) {
      return _result('BLOCKED_UNSANITIZED_HANDOFF', {
        blockedReason: handoffResult.blockedReasons.join('; '),
        humanApprovalRequired: true,
        handoffResult
      }, input);
    }
  }

  // Gate 3: budget governor
  const budgetResult = evaluateBudget({ spentJpy, requestedModel, thresholds, operationLabel: operation });
  const budgetBlocked = !budgetResult.escalationAllowed && budgetResult.budgetStatus !== 'OK';
  if (budgetBlocked) {
    return _result('BLOCKED_BUDGET', {
      blockedReason: budgetResult.approvalMessage,
      humanApprovalRequired: true,
      budgetResult
    }, input);
  }

  // Gate 4: fallback route validation
  const routeResult = buildRoute({ failedProvider, reason: failedProvider ? `${failedProvider} failed` : null });
  const failoverResult = (failedProvider && requestedFallback)
    ? evaluateFailover({ failedProvider, requestedFallback, operation })
    : null;

  // Determine if human approval is still required (external risk provider or expensive model)
  const externalRiskHandoff = handoffTarget
    && BLOCKED_FINAL_DECISION_PROVIDERS.includes((handoffTarget || '').toLowerCase());
  const needsHumanApproval = budgetResult.humanApprovalRequired || externalRiskHandoff;

  const status = needsHumanApproval ? 'NEEDS_HUMAN_APPROVAL' : 'READY';

  return _result(status, {
    routeResult,
    failoverResult,
    handoffResult,
    budgetResult,
    humanApprovalRequired: true  // always true for any non-trivial gate evaluation
  }, input);
}

function _result(status, details, input) {
  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired: true,
    status,
    ...details,
    inputSummary: {
      failedProvider:    (input || {}).failedProvider    || null,
      requestedFallback: (input || {}).requestedFallback || null,
      targetProvider:    (input || {}).targetProvider    || null,
      operation:         (input || {}).operation         || null,
      requestedModel:    (input || {}).requestedModel    || null,
      sanitized:         (input || {}).sanitized         !== undefined ? (input || {}).sanitized : null
    }
  };
}

function main() {
  const result = runGate({
    failedProvider:    'gemini',
    requestedFallback: 'grok',
    targetProvider:    null,
    sanitized:         true,
    contentTypes:      [],
    operation:         'bulk-code-review',
    spentJpy:          500,
    requestedModel:    'gemini-flash',
    isDangerousAction: false
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  GATE_STATUSES,
  runGate,
  _result
};
