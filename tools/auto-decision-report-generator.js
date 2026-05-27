/**
 * Auto Decision Report Generator v3.3.0
 *
 * Combines all 4 decision reports into a single こさめ副社長向け判断レポート.
 * Input: Combined State Snapshot (v3.2.0).
 */

const { generateCommitDecisionReport } = require('./commit-decision-report');
const { generatePushDecisionReport } = require('./push-decision-report');
const { generateReleaseDecisionReport } = require('./release-decision-report');
const { generateDispatchDecisionReport } = require('./dispatch-decision-report');

function generateAutoDecisionReport(snapshot = {}) {
  const { session_id = '', sessionGoal = '' } = snapshot;

  const commitReport = generateCommitDecisionReport(snapshot);
  const pushReport = generatePushDecisionReport(snapshot);
  const releaseReport = generateReleaseDecisionReport(snapshot);
  const dispatchReport = generateDispatchDecisionReport(snapshot);

  // Primary action: derive highest priority
  let primaryAction = 'wait';
  let primaryPriority = 'low';

  if (snapshot.verifyStatus === 'failed' || snapshot.verifyStatus === 'timeout') {
    primaryAction = 'fix_verify';
    primaryPriority = 'high';
  } else if (snapshot.actionsStatus === 'failed') {
    primaryAction = 'triage_actions';
    primaryPriority = 'high';
  } else if (!snapshot.workingTreeClean && snapshot.verifyStatus !== 'passed') {
    primaryAction = 'run_verify';
    primaryPriority = 'normal';
  } else if (commitReport.recommendation === 'YES') {
    primaryAction = 'commit';
    primaryPriority = 'normal';
  } else if (pushReport.recommendation === 'YES') {
    primaryAction = 'push_with_junya_approval';
    primaryPriority = 'normal';
  } else if (releaseReport.recommendation === 'YES') {
    primaryAction = 'release_with_junya_approval';
    primaryPriority = 'low';
  } else if (snapshot.actionsStatus === 'pending') {
    primaryAction = 'wait_for_actions';
    primaryPriority = 'low';
  }

  const requiresHumanApproval = pushReport.humanApprovalRequired && pushReport.recommendation === 'YES'
    || releaseReport.humanApprovalRequired && releaseReport.recommendation === 'YES';

  return {
    report: 'auto-decision-report-generator',
    session_id,
    sessionGoal,
    primaryAction,
    primaryPriority,
    requiresHumanApproval,
    commit: commitReport,
    push: pushReport,
    release: releaseReport,
    dispatch: dispatchReport,
    summary: {
      commit: commitReport.recommendation,
      push: pushReport.recommendation,
      release: releaseReport.recommendation,
      dispatchTarget: dispatchReport.target
    },
    overallHealth: snapshot.overallHealth || 'unknown',
    version: '3.3.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateAutoDecisionReport };

if (require.main === module) {
  const result = generateAutoDecisionReport({
    verifyStatus: 'passed',
    actionsStatus: 'success',
    workingTreeClean: true,
    isAhead: false,
    geminiAvailable: false,
    packageVersion: '3.3.0',
    overallHealth: 'healthy',
    releaseDocsExist: true,
    taskHints: {}
  });
  console.log(JSON.stringify(result, null, 2));
}
