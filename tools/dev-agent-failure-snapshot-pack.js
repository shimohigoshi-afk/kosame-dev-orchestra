'use strict';

const TOOL_META = {
  version: '110.2.0',
  title: 'Failure Snapshot Pack',
  slug: 'dev-agent-failure-snapshot-pack'
};

const FAILURE_TYPES = [
  'provider_timeout',
  'provider_unavailable',
  'context_too_large',
  'verification_failed',
  'smoke_failed',
  'ambiguous_output',
  'budget_gate',
  'human_gate',
  'unknown'
];

const DANGEROUS_ACTIONS = [
  'secret', 'env', 'api_key', 'customer_data', 'insurance_data', 'health_data',
  'deploy', 'git_push', 'git_tag', 'git_commit', 'destructive', 'live_external_send'
];

const HANDOFF_TARGET_MAP = {
  gemini_long_text:    'gpt_or_grok_summary_route_or_split_input',
  claude_implementation: 'retry_claude_with_narrow_scope',
  gpt_conservative:    'restrict_gpt_to_execution_assistant_only',
  all_primary_failed:  'sanitized_deepseek_kimi_advisory_route_only',
  dangerous_action:    'human_approval_required'
};

function buildSnapshot(input) {
  const {
    currentRepo          = 'kosame-dev-orchestra',
    currentVersion       = '110.2.0',
    currentTask          = '',
    taskObjective        = '',
    lastSuccessfulStep   = '',
    failedStep           = '',
    failureType          = 'unknown',
    failureSummary       = '',
    touchedFiles         = [],
    changedFiles         = [],
    verificationStatus   = 'unknown',
    commandsRun          = [],
    nextRecommendedAction = '',
    blockedActions       = [],
    humanApprovalRequired = true,
    handoffTargetHint    = ''
  } = input || {};

  const resolvedFailureType = FAILURE_TYPES.includes(failureType) ? failureType : 'unknown';
  const shouldReadFullLog = resolvedFailureType !== 'context_too_large'
    ? false
    : false;

  const maxContextPolicy = resolvedFailureType === 'context_too_large'
    ? 'use_failure_snapshot_only — do NOT load full chat log'
    : 'use_failure_snapshot_only';

  const handoffTargetSuggestion = deriveHandoffTarget(resolvedFailureType, handoffTargetHint);

  const deniedActions = [...DANGEROUS_ACTIONS];

  return {
    tool: TOOL_META.slug,
    snapshotVersion: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    currentRepo,
    currentVersion,
    currentTask,
    taskObjective,
    lastSuccessfulStep,
    failedStep,
    failureType: resolvedFailureType,
    failureSummary,
    touchedFiles,
    changedFiles,
    verificationStatus,
    commandsRun,
    nextRecommendedAction,
    blockedActions,
    humanApprovalRequired,
    dangerousActionsDenied: deniedActions,
    handoffTargetSuggestion,
    shouldReadFullLog: false,
    maxContextPolicy
  };
}

function deriveHandoffTarget(failureType, hint) {
  if (hint && HANDOFF_TARGET_MAP[hint]) return HANDOFF_TARGET_MAP[hint];
  if (failureType === 'context_too_large') return HANDOFF_TARGET_MAP.gemini_long_text;
  if (failureType === 'provider_timeout')  return 'retry_same_provider_with_narrow_scope_or_switch_to_fallback';
  if (failureType === 'provider_unavailable') return 'switch_to_fallback_provider_per_ai_fallback_router';
  if (failureType === 'verification_failed')  return HANDOFF_TARGET_MAP.claude_implementation;
  if (failureType === 'smoke_failed')         return HANDOFF_TARGET_MAP.claude_implementation;
  if (failureType === 'ambiguous_output')     return HANDOFF_TARGET_MAP.gpt_conservative;
  if (failureType === 'budget_gate')          return 'escalate_to_human_for_budget_approval';
  if (failureType === 'human_gate')           return 'await_human_approval';
  return 'consult_ai_fallback_router_pack';
}

function main() {
  const snapshot = buildSnapshot({
    currentTask: 'implement_v110.2.0',
    failureType: 'provider_timeout',
    failedStep: 'gemini_bulk_preprocessing',
    failureSummary: 'Gemini timed out after 30s during bulk code review',
    touchedFiles: ['tools/dev-agent-failure-snapshot-pack.js'],
    changedFiles: [],
    nextRecommendedAction: 'Retry with Grok using narrow scope'
  });
  console.log(JSON.stringify(snapshot, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  FAILURE_TYPES,
  DANGEROUS_ACTIONS,
  HANDOFF_TARGET_MAP,
  buildSnapshot,
  deriveHandoffTarget
};
