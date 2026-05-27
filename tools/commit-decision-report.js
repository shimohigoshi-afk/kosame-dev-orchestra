/**
 * Commit Decision Report v3.3.0
 *
 * Derives commit YES / NO / HOLD from Combined State Snapshot.
 */

function generateCommitDecisionReport(snapshot = {}) {
  const {
    verifyStatus = 'not_run',
    workingTreeClean = true,
    overallHealth = 'unknown',
    repo = {},
    session_id = ''
  } = snapshot;

  const uncommittedFiles = (repo.uncommittedFiles || snapshot.uncommittedFiles || []);
  const hasChanges = !workingTreeClean || uncommittedFiles.length > 0;

  const blockers = [];
  if (verifyStatus === 'not_run') blockers.push('verify未実行 — npm run verify を先に実行');
  if (verifyStatus === 'failed') blockers.push('verify FAILED — Claude係長修正必要');
  if (verifyStatus === 'timeout') blockers.push('verify TIMEOUT — 再実行必要');
  if (!hasChanges) blockers.push('コミットする変更がない');

  let recommendation = 'NO';
  if (verifyStatus === 'not_run') {
    recommendation = 'HOLD';
  } else if (blockers.length === 0 || (blockers.length === 1 && blockers[0].includes('変更がない'))) {
    recommendation = hasChanges && verifyStatus === 'passed' ? 'YES' : 'HOLD';
  }

  const reason = blockers.length > 0
    ? blockers.join(' / ')
    : `verify PASS / 変更あり (${uncommittedFiles.length}件) / commit候補`;

  return {
    report: 'commit-decision-report',
    session_id,
    recommendation,
    reason,
    verifyStatus,
    hasChanges,
    uncommittedFiles,
    blockers,
    humanApprovalRequired: false,
    nextAction: recommendation === 'YES' ? 'run_commit_check' : 'resolve_blockers',
    version: '3.3.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateCommitDecisionReport };

if (require.main === module) {
  const result = generateCommitDecisionReport({
    verifyStatus: 'passed',
    workingTreeClean: false,
    repo: { uncommittedFiles: ['tools/foo.js'] }
  });
  console.log(JSON.stringify(result, null, 2));
}
