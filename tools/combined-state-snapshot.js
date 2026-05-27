/**
 * Combined State Snapshot v3.2.0
 *
 * Combines repo / actions / verify / provider / approval gate into a unified snapshot.
 * Designed as the primary input for Auto Decision Report (v3.3.0).
 */

const { readRepoState } = require('./repo-state-reader');
const { readActionsState } = require('./actions-state-reader');
const { readVerifyState } = require('./verify-state-reader');

const PROVIDER_STATUSES = ['available', 'auth_error', 'quota_exhausted', 'needs_fallback', 'unknown'];

function createCombinedStateSnapshot(rawData = {}) {
  const {
    repo = {},
    actions = {},
    verify = {},
    providerHealth = {},
    approvalGate = {},
    packageVersion = 'unknown',
    sessionGoal = '',
    session_id = ''
  } = rawData;

  const repoState = readRepoState({ ...repo, session_id });
  const actionsState = readActionsState({ ...actions, session_id });
  const verifyState = readVerifyState({ ...verify, session_id });

  const geminiStatus = providerHealth.gemini || 'unknown';
  const claudeStatus = providerHealth.claude || 'unknown';
  const geminiAvailable = geminiStatus === 'gemini_available' || geminiStatus === 'available';

  const issues = [];
  if (!repoState.workingTreeClean) issues.push(`uncommitted changes (${repoState.uncommittedFiles.length} files)`);
  if (repoState.isAhead) issues.push('HEAD ahead of origin — push pending');
  if (verifyState.verifyStatus === 'failed') issues.push(`verify FAILED (${verifyState.failedCount} smokes)`);
  if (verifyState.verifyStatus === 'timeout') issues.push('verify TIMEOUT');
  if (actionsState.actionsStatus === 'failed') issues.push(`Actions FAILED (${actionsState.failedJobs.join(', ')})`);

  const overallHealth = issues.length === 0 ? 'healthy'
    : issues.length <= 2 ? 'degraded'
    : 'critical';

  const approvalPending = approvalGate.pending || false;
  const junyaApproved = approvalGate.junyaApproved || false;

  return {
    snapshot: 'combined-state-snapshot',
    session_id,
    sessionGoal,
    packageVersion,
    repo: repoState,
    actions: actionsState,
    verify: verifyState,
    providerHealth: {
      gemini: geminiStatus,
      claude: claudeStatus,
      geminiAvailable,
      claudeAvailable: claudeStatus !== 'error'
    },
    approvalGate: {
      pending: approvalPending,
      junyaApproved,
      gate_required: approvalGate.gate_required || false
    },
    issues,
    issueCount: issues.length,
    overallHealth,
    // Flattened for decision tools
    branch: repoState.branch,
    headCommit: repoState.headCommit,
    actionsStatus: actionsState.actionsStatus,
    verifyStatus: verifyState.verifyStatus,
    workingTreeClean: repoState.workingTreeClean,
    isAhead: repoState.isAhead,
    geminiAvailable,
    version: '3.2.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createCombinedStateSnapshot };

if (require.main === module) {
  const result = createCombinedStateSnapshot({
    packageVersion: '3.2.0',
    repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
    actions: { status: 'success', conclusion: 'success', jobResults: [] },
    verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
    providerHealth: { gemini: 'gemini_available', claude: 'claude_available' }
  });
  console.log(JSON.stringify(result, null, 2));
}
