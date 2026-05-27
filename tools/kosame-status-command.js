/**
 * Kosame Status Command v2.6.0
 *
 * Displays current repo state and recommends next action.
 * Input: structured repo state. Output: status display object.
 */

function executeStatusCommand(repoState = {}) {
  const {
    packageVersion = 'unknown',
    headCommit = '',
    originCommit = '',
    branch = 'main',
    hasUncommittedChanges = false,
    uncommittedFiles = [],
    untrackedFiles = [],
    actionsStatus = 'unknown',
    verifyStatus = 'unknown',
    providerHealth = {},
    activeSession = null
  } = repoState;

  const syncStatus = !originCommit || headCommit === originCommit ? 'in_sync' : 'ahead_of_origin';
  const workingTreeClean = !hasUncommittedChanges && uncommittedFiles.length === 0;

  const issues = [];
  if (!workingTreeClean) issues.push(`uncommitted changes (${uncommittedFiles.length} files)`);
  if (syncStatus === 'ahead_of_origin') issues.push('HEAD is ahead of origin — push pending');
  if (verifyStatus === 'failed') issues.push('verify FAILED');
  if (actionsStatus === 'failed') issues.push('GitHub Actions FAILED');
  if (providerHealth.gemini && providerHealth.gemini.includes('error')) issues.push(`Gemini: ${providerHealth.gemini}`);

  const nextAction = deriveStatusNextAction({ syncStatus, workingTreeClean, actionsStatus, verifyStatus, issues });

  return {
    command: 'kosame status',
    packageVersion,
    branch,
    headCommit: headCommit.slice(0, 7) || 'unknown',
    originCommit: originCommit.slice(0, 7) || 'unknown',
    syncStatus,
    workingTreeClean,
    uncommittedFiles,
    untrackedFiles,
    actionsStatus,
    verifyStatus,
    providerHealth,
    issues,
    issueCount: issues.length,
    nextAction,
    activeSession: activeSession || 'none',
    version: '2.6.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

function deriveStatusNextAction({ syncStatus, workingTreeClean, actionsStatus, verifyStatus, issues }) {
  if (verifyStatus === 'failed') return { action: 'run_claude_repair', priority: 'high', reason: 'Verify failed. Claude repair mode.' };
  if (actionsStatus === 'failed') return { action: 'triage_actions_failure', priority: 'high', reason: 'GitHub Actions failed. Triage required.' };
  if (!workingTreeClean && verifyStatus === 'passed') return { action: 'prepare_commit_packet', priority: 'normal', reason: 'Changes staged. Run commit-check.' };
  if (!workingTreeClean && verifyStatus !== 'passed') return { action: 'run_verify', priority: 'normal', reason: 'Changes present. Run verify first.' };
  if (syncStatus === 'ahead_of_origin') return { action: 'prepare_push_packet', priority: 'normal', reason: 'Commits ahead of origin. Run push-check.' };
  if (actionsStatus === 'success' && syncStatus === 'in_sync') return { action: 'prepare_release_check', priority: 'low', reason: 'All green. Run release-check.' };
  return { action: 'wait_for_instruction', priority: 'low', reason: 'Stable state. Awaiting next task.' };
}

module.exports = { executeStatusCommand, deriveStatusNextAction };

if (require.main === module) {
  const result = executeStatusCommand({
    packageVersion: '2.5.0',
    headCommit: 'b9b02ee',
    originCommit: 'b9b02ee',
    branch: 'main',
    hasUncommittedChanges: false,
    uncommittedFiles: [],
    actionsStatus: 'success',
    verifyStatus: 'passed',
    providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
  });
  console.log(JSON.stringify(result, null, 2));
}
