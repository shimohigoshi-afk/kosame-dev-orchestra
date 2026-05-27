/**
 * Provider Health Status v2.1.0
 *
 * Manages provider availability states and generates routing recommendations.
 */

const PROVIDER_STATES = {
  GEMINI_AVAILABLE: 'gemini_available',
  GEMINI_QUOTA_EXHAUSTED: 'gemini_quota_exhausted',
  GEMINI_AUTH_ERROR: 'gemini_auth_error',
  GEMINI_NEEDS_FALLBACK: 'gemini_needs_fallback',
  CLAUDE_AVAILABLE: 'claude_available',
  CLOUD_SHELL_VERIFY_REQUIRED: 'cloud_shell_verify_required',
  GITHUB_ACTIONS_PENDING: 'github_actions_pending',
  GITHUB_ACTIONS_SUCCESS: 'github_actions_success',
  APPROVAL_REQUIRED: 'approval_required'
};

const GEMINI_FALLBACK_TRIGGERS = [
  'QUOTA_EXHAUSTED',
  'timeout',
  'confirmation_stopped',
  'shell_tool_missing',
  'auth_error',
  'metadata_server_error',
  'refresh_token_error',
  'no_completion_report',
  'version_not_updated',
  'no_response_10min'
];

function createProviderHealthSnapshot(overrides = {}) {
  return {
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    gemini: overrides.gemini || PROVIDER_STATES.GEMINI_AVAILABLE,
    claude: overrides.claude || PROVIDER_STATES.CLAUDE_AVAILABLE,
    cloudShell: overrides.cloudShell || PROVIDER_STATES.CLOUD_SHELL_VERIFY_REQUIRED,
    githubActions: overrides.githubActions || PROVIDER_STATES.GITHUB_ACTIONS_PENDING,
    approvalGate: overrides.approvalGate || PROVIDER_STATES.APPROVAL_REQUIRED,
    dryRun: true
  };
}

function getRoutingRecommendation(healthSnapshot) {
  const { gemini, githubActions, approvalGate } = healthSnapshot;

  if (
    gemini === PROVIDER_STATES.GEMINI_QUOTA_EXHAUSTED ||
    gemini === PROVIDER_STATES.GEMINI_AUTH_ERROR ||
    gemini === PROVIDER_STATES.GEMINI_NEEDS_FALLBACK
  ) {
    return {
      primaryProvider: 'claude',
      fallbackReason: gemini,
      recommendation: 'Use Claude as primary. Generate fallback routing packet.',
      requiresHandoff: true
    };
  }

  if (gemini === PROVIDER_STATES.GEMINI_AVAILABLE) {
    return {
      primaryProvider: 'gemini',
      fallbackReason: null,
      recommendation: 'Gemini is available. Proceed with Gemini as primary.',
      requiresHandoff: false
    };
  }

  if (githubActions === PROVIDER_STATES.GITHUB_ACTIONS_PENDING) {
    return {
      primaryProvider: 'wait',
      fallbackReason: 'github_actions_pending',
      recommendation: 'Wait for GitHub Actions to complete.',
      requiresHandoff: false
    };
  }

  if (approvalGate === PROVIDER_STATES.APPROVAL_REQUIRED) {
    return {
      primaryProvider: 'human',
      fallbackReason: 'approval_required',
      recommendation: 'Generate approval packet for じゅんやさん.',
      requiresHandoff: false
    };
  }

  return {
    primaryProvider: 'claude',
    fallbackReason: 'default',
    recommendation: 'Default to Claude.',
    requiresHandoff: false
  };
}

function classifyGeminiFallbackTrigger(errorDescription) {
  if (!errorDescription) return null;
  const lower = errorDescription.toLowerCase();

  if (lower.includes('quota') || lower.includes('exhausted')) return 'QUOTA_EXHAUSTED';
  if (lower.includes('refresh_token') || lower.includes('token')) return 'refresh_token_error';
  if (lower.includes('metadata server') || lower.includes('application default')) return 'metadata_server_error';
  if (lower.includes('auth') || lower.includes('credential')) return 'auth_error';
  if (lower.includes('timeout') || lower.includes('no response')) return 'timeout';
  if (lower.includes('shell') || lower.includes('tool')) return 'shell_tool_missing';
  if (lower.includes('confirmation') || lower.includes('stopped')) return 'confirmation_stopped';
  if (lower.includes('version') || lower.includes('package')) return 'version_not_updated';
  if (lower.includes('complete') || lower.includes('report')) return 'no_completion_report';

  return 'no_response_10min';
}

module.exports = {
  PROVIDER_STATES,
  GEMINI_FALLBACK_TRIGGERS,
  createProviderHealthSnapshot,
  getRoutingRecommendation,
  classifyGeminiFallbackTrigger
};

if (require.main === module) {
  const authErrorSnapshot = createProviderHealthSnapshot({
    gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR
  });
  const recommendation = getRoutingRecommendation(authErrorSnapshot);
  console.log(JSON.stringify({ snapshot: authErrorSnapshot, recommendation }, null, 2));
}
