/**
 * Release Decision Report v3.3.0
 *
 * Derives release (tag/push) YES / NO / HOLD from Combined State Snapshot.
 * YES only when Actions status is 'success'.
 * Always requires じゅんやさんYES.
 */

function generateReleaseDecisionReport(snapshot = {}) {
  const {
    actionsStatus = 'unknown',
    verifyStatus = 'not_run',
    workingTreeClean = true,
    packageVersion = 'unknown',
    isAhead = false,
    repo = {},
    session_id = ''
  } = snapshot;

  const releaseDocsExist = snapshot.releaseDocsExist !== undefined
    ? snapshot.releaseDocsExist
    : true;

  const blockers = [];
  if (actionsStatus !== 'success') blockers.push(`GitHub Actions: ${actionsStatus} (must be success)`);
  if (verifyStatus !== 'passed') blockers.push(`verify: ${verifyStatus} (must be passed)`);
  if (!workingTreeClean) blockers.push('working tree dirty — commit first');
  if (isAhead) blockers.push('unpushed commits — push first');
  if (!releaseDocsExist) blockers.push('release docs missing');

  let recommendation = 'NO';
  if (actionsStatus === 'pending') {
    recommendation = 'HOLD';
  } else if (blockers.length === 0) {
    recommendation = 'YES';
  }

  const tagCommands = recommendation === 'YES' && packageVersion !== 'unknown' ? [
    `git tag v${packageVersion}`,
    `git push origin v${packageVersion}`
  ] : [];

  return {
    report: 'release-decision-report',
    session_id,
    recommendation,
    reason: blockers.length > 0 ? blockers.join(' / ')
      : `Actions PASS / verify PASS / clean tree → tag v${packageVersion} 候補`,
    actionsStatus,
    verifyStatus,
    workingTreeClean,
    packageVersion,
    blockers,
    tagCommands,
    humanApprovalRequired: true,
    gate_required: true,
    gate_reason: 'git tag / push は必ずじゅんやさんの最終YES後のみ実行。',
    nextAction: recommendation === 'YES' ? 'request_junya_yes_for_release'
      : actionsStatus === 'pending' ? 'wait_for_actions'
      : 'resolve_blockers',
    version: '3.3.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateReleaseDecisionReport };

if (require.main === module) {
  const result = generateReleaseDecisionReport({
    actionsStatus: 'success',
    verifyStatus: 'passed',
    workingTreeClean: true,
    packageVersion: '3.3.0',
    isAhead: false,
    releaseDocsExist: true
  });
  console.log(JSON.stringify(result, null, 2));
}
