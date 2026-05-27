/**
 * Agent Retry / Fallback Plan v2.3.0
 *
 * Determines: retry same agent, fallback to Claude, go to Cloud Shell, or escalate to human.
 */

const { detectBlocker } = require('./agent-blocker-detection.js');

function generateRetryFallbackPlan(params = {}) {
  const {
    blocker_type,
    current_agent = 'gemini',
    retry_count = 0,
    task_risk = 'Low',
    error_text = ''
  } = params;

  const detected = blocker_type
    ? { blocker_type, recommended_action: blocker_type }
    : detectBlocker(error_text);

  let plan_action = 'fallback_to_claude';
  let plan_rationale = '';
  let fallback_agent = 'claude';
  let retry = false;

  const bt = detected.blocker_type || blocker_type || 'unknown';

  // Immediate Claude fallback (no retry)
  if (['gemini_auth_error', 'gemini_quota_exhausted', 'gemini_confirmation_stopped'].includes(bt)) {
    plan_action = 'fallback_to_claude';
    fallback_agent = 'claude';
    retry = false;
    plan_rationale = `${bt}: immediate fallback to Claude without retry.`;
  }
  // Retry once, then Claude
  else if (bt === 'gemini_timeout' && retry_count < 1) {
    plan_action = 'retry_same_agent';
    fallback_agent = 'gemini';
    retry = true;
    plan_rationale = 'Gemini timeout: retry once with reduced scope.';
  }
  else if (bt === 'gemini_timeout' && retry_count >= 1) {
    plan_action = 'fallback_to_claude';
    fallback_agent = 'claude';
    retry = false;
    plan_rationale = 'Gemini timeout persists after retry: fallback to Claude.';
  }
  // Verify failure → Claude repair
  else if (bt === 'verify_failure') {
    plan_action = 'claude_repair_mode';
    fallback_agent = 'claude';
    retry = false;
    plan_rationale = 'Verify failure: Claude repair mode.';
  }
  // Actions failure → triage then human
  else if (bt === 'github_actions_failure') {
    plan_action = 'actions_failure_triage';
    fallback_agent = task_risk === 'Low' ? 'claude' : 'human';
    retry = false;
    plan_rationale = 'GitHub Actions failure: triage and repair.';
  }
  // Claude tool error → retry once
  else if (bt === 'claude_tool_error' && retry_count < 2) {
    plan_action = 'retry_claude_with_clarification';
    fallback_agent = 'claude';
    retry = true;
    plan_rationale = 'Claude tool error: retry with clearer instructions.';
  }
  // Permission wait → approval packet
  else if (bt === 'permission_wait') {
    plan_action = 'generate_approval_packet';
    fallback_agent = 'human';
    retry = false;
    plan_rationale = 'Permission wait: generate approval packet for じゅんやさん.';
  }
  // High/Critical risk → human
  else if (task_risk === 'High' || task_risk === 'Critical') {
    plan_action = 'escalate_to_human';
    fallback_agent = 'human';
    retry = false;
    plan_rationale = `Risk level ${task_risk}: escalate to human.`;
  }
  else {
    plan_action = 'fallback_to_claude';
    fallback_agent = 'claude';
    plan_rationale = 'Default fallback: Claude.';
  }

  return {
    plan_type: 'retry_fallback_plan',
    blocker_type: bt,
    current_agent,
    plan_action,
    plan_rationale,
    retry,
    next_agent: fallback_agent,
    retry_count: retry ? retry_count + 1 : 0,
    max_retries: 2,
    version: '2.3.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateRetryFallbackPlan };

if (require.main === module) {
  const scenarios = [
    { blocker_type: 'gemini_auth_error', current_agent: 'gemini', retry_count: 0 },
    { blocker_type: 'gemini_timeout', current_agent: 'gemini', retry_count: 0 },
    { blocker_type: 'verify_failure', current_agent: 'claude', retry_count: 0 },
    { blocker_type: 'github_actions_failure', current_agent: 'claude', task_risk: 'Low' }
  ];
  scenarios.forEach(s => {
    const plan = generateRetryFallbackPlan(s);
    console.log(`[${s.blocker_type}] → ${plan.plan_action} → ${plan.next_agent}`);
  });
}
