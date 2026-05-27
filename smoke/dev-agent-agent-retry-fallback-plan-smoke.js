/**
 * Smoke Test: Agent Retry Fallback Plan v2.3.0
 */
const { generateRetryFallbackPlan } = require('../tools/agent-retry-fallback-plan.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Retry Fallback Plan v2.3.0');

  // auth_error → immediate claude fallback
  const r1 = generateRetryFallbackPlan({ blocker_type: 'gemini_auth_error', current_agent: 'gemini', retry_count: 0 });
  if (r1.plan_action !== 'fallback_to_claude') throw new Error(`auth_error should fallback_to_claude, got: ${r1.plan_action}`);
  if (r1.retry) throw new Error('auth_error should not retry');
  if (r1.next_agent !== 'claude') throw new Error('next_agent should be claude');

  // quota_exhausted → claude fallback
  const r2 = generateRetryFallbackPlan({ blocker_type: 'gemini_quota_exhausted', current_agent: 'gemini', retry_count: 0 });
  if (r2.next_agent !== 'claude') throw new Error('quota should go to claude');

  // first timeout → retry
  const r3 = generateRetryFallbackPlan({ blocker_type: 'gemini_timeout', current_agent: 'gemini', retry_count: 0 });
  if (!r3.retry) throw new Error('First timeout should retry');
  if (r3.plan_action !== 'retry_same_agent') throw new Error(`First timeout should retry_same_agent, got: ${r3.plan_action}`);

  // second timeout → claude
  const r4 = generateRetryFallbackPlan({ blocker_type: 'gemini_timeout', current_agent: 'gemini', retry_count: 1 });
  if (r4.next_agent !== 'claude') throw new Error('After retry, timeout should go to claude');

  // verify_failure → claude repair
  const r5 = generateRetryFallbackPlan({ blocker_type: 'verify_failure', current_agent: 'claude', retry_count: 0 });
  if (r5.plan_action !== 'claude_repair_mode') throw new Error(`verify_failure should be claude_repair_mode, got: ${r5.plan_action}`);

  // permission_wait → approval packet
  const r6 = generateRetryFallbackPlan({ blocker_type: 'permission_wait', current_agent: 'claude', retry_count: 0 });
  if (r6.plan_action !== 'generate_approval_packet') throw new Error(`permission should generate_approval_packet, got: ${r6.plan_action}`);

  if (r1.version !== '2.3.0') throw new Error('Version mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Retry Fallback Plan Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
