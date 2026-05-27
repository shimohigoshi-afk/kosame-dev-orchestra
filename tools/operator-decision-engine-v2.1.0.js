/**
 * Operator Decision Engine v2.1.0
 *
 * Determines next action from verify result, GitHub Actions result,
 * risk classification, and provider health.
 */

const { getRoutingRecommendation, PROVIDER_STATES } = require('./provider-health-status.js');

const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

function determineNextActionV2(engineInput) {
  const {
    verifyStatus,
    githubActionsStatus,
    riskLevel,
    providerHealth,
    activeAgent
  } = engineInput;

  // 1. Critical/High risk → human approval required regardless of other state
  if (riskLevel === 'Critical' || riskLevel === 'High') {
    return {
      nextAction: 'human_approval_required',
      reasoning: `Risk level is ${riskLevel}. じゅんやさんの最終YESが必要。`,
      requiredTool: 'tools/operator-approval-summary.js',
      approvalPacketRequired: true
    };
  }

  // 2. Gemini auth/quota/fallback → route to Claude
  if (
    providerHealth &&
    (
      providerHealth.gemini === PROVIDER_STATES.GEMINI_AUTH_ERROR ||
      providerHealth.gemini === PROVIDER_STATES.GEMINI_QUOTA_EXHAUSTED ||
      providerHealth.gemini === PROVIDER_STATES.GEMINI_NEEDS_FALLBACK
    )
  ) {
    const routing = getRoutingRecommendation(providerHealth);
    return {
      nextAction: 'fallback_to_claude',
      reasoning: `Gemini stopped (${providerHealth.gemini}). ${routing.recommendation}`,
      requiredTool: 'tools/gemini-fallback-routing-packet.js',
      approvalPacketRequired: false
    };
  }

  // 3. Verify failed → send to Claude for repair
  if (verifyStatus === 'failed') {
    return {
      nextAction: 'send_to_claude_repair',
      reasoning: 'Verification failed. Escalating to Claude for repair.',
      requiredTool: 'tools/operator-claude-escalation-pack.js',
      approvalPacketRequired: false
    };
  }

  // 4. No verify run yet → run verify first (before CI checks)
  if (!verifyStatus || verifyStatus === 'unknown') {
    return {
      nextAction: 'run_verify',
      reasoning: 'No verify result. Run npm run verify first.',
      requiredTool: 'npm run verify',
      approvalPacketRequired: false
    };
  }

  // 5. GitHub Actions pending → wait (only when verify already passed)
  const githubPending =
    githubActionsStatus === 'pending' ||
    (
      (!githubActionsStatus || githubActionsStatus === 'unknown') &&
      providerHealth &&
      providerHealth.githubActions === PROVIDER_STATES.GITHUB_ACTIONS_PENDING
    );
  if (githubPending) {
    return {
      nextAction: 'wait_for_github_actions',
      reasoning: 'GitHub Actions is still running. Wait for completion.',
      requiredTool: 'tools/github-actions-record-pack.js',
      approvalPacketRequired: false
    };
  }

  // 6. GitHub Actions success + verify passed → commit candidate
  if (
    githubActionsStatus === 'success' &&
    verifyStatus === 'passed'
  ) {
    return {
      nextAction: 'commit_candidate',
      reasoning: 'Verify passed and GitHub Actions succeeded. Ready for commit.',
      requiredTool: 'git commit (じゅんやさん承認後)',
      approvalPacketRequired: true
    };
  }

  // 7. Verify passed, no GitHub Actions yet → submit for CI
  if (verifyStatus === 'passed') {
    return {
      nextAction: 'submit_for_ci',
      reasoning: 'Local verify passed. Push to trigger GitHub Actions.',
      requiredTool: 'git push (じゅんやさん承認後)',
      approvalPacketRequired: true
    };
  }

  return {
    nextAction: 'wait_for_instruction',
    reasoning: 'No clear next step. Waiting for operator instruction.',
    requiredTool: null,
    approvalPacketRequired: false
  };
}

module.exports = { determineNextActionV2, RISK_LEVELS };

if (require.main === module) {
  const { createProviderHealthSnapshot } = require('./provider-health-status.js');

  const engineInput = {
    verifyStatus: 'passed',
    githubActionsStatus: 'success',
    riskLevel: 'Low',
    providerHealth: createProviderHealthSnapshot({
      gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR
    }),
    activeAgent: 'claude'
  };

  const result = determineNextActionV2(engineInput);
  console.log(JSON.stringify(result, null, 2));
}
