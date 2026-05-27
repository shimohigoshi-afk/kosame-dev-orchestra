/**
 * GitHub Actions Result Importer v2.7.0
 *
 * Parses GHA result data into a normalized status snapshot.
 * Input: structured GHA data object (no external API calls — dryRun always).
 */

const VALID_STATUSES = ['success', 'failure', 'pending', 'cancelled', 'skipped', 'unknown'];

function importGitHubActionsResult(rawActionsData = {}) {
  const {
    workflowName = 'CI',
    status = 'unknown',
    conclusion = '',
    runId = '',
    branch = 'main',
    commit = '',
    durationSeconds = 0,
    jobResults = []
  } = rawActionsData;

  const normalizedStatus = VALID_STATUSES.includes(status) ? status : 'unknown';

  const failedJobs = jobResults.filter(j => j && j.conclusion === 'failure').map(j => j.name || 'unknown');
  const successJobs = jobResults.filter(j => j && j.conclusion === 'success').map(j => j.name || 'unknown');

  const actionsStatus = normalizedStatus === 'success'
    ? 'success'
    : normalizedStatus === 'failure' || conclusion === 'failure'
      ? 'failed'
      : normalizedStatus === 'pending'
        ? 'pending'
        : 'unknown';

  return {
    importer: 'github-actions-result-importer',
    workflowName,
    actionsStatus,
    rawStatus: normalizedStatus,
    conclusion: conclusion || normalizedStatus,
    runId: String(runId),
    branch,
    commit: String(commit).slice(0, 7) || 'unknown',
    durationSeconds,
    failedJobs,
    successJobs,
    totalJobs: jobResults.length,
    hasFailures: failedJobs.length > 0,
    version: '2.7.0',
    importedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { importGitHubActionsResult };

if (require.main === module) {
  const result = importGitHubActionsResult({
    workflowName: 'CI',
    status: 'success',
    conclusion: 'success',
    runId: '12345678',
    branch: 'main',
    commit: 'abc1234',
    durationSeconds: 187,
    jobResults: [
      { name: 'build', conclusion: 'success' },
      { name: 'test', conclusion: 'success' }
    ]
  });
  console.log(JSON.stringify(result, null, 2));
}
