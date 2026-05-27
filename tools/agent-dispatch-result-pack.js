/**
 * Agent Dispatch Result Pack v2.3.0
 *
 * Records execution result, failure reason, fallback need, and next action.
 */

const RESULT_STATUSES = ['success', 'failed', 'partial', 'timeout', 'blocked'];

function createDispatchResult(params = {}) {
  const {
    request_id,
    task_id,
    assigned_agent,
    status,
    files_modified = [],
    files_not_completed = [],
    failure_reason = null,
    failure_type = null,
    verify_status = 'not_run',
    node_check_status = 'not_run',
    fallback_required = false,
    fallback_to = null,
    next_action = '',
    notes = ''
  } = params;

  if (!RESULT_STATUSES.includes(status)) {
    throw new Error(`Invalid status: ${status}. Valid: ${RESULT_STATUSES.join(', ')}`);
  }

  const derived_fallback = fallback_required
    ? (fallback_to || (assigned_agent === 'gemini' ? 'claude' : 'human'))
    : null;

  return {
    result_type: 'agent_dispatch_result',
    request_id,
    task_id,
    assigned_agent,
    status,
    files_modified,
    files_not_completed,
    failure_reason,
    failure_type,
    verify_status,
    node_check_status,
    fallback_required,
    fallback_to: derived_fallback,
    next_action: next_action || deriveNextAction(status, verify_status, fallback_required),
    notes,
    version: '2.3.0',
    completed_at: new Date().toISOString(),
    dryRun: true
  };
}

function deriveNextAction(status, verify_status, fallback_required) {
  if (fallback_required) return 'execute_fallback';
  if (status === 'success' && verify_status === 'passed') return 'commit_candidate';
  if (status === 'success' && verify_status === 'not_run') return 'run_verify';
  if (status === 'failed') return 'trigger_fallback_escalation';
  if (status === 'timeout') return 'retry_or_fallback';
  if (status === 'partial') return 'resume_or_handoff';
  return 'review_result';
}

module.exports = { createDispatchResult, RESULT_STATUSES, deriveNextAction };

if (require.main === module) {
  const result = createDispatchResult({
    request_id: 'dr-001',
    task_id: 'task-v2.3.0-001',
    assigned_agent: 'claude',
    status: 'success',
    files_modified: ['docs/ai-dev-team/agent-dispatch-request-v2.3.0.md'],
    verify_status: 'passed',
    node_check_status: 'passed',
    fallback_required: false,
    next_action: 'commit_candidate'
  });
  console.log(JSON.stringify(result, null, 2));
}
