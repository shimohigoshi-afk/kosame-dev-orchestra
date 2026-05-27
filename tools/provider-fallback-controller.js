/**
 * Provider Fallback Controller v2.5.0
 *
 * Central controller for all provider failures:
 * Gemini stop / Claude failure / Cloud Shell fail / Actions failure.
 */

const { detectBlocker } = require('./agent-blocker-detection.js');
const { generateRetryFallbackPlan } = require('./agent-retry-fallback-plan.js');
const { PROVIDER_STATES } = require('./provider-health-status.js');

function controlFallback(params = {}) {
  const {
    failure_source,
    failure_description = '',
    current_provider = 'gemini',
    retry_count = 0,
    task_risk = 'Low',
    provider_health = {}
  } = params;

  // 1. Detect blocker type
  const blocker = detectBlocker(failure_description);

  // 2. Generate retry/fallback plan
  const plan = generateRetryFallbackPlan({
    blocker_type: blocker.blocker_type,
    current_agent: current_provider,
    retry_count,
    task_risk,
    error_text: failure_description
  });

  // 3. Determine provider health update
  let updated_provider_state = null;
  if (blocker.is_gemini_blocker) {
    updated_provider_state = {
      gemini: blocker.blocker_type === 'gemini_auth_error'
        ? PROVIDER_STATES.GEMINI_AUTH_ERROR
        : blocker.blocker_type === 'gemini_quota_exhausted'
          ? PROVIDER_STATES.GEMINI_QUOTA_EXHAUSTED
          : PROVIDER_STATES.GEMINI_NEEDS_FALLBACK,
      claude: PROVIDER_STATES.CLAUDE_AVAILABLE
    };
  }

  // 4. Determine handoff packet needed
  const handoff_needed = plan.next_agent === 'claude' && current_provider !== 'claude';

  return {
    controller_type: 'provider_fallback_controller',
    failure_source,
    failure_description,
    blocker_detected: blocker.blocker_type,
    blocker_severity: blocker.severity,
    plan_action: plan.plan_action,
    plan_rationale: plan.plan_rationale,
    next_agent: plan.next_agent,
    retry: plan.retry,
    retry_count: plan.retry_count,
    human_required: plan.human_required || false,
    updated_provider_state,
    handoff_packet_needed: handoff_needed,
    handoff_tool: handoff_needed ? 'tools/gemini-fallback-routing-packet.js' : null,
    approval_packet_needed: plan.human_required,
    approval_tool: plan.human_required ? 'tools/kosame-approval-packet-generator.js' : null,
    version: '2.5.0',
    controlled_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { controlFallback };

if (require.main === module) {
  const scenarios = [
    { failure_source: 'gemini', failure_description: 'metadata server application default credentials error', current_provider: 'gemini' },
    { failure_source: 'verify', failure_description: 'npm run verify: 2 FAILED', current_provider: 'claude' },
    { failure_source: 'actions', failure_description: 'GitHub Actions workflow failed', current_provider: 'claude', task_risk: 'Low' }
  ];
  scenarios.forEach(s => {
    const result = controlFallback(s);
    console.log(`[${s.failure_source}] → ${result.plan_action} → ${result.next_agent}`);
  });
}
