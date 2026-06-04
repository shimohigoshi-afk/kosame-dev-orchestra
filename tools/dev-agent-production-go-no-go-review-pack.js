'use strict';

const TOOL_META = {
  version: '53.0.0',
  title:   'KOSAME Dev Orchestra Production Go/No-Go Review Pack',
  slug:    'dev-agent-production-go-no-go-review-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const DECISION = {
  GO:              'GO',
  HOLD:            'HOLD',
  NO_GO:           'NO_GO',
  GO_WITH_CAUTION: 'GO_WITH_CAUTION'
};

const REQUIRED_CHECKS = [
  { checkId: 'req-001', title: 'Security review checklist: no blocker items FAILED', required: true },
  { checkId: 'req-002', title: 'External SE review completed (or explicitly waived)', required: true },
  { checkId: 'req-003', title: 'Rollback plan documented and tested',                required: true },
  { checkId: 'req-004', title: 'Customer / insurance data boundary confirmed safe',   required: true },
  { checkId: 'req-005', title: 'npm run verify PASS (all smokes green)',             required: true },
  { checkId: 'req-006', title: 'Human approval obtained for deploy',                 required: true },
  { checkId: 'req-007', title: 'Monitoring / alerting configured',                   required: false },
  { checkId: 'req-008', title: 'Backup / restore plan in place',                     required: false }
];

function determineDecision(opts) {
  opts = opts || {};
  const blockers  = opts.blockers  || [];
  const warnings  = opts.warnings  || [];

  // NO_GO conditions
  const hasSecretLeakRisk          = opts.secretLeakRisk      === true;
  const hasCustomerDataBoundaryUnknown = opts.customerDataBoundaryUnknown === true && opts.customerDataSeverity === 'critical';

  if (hasSecretLeakRisk) {
    return { decision: DECISION.NO_GO, reason: 'Secret leak risk detected. Must resolve before any production deploy.' };
  }
  if (hasCustomerDataBoundaryUnknown) {
    return { decision: DECISION.NO_GO, reason: 'Customer / insurance data boundary is unconfirmed (critical severity). Must confirm before production.' };
  }

  // HOLD conditions
  const deployUnapproved    = opts.deployApproved     === false;
  const rollbackMissing     = opts.rollbackPlanReady  === false;
  const blockerExists       = blockers.length > 0;
  const dataUnknown         = opts.customerDataBoundaryUnknown === true;

  if (deployUnapproved) {
    return { decision: DECISION.HOLD, reason: 'Deploy has not been approved by Human (じゅんやさん).' };
  }
  if (rollbackMissing) {
    return { decision: DECISION.HOLD, reason: 'Rollback plan is missing or untested.' };
  }
  if (blockerExists) {
    return { decision: DECISION.HOLD, reason: `Blockers present: ${blockers.join(', ')}` };
  }
  if (dataUnknown) {
    return { decision: DECISION.HOLD, reason: 'Customer / insurance data boundary is unconfirmed.' };
  }

  // GO conditions
  const allRequiredChecksPassed = opts.allRequiredChecksPassed !== false;
  if (allRequiredChecksPassed && warnings.length === 0) {
    return { decision: DECISION.GO, reason: 'All required checks passed. No blockers or warnings.' };
  }
  if (allRequiredChecksPassed && warnings.length > 0) {
    return { decision: DECISION.GO_WITH_CAUTION, reason: `All required checks passed, but warnings exist: ${warnings.join(', ')}` };
  }

  return { decision: DECISION.HOLD, reason: 'Not all required checks have been confirmed.' };
}

function buildGoNoGoReview(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const reviewId = `go-no-go-review-${now}`;

  const blockers = opts.blockers || [];
  const warnings = opts.warnings || [];

  const requiredChecks = (opts.requiredChecks || REQUIRED_CHECKS).map(c => ({
    ...c,
    status: (opts.checkStatuses || {})[c.checkId] || 'pending'
  }));

  const decisionResult = opts.decisionOverride
    ? { decision: opts.decisionOverride, reason: opts.decisionReason || 'Manual override' }
    : determineDecision(opts);

  return {
    reviewId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:       opts.product       || 'KOSAME Dev Orchestra / ANESTY Board',
    targetVersion: opts.targetVersion || TOOL_META.version,

    readinessSummary: opts.readinessSummary || 'Production readiness review in progress.',
    requiredChecks,
    blockers,
    warnings,

    externalReviewStatus:     opts.externalReviewStatus     || 'pending',
    securityChecklistStatus:  opts.securityChecklistStatus  || 'pending',
    rollbackPlanStatus:       opts.rollbackPlanStatus       || 'pending',
    monitoringStatus:         opts.monitoringStatus         || 'pending',
    dataProtectionStatus:     opts.dataProtectionStatus     || 'pending',

    decision:        decisionResult.decision,
    decisionOptions: Object.values(DECISION),
    decisionReason:  decisionResult.reason,

    humanApprovalRequired: true,
    finalHumanApprover:    'じゅんやさん',
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DECISION,
  REQUIRED_CHECKS,
  determineDecision,
  buildGoNoGoReview
};

if (require.main === module) {
  const review = buildGoNoGoReview({
    allRequiredChecksPassed: true,
    deployApproved:          true,
    rollbackPlanReady:       true
  });
  console.log(JSON.stringify(review, null, 2));
}
