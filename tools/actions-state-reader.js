/**
 * Actions State Reader v3.2.0
 *
 * Reads GHA state from structured fixture/text input.
 * No shell exec, no gh CLI call — caller provides raw text or structured data.
 * Classifies: success / pending / failure / unknown.
 */

function parseGhRunListText(runListText = '') {
  const lines = runListText.split('\n').filter(Boolean).filter(l => !l.startsWith('STATUS'));

  const runs = lines.map(line => {
    const cols = line.trim().split(/\t|\s{2,}/).filter(Boolean);
    if (cols.length < 2) return null;
    const status = cols[0].toLowerCase();
    const name = cols[1] || 'unknown';
    return { status, name, raw: line.trim() };
  }).filter(Boolean);

  const latestRun = runs[0] || null;

  let actionsStatus = 'unknown';
  if (latestRun) {
    if (latestRun.status.includes('success') || latestRun.status.includes('completed')) {
      actionsStatus = 'success';
    } else if (latestRun.status.includes('fail') || latestRun.status.includes('error')) {
      actionsStatus = 'failed';
    } else if (latestRun.status.includes('pending') || latestRun.status.includes('queue') ||
               latestRun.status.includes('progress') || latestRun.status.includes('running')) {
      actionsStatus = 'pending';
    }
  }

  return { runs, latestRun, actionsStatus };
}

function readActionsState(actionsInput = {}) {
  const {
    runListText = '',
    workflowName = 'CI',
    runId = '',
    status = 'unknown',
    conclusion = '',
    branch = 'main',
    jobResults = [],
    session_id = ''
  } = actionsInput;

  let actionsStatus = 'unknown';
  let runs = [];
  let latestRun = null;

  if (runListText) {
    const parsed = parseGhRunListText(runListText);
    runs = parsed.runs;
    latestRun = parsed.latestRun;
    actionsStatus = parsed.actionsStatus;
  } else {
    if (status === 'success' || conclusion === 'success') actionsStatus = 'success';
    else if (status === 'failure' || conclusion === 'failure') actionsStatus = 'failed';
    else if (status === 'pending' || status === 'in_progress') actionsStatus = 'pending';
    else actionsStatus = 'unknown';
  }

  const failedJobs = jobResults.filter(j => j && j.conclusion === 'failure').map(j => j.name || 'unknown');
  const successJobs = jobResults.filter(j => j && j.conclusion === 'success').map(j => j.name || 'unknown');

  return {
    reader: 'actions-state-reader',
    session_id,
    workflowName,
    actionsStatus,
    runId: String(runId),
    branch,
    runs,
    latestRun,
    failedJobs,
    successJobs,
    hasFailures: failedJobs.length > 0 || actionsStatus === 'failed',
    version: '3.2.0',
    readAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { readActionsState, parseGhRunListText };

if (require.main === module) {
  const result = readActionsState({
    runListText: 'success\tKOSAME Dev Orchestra Verify\tmain\t2min\n' +
                 'success\tPM Agent Launch Readiness\tmain\t1min',
    workflowName: 'KOSAME Dev Orchestra Verify'
  });
  console.log(JSON.stringify(result, null, 2));
}
