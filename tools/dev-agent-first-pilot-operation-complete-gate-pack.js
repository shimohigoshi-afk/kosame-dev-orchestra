'use strict';

const { buildPilotScopeLock }             = require('./dev-agent-pilot-scope-lock-pack');
const { buildWorkOrder }                  = require('./dev-agent-pilot-work-order-builder-pack');
const { buildPilotDryRunExecutionPlan }   = require('./dev-agent-pilot-dry-run-execution-plan-pack');
const { buildPilotAcceptanceReview }      = require('./dev-agent-pilot-acceptance-review-pack');

const TOOL_META = {
  version: '100.0.0',
  title: 'KOSAME Dev Orchestra First Pilot Operation Complete Gate Pack',
  slug: 'dev-agent-first-pilot-operation-complete-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'PDF data read', 'insurance data read',
  'real send', 'real contract execution', 'real billing', 'deploy',
  'git add/commit/push/tag', 'secret read', '.env read', 'destructive delete'
];

const GATE_DECISIONS = {
  FIRST_PILOT_READY: 'FIRST_PILOT_READY',
  VALIDATE_MORE: 'VALIDATE_MORE',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED'
};

function buildFirstPilotOperationCompleteGate(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `first-pilot-operation-complete-gate-${now}`;
  const base = { timestamp: now };

  const scopeLock   = buildPilotScopeLock(Object.assign({}, base, opts.scopeLockOpts || {}));
  const workOrder   = buildWorkOrder(Object.assign({}, base, opts.workOrderOpts || {}));
  const dryRunPlan  = buildPilotDryRunExecutionPlan(Object.assign({}, base, opts.dryRunOpts || {}));
  const acceptance  = buildPilotAcceptanceReview(Object.assign({}, base, opts.acceptanceOpts || {}));

  const guardianReady = opts.guardianReady !== false;
  const revenueReady  = opts.revenueReady  !== false;

  let decision = GATE_DECISIONS.FIRST_PILOT_READY;
  if (!guardianReady) decision = GATE_DECISIONS.HOLD;
  else if (acceptance.decision === 'BLOCKED') decision = GATE_DECISIONS.BLOCKED;
  else if (acceptance.decision === 'HOLD') decision = GATE_DECISIONS.HOLD;
  else if (acceptance.decision === 'REVISE') decision = GATE_DECISIONS.VALIDATE_MORE;
  if (opts.blockers && opts.blockers.length > 0) decision = GATE_DECISIONS.BLOCKED;

  const completePackReady = decision === GATE_DECISIONS.FIRST_PILOT_READY;

  return {
    firstPilotOperationCompleteGateId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    orchestraVersion: TOOL_META.version,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    pilotScopeLock: scopeLock,
    workOrder: workOrder,
    dryRunPlan: dryRunPlan,
    acceptanceReview: acceptance,

    decision,
    decisionOptions: Object.values(GATE_DECISIONS),

    guardianReadiness: { status: guardianReady ? 'READY' : 'NOT_CONFIRMED' },
    revenueReadiness:  { status: revenueReady  ? 'READY' : 'NOT_CONFIRMED' },

    completePackReady,
    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus: completePackReady ? 'FIRST_PILOT_READY_FOR_APPROVAL' : 'NOT_READY',
      approvalActions: ['pilot start', 'real customer outreach', 'live deployment'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: completePackReady
        ? 'v96-v99 checks passed. First pilot operation gate complete. Awaiting Junya YES.'
        : `Gate not met: ${decision}`
    },

    nextAction: completePackReady
      ? 'Junya reviews humanApprovalPacket and gives final YES to begin pilot'
      : `Resolve gate issue: ${decision}`,

    realProductActionsExecuted: false,
    checkpointVersion: 'v100.0.0',
    checkpointNote: 'First Pilot Operation Readiness Completion Gate — integrates v96-v99',
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED, GATE_DECISIONS,
  buildFirstPilotOperationCompleteGate
};

if (require.main === module) {
  const r = buildFirstPilotOperationCompleteGate({});
  console.log(JSON.stringify({ decision: r.decision, completePackReady: r.completePackReady }, null, 2));
}
