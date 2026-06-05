'use strict';

const TOOL_META = {
  version: '110.1.0',
  title: 'AI Fallback Router Pack',
  slug: 'dev-agent-ai-fallback-router-pack'
};

// Normal OS route: GPT/KOSAME → Gemini → Claude → GPT/KOSAME review → Human approval (irreversible only)
const PRIMARY_ROUTE = {
  design:         'gpt-kosame',
  bulkWork:       'gemini',
  refinement:     'claude',
  review:         'gpt-kosame',
  finalApproval:  'human'
};

// When a primary provider fails, route to these alternatives
const FALLBACK_ROUTES = {
  gemini: ['grok', 'gpt'],
  claude: ['gpt', 'grok', 'gemini'],
  gpt:    ['gemini', 'grok'],   // advisory only — final decision pending human/KOSAME
  all:    ['deepseek', 'kimi']  // last-resort sanitized advisory only
};

const BLOCKED_FINAL_DECISION_PROVIDERS = ['deepseek', 'kimi'];

const BLOCKED_SENSITIVE_OPERATIONS = [
  'secret', 'customer_data', 'deploy', 'push', 'tag',
  'billing', 'production', 'commit', 'insurance_data', 'health_data'
];

function buildRoute(input) {
  const { failedProvider = null, reason = null } = input || {};

  const providerFailureReasons = {};
  let fallbackRoutes = [];

  if (failedProvider) {
    providerFailureReasons[failedProvider] = reason || 'provider unavailable';
    fallbackRoutes = FALLBACK_ROUTES[failedProvider] || FALLBACK_ROUTES.all;
  }

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired: true,
    primaryRoute: PRIMARY_ROUTE,
    fallbackRoutes,
    providerFailureReasons,
    allowedFallbackProviders: ['gpt', 'gpt-kosame', 'gemini', 'claude', 'grok'],
    blockedFallbackProviders: BLOCKED_FINAL_DECISION_PROVIDERS,
    finalDecisionPolicy: {
      deepseekAllowedFinalDecision: false,
      kimiAllowedFinalDecision: false,
      humanMustApproveIrreversible: true,
      blockedOperations: BLOCKED_SENSITIVE_OPERATIONS
    }
  };
}

function evaluateFailover(input) {
  const {
    failedProvider = '',
    requestedFallback = '',
    operation = ''
  } = input || {};

  const fallback = requestedFallback.toLowerCase();
  const op      = operation.toLowerCase();

  const isBlocked    = BLOCKED_FINAL_DECISION_PROVIDERS.includes(fallback);
  const isSensitive  = BLOCKED_SENSITIVE_OPERATIONS.some(s => op.includes(s));

  if (isBlocked && isSensitive) {
    return {
      allowed: false,
      reason: `${requestedFallback} cannot handle sensitive operation: ${operation}`,
      humanApprovalRequired: true,
      advisoryOnly: false,
      mustSanitize: true
    };
  }

  if (isBlocked) {
    return {
      allowed: false,
      reason: `${requestedFallback} is blocked as a final-decision provider`,
      humanApprovalRequired: true,
      advisoryOnly: true,
      mustSanitize: true
    };
  }

  const validFallbacks = FALLBACK_ROUTES[failedProvider] || [];
  const isFallbackValid = validFallbacks.includes(fallback);

  return {
    allowed: isFallbackValid,
    reason: isFallbackValid
      ? 'fallback provider is on the approved route'
      : `${requestedFallback} is not a defined fallback for ${failedProvider}`,
    humanApprovalRequired: true,
    advisoryOnly: false,
    mustSanitize: false
  };
}

function main() {
  const route = buildRoute({ failedProvider: null });
  console.log(JSON.stringify(route, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRIMARY_ROUTE,
  FALLBACK_ROUTES,
  BLOCKED_FINAL_DECISION_PROVIDERS,
  BLOCKED_SENSITIVE_OPERATIONS,
  buildRoute,
  evaluateFailover
};
