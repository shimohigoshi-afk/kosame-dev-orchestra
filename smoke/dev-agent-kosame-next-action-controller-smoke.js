/**
 * Smoke Test: Kosame Next Action Controller v2.5.0
 */
const { determineKosameNextAction } = require('../tools/kosame-next-action-controller.js');
const { PROVIDER_STATES, createProviderHealthSnapshot } = require('../tools/provider-health-status.js');

function runSmokeTest() {
  console.log('Running smoke test: Kosame Next Action Controller v2.5.0');

  // High risk → approval packet
  const r1 = determineKosameNextAction({ risk_level: 'High', verify_status: 'passed', actions_status: 'success', provider_health: createProviderHealthSnapshot() });
  if (r1.next_action !== 'generate_approval_packet') throw new Error(`High risk should generate approval packet, got: ${r1.next_action}`);
  if (r1.target !== 'junya') throw new Error('High risk target should be junya');

  // Gemini auth error → fallback to claude
  const r2 = determineKosameNextAction({
    risk_level: 'Low',
    verify_status: 'passed',
    provider_health: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR })
  });
  if (r2.next_action !== 'fallback_to_claude') throw new Error(`Auth error should fallback to claude, got: ${r2.next_action}`);
  if (r2.target !== 'claude') throw new Error('Auth error target should be claude');

  // Verify failed → claude repair
  const r3 = determineKosameNextAction({
    risk_level: 'Low',
    verify_status: 'failed',
    provider_health: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (r3.next_action !== 'claude_repair') throw new Error(`Verify fail should claude_repair, got: ${r3.next_action}`);

  // Verify passed + actions success → commit candidate
  const r4 = determineKosameNextAction({
    risk_level: 'Low',
    verify_status: 'passed',
    actions_status: 'success',
    provider_health: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (r4.next_action !== 'prepare_commit_candidate') throw new Error(`Passed should prepare commit, got: ${r4.next_action}`);

  // No verify → run verify
  const r5 = determineKosameNextAction({
    risk_level: 'Low',
    provider_health: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (r5.next_action !== 'run_verify') throw new Error(`No verify should run_verify, got: ${r5.next_action}`);

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Kosame Next Action Controller Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
