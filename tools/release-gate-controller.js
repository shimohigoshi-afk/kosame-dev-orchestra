/**
 * Release Gate Controller v2.9.0
 *
 * Controls whether a release can proceed through the gate.
 * Gate is always required — only opens after all checks pass AND じゅんやさんYES.
 */

const GATE_STATUSES = {
  OPEN: 'open',
  CLOSED: 'closed',
  PENDING: 'pending'
};

function evaluateReleaseGate(gateInput = {}) {
  const {
    targetVersion = '',
    actionsStatus = 'unknown',
    verifyStatus = 'not_run',
    verifyPassed = 0,
    verifyFailed = 0,
    workingTreeClean = true,
    releaseDocsExist = false,
    packageVersionMatch = false,
    junyaApproved = false,
    session_id = ''
  } = gateInput;

  const checks = {
    actions_ok: actionsStatus === 'success',
    verify_ok: verifyStatus === 'passed' && verifyFailed === 0,
    working_tree_clean: workingTreeClean,
    release_docs: releaseDocsExist,
    version_match: packageVersionMatch,
    junya_approved: junyaApproved
  };

  const technicalBlockers = [];
  if (!checks.actions_ok) technicalBlockers.push(`GitHub Actions: ${actionsStatus}`);
  if (!checks.verify_ok) technicalBlockers.push(`verify: ${verifyStatus} / failed: ${verifyFailed}`);
  if (!checks.working_tree_clean) technicalBlockers.push('working tree dirty');
  if (!checks.release_docs) technicalBlockers.push('release docs missing');
  if (!checks.version_match) technicalBlockers.push('package version mismatch');

  const technicallyReady = technicalBlockers.length === 0;
  const gateStatus = !technicallyReady
    ? GATE_STATUSES.CLOSED
    : junyaApproved
      ? GATE_STATUSES.OPEN
      : GATE_STATUSES.PENDING;

  const allowRelease = gateStatus === GATE_STATUSES.OPEN;

  return {
    controller: 'release-gate-controller',
    session_id,
    targetVersion,
    gateStatus,
    allowRelease,
    technicallyReady,
    junyaApproved,
    checks,
    technicalBlockers,
    gateReason: gateStatus === GATE_STATUSES.OPEN
      ? 'All checks pass + じゅんやさんYES confirmed'
      : gateStatus === GATE_STATUSES.PENDING
        ? 'Technical checks pass — waiting for じゅんやさんYES'
        : `Gate CLOSED: ${technicalBlockers.join(' / ')}`,
    humanApprovalRequired: true,
    verifyPassed,
    actionsStatus,
    version: '2.9.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { evaluateReleaseGate, GATE_STATUSES };

if (require.main === module) {
  const result = evaluateReleaseGate({
    targetVersion: '2.9.0',
    actionsStatus: 'success',
    verifyStatus: 'passed',
    verifyPassed: 94,
    verifyFailed: 0,
    workingTreeClean: true,
    releaseDocsExist: true,
    packageVersionMatch: true,
    junyaApproved: false
  });
  console.log(JSON.stringify(result, null, 2));
}
