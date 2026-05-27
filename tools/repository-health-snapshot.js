/**
 * Repository Health Snapshot v2.7.0
 *
 * Combines git status, GHA result, and verify result into a unified health snapshot.
 * Used as input to kosame-status-command and other operator commands.
 */

const { importGitStatus } = require('./git-status-importer');
const { importGitHubActionsResult } = require('./github-actions-result-importer');
const { importVerifyResult } = require('./verify-result-importer');

function createRepositoryHealthSnapshot(rawData = {}) {
  const {
    git = {},
    actions = {},
    verify = {},
    packageVersion = 'unknown',
    activeSession = null
  } = rawData;

  const gitSnapshot = importGitStatus(git);
  const actionsSnapshot = importGitHubActionsResult(actions);
  const verifySnapshot = importVerifyResult(verify);

  const issues = [];
  if (!gitSnapshot.workingTreeClean) issues.push(`uncommitted changes (${gitSnapshot.uncommittedFiles.length} files)`);
  if (gitSnapshot.isAhead) issues.push('HEAD ahead of origin — push pending');
  if (verifySnapshot.verifyStatus === 'failed') issues.push(`verify FAILED (${verifySnapshot.failedCount} smokes)`);
  if (actionsSnapshot.actionsStatus === 'failed') issues.push(`GitHub Actions FAILED (jobs: ${actionsSnapshot.failedJobs.join(', ')})`);

  const overallHealth = issues.length === 0 ? 'healthy' : (issues.length <= 2 ? 'degraded' : 'critical');

  return {
    snapshot: 'repository-health-snapshot',
    packageVersion,
    activeSession: activeSession || 'none',
    git: gitSnapshot,
    actions: actionsSnapshot,
    verify: verifySnapshot,
    issues,
    issueCount: issues.length,
    overallHealth,
    // Flattened fields for operator console compatibility
    branch: gitSnapshot.branch,
    headCommit: gitSnapshot.headCommit,
    originCommit: gitSnapshot.originCommit,
    hasUncommittedChanges: gitSnapshot.hasUncommittedChanges,
    uncommittedFiles: gitSnapshot.uncommittedFiles,
    untrackedFiles: gitSnapshot.untrackedFiles,
    actionsStatus: actionsSnapshot.actionsStatus,
    verifyStatus: verifySnapshot.verifyStatus,
    workingTreeClean: gitSnapshot.workingTreeClean,
    version: '2.7.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createRepositoryHealthSnapshot };

if (require.main === module) {
  const result = createRepositoryHealthSnapshot({
    packageVersion: '2.7.0',
    git: {
      branch: 'main',
      headCommit: 'abc1234',
      originCommit: 'abc1234',
      statusLines: [],
      aheadCount: 0
    },
    actions: {
      status: 'success',
      conclusion: 'success',
      workflowName: 'CI',
      jobResults: [{ name: 'test', conclusion: 'success' }]
    },
    verify: {
      exitCode: 0,
      passedCount: 94,
      failedCount: 0
    }
  });
  console.log(JSON.stringify(result, null, 2));
}
