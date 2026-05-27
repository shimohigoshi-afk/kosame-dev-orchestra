/**
 * Kosame Next Action Controller v2.5.0
 *
 * Derives next action from: verify result, provider health,
 * dispatch queue state, risk level, and GitHub Actions status.
 */

const { PROVIDER_STATES } = require('./provider-health-status.js');

function determineKosameNextAction(controllerInput) {
  const {
    verify_status,
    provider_health = {},
    queue_state = {},
    risk_level = 'Low',
    actions_status = 'unknown',
    session_phase = 'in_progress',
    pending_task_count = 0
  } = controllerInput;

  // 1. Critical/High risk → always human first
  if (risk_level === 'Critical' || risk_level === 'High') {
    return {
      next_action: 'generate_approval_packet',
      actor: 'kosame',
      target: 'junya',
      reason: `Risk level ${risk_level}: prepare approval packet for じゅんやさん.`,
      tools_required: ['tools/kosame-approval-packet-generator.js']
    };
  }

  // 2. Gemini failure → Claude fallback
  const geminiState = provider_health.gemini;
  if (
    geminiState === PROVIDER_STATES.GEMINI_AUTH_ERROR ||
    geminiState === PROVIDER_STATES.GEMINI_QUOTA_EXHAUSTED ||
    geminiState === PROVIDER_STATES.GEMINI_NEEDS_FALLBACK
  ) {
    return {
      next_action: 'fallback_to_claude',
      actor: 'kosame',
      target: 'claude',
      reason: `Gemini is ${geminiState}. Routing to Claude.`,
      tools_required: ['tools/gemini-fallback-routing-packet.js']
    };
  }

  // 3. Verify failed → Claude repair
  if (verify_status === 'failed') {
    return {
      next_action: 'claude_repair',
      actor: 'kosame',
      target: 'claude',
      reason: 'Verify failed. Claude repair mode.',
      tools_required: ['tools/session-repair-checkpoint.js']
    };
  }

  // 4. Actions pending → wait
  if (actions_status === 'pending') {
    return {
      next_action: 'wait_for_actions',
      actor: 'kosame',
      target: 'github_actions',
      reason: 'GitHub Actions is running. Wait for result.',
      tools_required: []
    };
  }

  // 5. Verify passed + Actions success + low risk → commit candidate
  if (verify_status === 'passed' && actions_status === 'success') {
    return {
      next_action: 'prepare_commit_candidate',
      actor: 'kosame',
      target: 'junya',
      reason: 'Verify PASS + Actions success. Prepare commit readiness packet.',
      tools_required: ['tools/session-commit-readiness-packet.js', 'tools/kosame-approval-packet-generator.js']
    };
  }

  // 6. Queue has pending tasks → dispatch next
  if (pending_task_count > 0) {
    const geminiOk = geminiState === PROVIDER_STATES.GEMINI_AVAILABLE;
    return {
      next_action: 'dispatch_next_task',
      actor: 'kosame',
      target: geminiOk ? 'gemini' : 'claude',
      reason: `${pending_task_count} tasks pending. Dispatch to ${geminiOk ? 'Gemini' : 'Claude'}.`,
      tools_required: ['tools/next-agent-dispatch-plan.js', 'tools/agent-dispatch-queue-v2.3.0.js']
    };
  }

  // 7. No verify run yet
  if (!verify_status || verify_status === 'unknown' || verify_status === 'not_run') {
    return {
      next_action: 'run_verify',
      actor: 'kosame',
      target: 'claude',
      reason: 'No verify result. Run npm run verify.',
      tools_required: ['npm run verify']
    };
  }

  return {
    next_action: 'wait_for_instruction',
    actor: 'kosame',
    target: 'junya',
    reason: 'No clear next step. Waiting for じゅんやさん direction.',
    tools_required: []
  };
}

module.exports = { determineKosameNextAction };

if (require.main === module) {
  const { createProviderHealthSnapshot } = require('./provider-health-status.js');
  const result = determineKosameNextAction({
    verify_status: 'passed',
    provider_health: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR }),
    risk_level: 'Low',
    actions_status: 'success',
    pending_task_count: 0
  });
  console.log(JSON.stringify(result, null, 2));
}
