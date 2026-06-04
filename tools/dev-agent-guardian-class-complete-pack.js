'use strict';

const { buildAttackSurfaceReview }      = require('./dev-agent-guardian-attack-surface-review-pack');
const { buildCustomerFacingGuard }      = require('./dev-agent-guardian-customer-facing-operation-guard-pack');
const { buildDataSecretPermissionGate } = require('./dev-agent-guardian-data-secret-permission-gate-pack');
const { buildRedTeamDryRun }            = require('./dev-agent-guardian-defensive-red-team-dry-run-pack');

const TOOL_META = {
  version: '70.0.0',
  title:   'KOSAME Dev Orchestra Guardian Class Complete Pack',
  slug:    'dev-agent-guardian-class-complete-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real exploit execution',
  'real email send',
  'real customer data access'
];

const GUARDIAN_COMPLETE_CRITERIA = [
  'attackSurfaceReview exists with 5+ surfaces',
  'customerFacingGuard exists with insurance sales risk notes',
  'dataSecretPermissionGate exists with data/secret/permission gates',
  'defensiveRedTeamDryRun exists with 5+ scenarios',
  'no real attack / real send / real secret access',
  'completePackReady true only when no blockers'
];

function assessGuardianReadiness(pack) {
  const blockers = pack.blockers || [];
  if (blockers.length > 0) return { status: 'BLOCKED', reason: blockers.join(', ') };

  const asrStatus  = pack.attackSurfaceReview && pack.attackSurfaceReview.overallRiskLevel;
  const cfgStatus  = pack.customerFacingGuard && pack.customerFacingGuard.overallStatus;
  const dspStatus  = pack.dataSecretPermissionGate && pack.dataSecretPermissionGate.overallGateStatus;
  const rtStatus   = pack.defensiveRedTeamDryRun && pack.defensiveRedTeamDryRun.overallStatus;

  if (cfgStatus === 'GUARD_FAILED' || dspStatus === 'GATE_OPEN_CRITICAL' || rtStatus === 'DEFENSE_FAILED') {
    return { status: 'NEEDS_REMEDIATION', reason: 'One or more guardian checks failed' };
  }
  return { status: 'READY', reason: 'All guardian checks reviewed (pending items require ongoing monitoring)' };
}

function buildGuardianClassComplete(opts) {
  opts = opts || {};
  const now             = opts.timestamp || Date.now();
  const completePackId  = `guardian-class-complete-${now}`;
  const sharedBase      = { timestamp: now, product: opts.product || 'KOSAME Dev Orchestra' };

  const attackSurfaceReview      = buildAttackSurfaceReview(Object.assign({}, sharedBase, opts.asrOpts    || {}));
  const customerFacingGuard      = buildCustomerFacingGuard(Object.assign({}, sharedBase, opts.cfgOpts    || {}));
  const dataSecretPermissionGate = buildDataSecretPermissionGate(Object.assign({}, sharedBase, opts.dspOpts || {}));
  const defensiveRedTeamDryRun   = buildRedTeamDryRun(Object.assign({}, sharedBase, opts.rtOpts          || {}));

  const blockers       = opts.blockers || [];
  const completePackReady = blockers.length === 0;

  const guardianReadiness = assessGuardianReadiness({
    blockers,
    attackSurfaceReview,
    customerFacingGuard,
    dataSecretPermissionGate,
    defensiveRedTeamDryRun
  });

  return {
    completePackId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    attackSurfaceReview,
    customerFacingGuard,
    dataSecretPermissionGate,
    defensiveRedTeamDryRun,

    guardianReadiness,
    completeCriteria:  GUARDIAN_COMPLETE_CRITERIA,
    completePackReady,
    blockers,
    nextAction: completePackReady
      ? 'Guardian Class 完了。Revenue Launch Lineへ進む前にこさめ/GPTがレビュー → じゅんやさん最終YES'
      : `blockers解消が必要: ${blockers.join(', ')}`,
    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus:         completePackReady ? 'READY_FOR_REVIEW' : 'BLOCKED',
      note:                  'じゅんやさんがGuardian Class完了を確認してから Revenue Launch Lineへ進む'
    },
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  GUARDIAN_COMPLETE_CRITERIA,
  assessGuardianReadiness,
  buildGuardianClassComplete
};

if (require.main === module) {
  const result = buildGuardianClassComplete({});
  console.log(JSON.stringify({ version: result.version, completePackReady: result.completePackReady, guardianReadiness: result.guardianReadiness }, null, 2));
}
