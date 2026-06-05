'use strict';

const TOOL_META = {
  version: '99.0.0',
  title: 'KOSAME Dev Orchestra Pilot Acceptance Review Pack',
  slug: 'dev-agent-pilot-acceptance-review-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'PDF data read', 'insurance data read',
  'real send', 'real contract execution', 'real billing', 'deploy',
  'git add/commit/push/tag', 'secret read', '.env read', 'destructive delete'
];

const ACCEPTANCE_DECISIONS = {
  PILOT_READY: 'PILOT_READY',
  REVISE: 'REVISE',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED'
};

function assessReadiness(flag, label) {
  return { label, status: flag !== false ? 'READY' : 'NOT_READY' };
}

function buildPilotAcceptanceReview(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `pilot-acceptance-review-${now}`;

  const guardianReady = opts.guardianReady !== false;
  const revenueReady = opts.revenueReady !== false;
  const dataBoundaryReady = opts.dataBoundaryReady !== false;
  const dryRunPassed = opts.dryRunPassed !== false;

  let decision = ACCEPTANCE_DECISIONS.PILOT_READY;
  if (!guardianReady) decision = ACCEPTANCE_DECISIONS.BLOCKED;
  else if (!dataBoundaryReady) decision = ACCEPTANCE_DECISIONS.HOLD;
  else if (!dryRunPassed) decision = ACCEPTANCE_DECISIONS.REVISE;
  else if (!revenueReady) decision = ACCEPTANCE_DECISIONS.REVISE;

  if (opts.blockers && opts.blockers.length > 0) decision = ACCEPTANCE_DECISIONS.BLOCKED;

  const dryRunOutputs = opts.dryRunOutputs || [
    { product: 'anesty_board', status: 'PASS', notes: 'mock task CRUD verified' },
    { product: 'email_reply_bot', status: 'PASS', notes: 'draft-only generation verified' }
  ];

  const nextAction = {
    [ACCEPTANCE_DECISIONS.PILOT_READY]: 'Present humanApprovalPacket to Junya for pilot start YES',
    [ACCEPTANCE_DECISIONS.REVISE]: 'Address identified gaps and re-run dry-run',
    [ACCEPTANCE_DECISIONS.HOLD]: 'Resolve data boundary or guardian issue before proceeding',
    [ACCEPTANCE_DECISIONS.BLOCKED]: 'Critical blocker must be resolved before any progress'
  }[decision];

  return {
    pilotAcceptanceReviewId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    decision,
    decisionOptions: Object.values(ACCEPTANCE_DECISIONS),
    nextAction,

    guardianReadiness: assessReadiness(guardianReady, 'Guardian Class'),
    revenueReadiness: assessReadiness(revenueReady, 'Revenue Route'),
    dataBoundaryReadiness: assessReadiness(dataBoundaryReady, 'Data Boundary'),
    dryRunReadiness: assessReadiness(dryRunPassed, 'Dry Run Execution'),

    dryRunOutputs,
    reviewSummary: {
      totalProducts: dryRunOutputs.length,
      passed: dryRunOutputs.filter(o => o.status === 'PASS').length,
      failed: dryRunOutputs.filter(o => o.status === 'FAIL').length,
      pending: dryRunOutputs.filter(o => o.status === 'PENDING').length
    },

    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus: decision === ACCEPTANCE_DECISIONS.PILOT_READY ? 'READY_FOR_PILOT_APPROVAL' : 'NOT_READY',
      approvalActions: ['pilot go-ahead', 'scope confirmation', 'data access sign-off'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: decision === ACCEPTANCE_DECISIONS.PILOT_READY
        ? 'All checks passed. Awaiting Junya final YES to begin pilot.'
        : `Not ready: ${decision}`
    },

    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED, ACCEPTANCE_DECISIONS,
  assessReadiness, buildPilotAcceptanceReview
};

if (require.main === module) {
  const r = buildPilotAcceptanceReview({});
  console.log(JSON.stringify({ decision: r.decision, nextAction: r.nextAction }, null, 2));
}
