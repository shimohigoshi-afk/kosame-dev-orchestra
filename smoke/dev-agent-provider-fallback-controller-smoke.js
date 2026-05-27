/**
 * Smoke Test: Provider Fallback Controller v2.5.0
 */
const { controlFallback } = require('../tools/provider-fallback-controller.js');

function runSmokeTest() {
  console.log('Running smoke test: Provider Fallback Controller v2.5.0');

  // Gemini auth error → fallback to claude
  const r1 = controlFallback({
    failure_source: 'gemini',
    failure_description: 'metadata server application default credentials error',
    current_provider: 'gemini',
    retry_count: 0,
    task_risk: 'Low'
  });
  if (r1.controller_type !== 'provider_fallback_controller') throw new Error('Wrong controller_type');
  if (r1.next_agent !== 'claude') throw new Error(`Auth error should route to claude, got: ${r1.next_agent}`);
  if (!r1.handoff_packet_needed) throw new Error('handoff_packet should be needed');
  if (r1.version !== '2.5.0') throw new Error('Version mismatch');

  // Gemini quota → fallback to claude
  const r2 = controlFallback({
    failure_source: 'gemini',
    failure_description: 'QUOTA_EXHAUSTED daily limit reached',
    current_provider: 'gemini',
    retry_count: 0
  });
  if (r2.next_agent !== 'claude') throw new Error(`Quota should route to claude, got: ${r2.next_agent}`);

  // Verify failure → claude repair mode
  const r3 = controlFallback({
    failure_source: 'verify',
    failure_description: 'npm run verify: 2 FAILED',
    current_provider: 'claude',
    retry_count: 0
  });
  if (r3.plan_action !== 'claude_repair_mode') throw new Error(`verify fail should be claude_repair_mode, got: ${r3.plan_action}`);
  if (r3.handoff_packet_needed) throw new Error('verify fail should not need handoff from claude to claude');

  // Actions failure → triage
  const r4 = controlFallback({
    failure_source: 'actions',
    failure_description: 'GitHub Actions workflow failed',
    current_provider: 'claude',
    task_risk: 'Low'
  });
  if (r4.plan_action !== 'actions_failure_triage') throw new Error(`actions fail should be triage, got: ${r4.plan_action}`);

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Provider Fallback Controller Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
