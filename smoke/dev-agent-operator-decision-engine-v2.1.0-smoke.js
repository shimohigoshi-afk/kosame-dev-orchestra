/**
 * Smoke Test: Operator Decision Engine v2.1.0
 */

const { determineNextActionV2, RISK_LEVELS } = require('../tools/operator-decision-engine-v2.1.0.js');
const { PROVIDER_STATES, createProviderHealthSnapshot } = require('../tools/provider-health-status.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Decision Engine v2.1.0');

  // 1. RISK_LEVELS
  if (!Array.isArray(RISK_LEVELS)) throw new Error('RISK_LEVELS must be array');
  if (!RISK_LEVELS.includes('Critical')) throw new Error('Missing Critical risk level');

  // 2. High risk → human_approval_required
  const highRiskResult = determineNextActionV2({
    verifyStatus: 'passed',
    githubActionsStatus: 'success',
    riskLevel: 'High',
    providerHealth: createProviderHealthSnapshot()
  });
  if (highRiskResult.nextAction !== 'human_approval_required') {
    throw new Error(`High risk should require human approval, got: ${highRiskResult.nextAction}`);
  }
  if (!highRiskResult.approvalPacketRequired) throw new Error('High risk should set approvalPacketRequired');

  // 3. Gemini auth error → fallback_to_claude
  const authErrorResult = determineNextActionV2({
    verifyStatus: 'unknown',
    githubActionsStatus: 'unknown',
    riskLevel: 'Low',
    providerHealth: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR })
  });
  if (authErrorResult.nextAction !== 'fallback_to_claude') {
    throw new Error(`Auth error should fallback to claude, got: ${authErrorResult.nextAction}`);
  }

  // 4. Verify failed → send_to_claude_repair
  const failedResult = determineNextActionV2({
    verifyStatus: 'failed',
    githubActionsStatus: 'unknown',
    riskLevel: 'Low',
    providerHealth: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (failedResult.nextAction !== 'send_to_claude_repair') {
    throw new Error(`Verify failed should send to claude repair, got: ${failedResult.nextAction}`);
  }

  // 5. Verify passed + CI success → commit_candidate
  const commitResult = determineNextActionV2({
    verifyStatus: 'passed',
    githubActionsStatus: 'success',
    riskLevel: 'Low',
    providerHealth: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (commitResult.nextAction !== 'commit_candidate') {
    throw new Error(`Passed+success should be commit_candidate, got: ${commitResult.nextAction}`);
  }

  // 6. No verify → run_verify
  const noVerifyResult = determineNextActionV2({
    riskLevel: 'Low',
    providerHealth: createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE })
  });
  if (noVerifyResult.nextAction !== 'run_verify') {
    throw new Error(`No verify should return run_verify, got: ${noVerifyResult.nextAction}`);
  }

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Operator Decision Engine v2.1.0 Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
