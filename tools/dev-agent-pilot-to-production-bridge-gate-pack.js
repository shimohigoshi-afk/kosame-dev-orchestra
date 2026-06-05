'use strict';

const { buildOperatorRunbook }             = require('./dev-agent-operator-runbook-pack');
const { buildHumanApprovalCompression }    = require('./dev-agent-human-approval-compression-pack');
const { buildProductFeedbackCapture }      = require('./dev-agent-product-feedback-capture-pack');
const { buildRevisionSprintPlanner }       = require('./dev-agent-revision-sprint-planner-pack');

const TOOL_META = {
  version: '105.0.0',
  title: 'KOSAME Dev Orchestra Pilot-to-Production Bridge Gate Pack',
  slug: 'dev-agent-pilot-to-production-bridge-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy to production', 'real customer data read', 'Gmail data read',
  'insurance data read', 'PDF data read', 'real send', 'real contract execution',
  'real billing', 'git add/commit/push/tag', 'secret read', '.env read', 'destructive delete'
];

const BRIDGE_DECISIONS = {
  PRODUCTION_BRIDGE_READY: 'PRODUCTION_BRIDGE_READY',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED'
};

const PRODUCTION_READINESS_CHECKLIST = [
  { item: 'Guardian Class confirmed', required: true, field: 'guardianReady' },
  { item: 'Security review complete', required: true, field: 'securityReviewComplete' },
  { item: 'Privacy review complete', required: true, field: 'privacyReviewComplete' },
  { item: 'Cost estimate approved', required: true, field: 'costApproved' },
  { item: 'External reviewer sign-off', required: true, field: 'externalReviewDone' },
  { item: 'Pilot feedback addressed', required: true, field: 'feedbackAddressed' },
  { item: 'Data boundary cleared', required: true, field: 'dataBoundaryCleared' }
];

function buildPilotToProductionBridgeGate(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `pilot-to-production-bridge-gate-${now}`;
  const base = { timestamp: now };

  const runbook  = buildOperatorRunbook(Object.assign({}, base, opts.runbookOpts || {}));
  const approval = buildHumanApprovalCompression(Object.assign({}, base, opts.approvalOpts || {}));
  const feedback = buildProductFeedbackCapture(Object.assign({}, base, opts.feedbackOpts || {}));
  const sprints  = buildRevisionSprintPlanner(Object.assign({}, base, opts.sprintOpts || {}));

  const checklist = PRODUCTION_READINESS_CHECKLIST.map(item => ({
    ...item,
    status: opts[item.field] !== false ? 'READY' : 'NOT_READY'
  }));

  const allReady = checklist.every(c => c.status === 'READY');
  const notReadyItems = checklist.filter(c => c.status === 'NOT_READY').map(c => c.item);

  let decision = BRIDGE_DECISIONS.PRODUCTION_BRIDGE_READY;
  if (!allReady) {
    const hasRequired = notReadyItems.length > 0;
    decision = hasRequired ? BRIDGE_DECISIONS.NEEDS_REVIEW : BRIDGE_DECISIONS.PRODUCTION_BRIDGE_READY;
  }
  if (opts.guardianReady === false) decision = BRIDGE_DECISIONS.HOLD;
  if (opts.blockers && opts.blockers.length > 0) decision = BRIDGE_DECISIONS.BLOCKED;

  const completePackReady = decision === BRIDGE_DECISIONS.PRODUCTION_BRIDGE_READY;

  return {
    pilotToProductionBridgeGateId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    operatorRunbook: runbook,
    approvalCompression: approval,
    feedbackCapture: feedback,
    revisionSprints: sprints,

    productionReadinessChecklist: checklist,
    notReadyItems,

    decision,
    decisionOptions: Object.values(BRIDGE_DECISIONS),

    completePackReady,
    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus: completePackReady ? 'BRIDGE_READY_FOR_APPROVAL' : 'NOT_READY',
      approvalActions: ['production deployment authorization', 'external reviewer engagement', 'real customer access'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: completePackReady
        ? 'v101-v104 checks passed. Bridge gate ready. Awaiting Junya YES for production path.'
        : `Bridge gate not met: ${notReadyItems.join(', ') || decision}`
    },

    nextAction: completePackReady
      ? 'Junya reviews bridge gate and authorizes production readiness review'
      : `Resolve: ${notReadyItems.join(', ') || decision}`,

    realProductActionsExecuted: false,
    checkpointVersion: 'v105.0.0',
    checkpointNote: 'Pilot-to-Production Bridge Gate — integrates v101-v104',
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  BRIDGE_DECISIONS, PRODUCTION_READINESS_CHECKLIST,
  buildPilotToProductionBridgeGate
};

if (require.main === module) {
  const r = buildPilotToProductionBridgeGate({});
  console.log(JSON.stringify({ decision: r.decision, completePackReady: r.completePackReady }, null, 2));
}
