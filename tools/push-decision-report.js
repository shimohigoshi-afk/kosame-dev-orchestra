/**
 * Push Decision Report v3.3.0
 *
 * Derives push YES / NO / HOLD from Combined State Snapshot.
 * Push always requires じゅんやさんYES — gate_required: true.
 */

function generatePushDecisionReport(snapshot = {}) {
  const {
    verifyStatus = 'not_run',
    workingTreeClean = true,
    isAhead = false,
    actionsStatus = 'unknown',
    session_id = ''
  } = snapshot;

  const blockers = [];
  if (!workingTreeClean) blockers.push('uncommitted changes — commit first');
  if (verifyStatus !== 'passed') blockers.push(`verify ${verifyStatus} — must be passed`);
  if (!isAhead) blockers.push('originより進んでいない — pushする内容がない');

  let recommendation = 'HOLD';
  if (blockers.length > 0 && !blockers.every(b => b.includes('進んでいない'))) {
    recommendation = 'NO';
  } else if (!isAhead) {
    recommendation = 'HOLD';
  } else if (workingTreeClean && verifyStatus === 'passed' && isAhead) {
    recommendation = 'YES';
  }

  return {
    report: 'push-decision-report',
    session_id,
    recommendation,
    reason: blockers.length > 0 ? blockers.join(' / ') : 'Working tree clean / verify PASS / origin先行 → push候補',
    verifyStatus,
    workingTreeClean,
    isAhead,
    actionsStatus,
    blockers,
    humanApprovalRequired: true,
    gate_required: true,
    gate_reason: 'git push は必ずじゅんやさんの最終YES後のみ実行。',
    nextAction: recommendation === 'YES' ? 'request_junya_yes_for_push' : 'resolve_blockers',
    version: '3.3.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generatePushDecisionReport };

if (require.main === module) {
  const result = generatePushDecisionReport({
    verifyStatus: 'passed',
    workingTreeClean: true,
    isAhead: true,
    actionsStatus: 'success'
  });
  console.log(JSON.stringify(result, null, 2));
}
