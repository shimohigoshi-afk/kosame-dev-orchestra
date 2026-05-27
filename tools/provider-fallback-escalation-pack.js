/**
 * Provider Fallback Escalation Pack v2.2.0
 *
 * Determines next escalation target when a provider fails.
 */

const FAILURE_TYPES = [
  'gemini_quota_exhausted',
  'gemini_auth_error',
  'gemini_timeout',
  'gemini_no_completion',
  'gemini_confirmation_stopped',
  'claude_tool_error',
  'claude_failed',
  'verify_failed',
  'actions_failed',
  'cloud_shell_unavailable',
  'unknown'
];

function determineEscalation(failureContext) {
  const {
    failure_type,
    current_provider,
    task_type = 'docs_update',
    risk_level = 'Low',
    retry_count = 0
  } = failureContext;

  let escalation_target = 'claude';
  let escalation_reason = '';
  let retry_recommended = false;
  let human_required = false;
  let next_action = '';

  switch (failure_type) {
    case 'gemini_quota_exhausted':
      escalation_target = 'claude';
      escalation_reason = 'Gemini quota exhausted. Claude takes over until quota recovers.';
      retry_recommended = false;
      next_action = 'generate_claude_main_task_packet';
      break;

    case 'gemini_auth_error':
      escalation_target = 'claude';
      escalation_reason = 'Gemini auth error (metadata server / refresh_token). Claude takes over.';
      retry_recommended = false;
      next_action = 'generate_claude_main_task_packet';
      break;

    case 'gemini_timeout':
    case 'gemini_no_completion':
      if (retry_count < 1) {
        escalation_target = 'gemini';
        escalation_reason = 'Gemini timeout/no completion. Retry once before escalating.';
        retry_recommended = true;
        next_action = 'retry_gemini_with_shorter_scope';
      } else {
        escalation_target = 'claude';
        escalation_reason = 'Gemini retried and still failed. Claude takes over.';
        next_action = 'generate_claude_main_task_packet';
      }
      break;

    case 'gemini_confirmation_stopped':
      escalation_target = 'claude';
      escalation_reason = 'Gemini stopped for confirmation. Claude takes over (no confirmation stops).';
      retry_recommended = false;
      next_action = 'generate_claude_main_task_packet';
      break;

    case 'claude_tool_error':
      if (retry_count < 2) {
        escalation_target = 'claude';
        escalation_reason = 'Claude tool error. Retry with clearer instructions.';
        retry_recommended = true;
        next_action = 'retry_claude_with_clarification';
      } else {
        escalation_target = 'human';
        escalation_reason = 'Claude tool error persists. Human intervention required.';
        human_required = true;
        next_action = 'generate_approval_packet_for_human';
      }
      break;

    case 'claude_failed':
      escalation_target = 'human';
      escalation_reason = 'Claude implementation failed. Human intervention required.';
      human_required = true;
      next_action = 'generate_approval_packet_for_human';
      break;

    case 'verify_failed':
      escalation_target = 'claude';
      escalation_reason = 'Verify failed. Claude repair mode.';
      retry_recommended = true;
      next_action = 'claude_repair_intake';
      break;

    case 'actions_failed':
      escalation_target = 'claude';
      escalation_reason = 'GitHub Actions failed. Claude investigates and repairs.';
      retry_recommended = true;
      next_action = 'actions_failure_triage';
      break;

    case 'cloud_shell_unavailable':
      escalation_target = 'human';
      escalation_reason = 'Cloud Shell unavailable. Human must run commands manually.';
      human_required = true;
      next_action = 'generate_approval_packet_for_human';
      break;

    default:
      escalation_target = 'claude';
      escalation_reason = 'Unknown failure. Claude investigates.';
      next_action = 'claude_investigate';
  }

  // Override: High/Critical risk always requires human approval
  if ((risk_level === 'High' || risk_level === 'Critical') && !human_required) {
    human_required = true;
    escalation_reason += ' Risk level requires human approval.';
  }

  return {
    failure_type,
    current_provider,
    escalation_target,
    escalation_reason,
    retry_recommended,
    human_required,
    next_action,
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { determineEscalation, FAILURE_TYPES };

if (require.main === module) {
  const result = determineEscalation({
    failure_type: 'gemini_auth_error',
    current_provider: 'gemini',
    task_type: 'bulk_generation',
    risk_level: 'Low',
    retry_count: 0
  });
  console.log(JSON.stringify(result, null, 2));
}
