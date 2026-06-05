'use strict';

const TOOL_META = {
  version: '110.3.0',
  title: 'Provider Health Check Pack',
  slug: 'dev-agent-provider-health-check-pack'
};

const STATUSES = {
  HEALTHY:          'HEALTHY',
  DEGRADED:         'DEGRADED',
  UNAVAILABLE:      'UNAVAILABLE',
  HOLD:             'HOLD',
  HUMAN_GATE_ONLY:  'HUMAN_GATE_ONLY'
};

const PROVIDER_DEFAULTS = {
  claude_code: {
    role: 'implementation',
    status: STATUSES.HEALTHY,
    recommendedUse: ['local_tool_creation', 'smoke_test_writing', 'code_repair', 'fixture_creation', 'doc_writing'],
    blockedUse: ['receive_full_logs', 'bulk_preprocessing', 'receive_raw_large_context'],
    requiresHumanApproval: false,
    healthReasons: ['context_load_must_be_guarded', 'use_failure_snapshot_or_summarized_context'],
    lastKnownFailureType: null,
    fallbackProvider: 'gpt'
  },
  gemini: {
    role: 'long_preprocessing',
    status: STATUSES.HEALTHY,
    recommendedUse: ['bulk_preprocessing', 'long_input_reading', 'large_log_summarization', 'context_reduction'],
    blockedUse: ['final_irreversible_decision', 'secret_access', 'customer_data_access'],
    requiresHumanApproval: false,
    healthReasons: ['preferred_for_long_inputs_before_claude'],
    lastKnownFailureType: null,
    fallbackProvider: 'grok'
  },
  gpt: {
    role: 'execution_assistant',
    status: STATUSES.DEGRADED,
    recommendedUse: ['summarize_logs', 'format_commands', 'clean_prompts', 'explain_errors', 'classify_small_text', 'prepare_handoff_snippets'],
    blockedUse: ['decide_task_order', 'change_agreed_sequence', 'act_as_pm', 'act_as_court_or_judge', 'suggest_detour'],
    requiresHumanApproval: false,
    healthReasons: ['gpt_is_execution_assistant_only', 'pm_court_judge_role_blocked'],
    lastKnownFailureType: 'conservative_detour',
    fallbackProvider: 'gemini'
  },
  grok: {
    role: 'breakthrough_alternative',
    status: STATUSES.HEALTHY,
    recommendedUse: ['stuck_state_alternatives', 'breakthrough_ideas', 'unstuck_analysis'],
    blockedUse: ['final_irreversible_decision', 'secret_access'],
    requiresHumanApproval: false,
    healthReasons: ['healthy_for_stuck_state_and_alternate_ideas'],
    lastKnownFailureType: null,
    fallbackProvider: 'gpt'
  },
  deepseek: {
    role: 'last_resort_advisory',
    status: STATUSES.HOLD,
    recommendedUse: ['sanitized_advisory_only'],
    blockedUse: ['final_decision', 'unsanitized_handoff', 'secret_access', 'customer_data', 'insurance_data', 'health_data', 'deploy', 'commit', 'push'],
    requiresHumanApproval: true,
    healthReasons: ['hold_until_sanitized_handoff_confirmed', 'external_risk_provider'],
    lastKnownFailureType: null,
    fallbackProvider: 'kimi'
  },
  kimi: {
    role: 'last_resort_advisory',
    status: STATUSES.HOLD,
    recommendedUse: ['sanitized_advisory_only'],
    blockedUse: ['final_decision', 'unsanitized_handoff', 'secret_access', 'customer_data', 'insurance_data', 'health_data', 'deploy', 'commit', 'push'],
    requiresHumanApproval: true,
    healthReasons: ['hold_until_sanitized_handoff_confirmed', 'external_risk_provider'],
    lastKnownFailureType: null,
    fallbackProvider: 'deepseek'
  },
  human: {
    role: 'approval_owner',
    status: STATUSES.HUMAN_GATE_ONLY,
    recommendedUse: ['git_commit', 'git_tag', 'git_push', 'deploy', 'billing', 'contract', 'payment', 'irreversible_actions'],
    blockedUse: ['routine_implementation', 'smoke_test_running', 'doc_writing'],
    requiresHumanApproval: true,
    healthReasons: ['human_is_gatekeeper_not_copy_paste_worker'],
    lastKnownFailureType: null,
    fallbackProvider: null
  }
};

function checkHealth(input) {
  const {
    provider = 'claude_code',
    overrideStatus = null,
    lastKnownFailureType = null
  } = input || {};

  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    return {
      tool: TOOL_META.slug,
      version: TOOL_META.version,
      dryRun: true,
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
      provider,
      role: 'unknown',
      status: STATUSES.UNAVAILABLE,
      recommendedUse: [],
      blockedUse: [],
      requiresHumanApproval: true,
      healthReasons: [`unknown_provider: ${provider}`],
      lastKnownFailureType: null,
      fallbackProvider: null
    };
  }

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    provider,
    role: defaults.role,
    status: overrideStatus || defaults.status,
    recommendedUse: defaults.recommendedUse,
    blockedUse: defaults.blockedUse,
    requiresHumanApproval: defaults.requiresHumanApproval,
    healthReasons: defaults.healthReasons,
    lastKnownFailureType: lastKnownFailureType || defaults.lastKnownFailureType,
    fallbackProvider: defaults.fallbackProvider
  };
}

function buildAllHealthReport() {
  return Object.keys(PROVIDER_DEFAULTS).map(p => checkHealth({ provider: p }));
}

function main() {
  const report = buildAllHealthReport();
  console.log(JSON.stringify(report, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  STATUSES,
  PROVIDER_DEFAULTS,
  checkHealth,
  buildAllHealthReport
};
