'use strict';

const { buildFirstPilotOperationCompleteGate } = require('./dev-agent-first-pilot-operation-complete-gate-pack');
const { buildPilotToProductionBridgeGate }      = require('./dev-agent-pilot-to-production-bridge-gate-pack');
const { buildV1ReadinessAudit }                 = require('./dev-agent-v1-readiness-audit-pack');
const { buildExternalReviewFinalPacket }        = require('./dev-agent-external-review-final-packet-pack');
const { buildCostSpeedQualityScorecard }        = require('./dev-agent-cost-speed-quality-scorecard-pack');
const { buildProductExpansionRoadmap }          = require('./dev-agent-product-expansion-roadmap-pack');

const TOOL_META = {
  version: '110.0.0',
  title: 'KOSAME Dev Orchestra v1.0 Complete Gate Pack',
  slug: 'dev-agent-kosame-v1-complete-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy', 'git push/tag', 'real billing', 'real customer data access',
  'Gmail data read', 'insurance data read', 'PDF data read',
  'real send', 'real contract execution', 'secret read', '.env read',
  'destructive delete', 'self-authorize irreversible action'
];

const V1_DECISIONS = {
  V1_COMPLETE: 'V1_COMPLETE',
  V1_READY_WITH_REVIEW: 'V1_READY_WITH_REVIEW',
  NEEDS_MORE_WORK: 'NEEDS_MORE_WORK',
  BLOCKED: 'BLOCKED'
};

const REMAINING_RISKS = [
  { risk: 'Real customer pilot not yet executed', severity: 'medium', mitigatedBy: 'dry-run gate v96-v100' },
  { risk: 'Production deployment not validated', severity: 'medium', mitigatedBy: 'bridge gate v105' },
  { risk: 'External security review pending', severity: 'high', mitigatedBy: 'external review packet v107' },
  { risk: 'sales_dx data boundary unresolved', severity: 'high', mitigatedBy: 'explicit HOLD in v96 scope lock' },
  { risk: 'Gmail/PDF real send not cleared', severity: 'high', mitigatedBy: 'email_reply_bot HOLD in v96' }
];

function buildKosameV1CompleteGate(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `kosame-v1-complete-gate-${now}`;
  const base = { timestamp: now };

  const pilotGate     = buildFirstPilotOperationCompleteGate(Object.assign({}, base, opts.pilotGateOpts || {}));
  const bridgeGate    = buildPilotToProductionBridgeGate(Object.assign({}, base, opts.bridgeGateOpts || {}));
  const auditResult   = buildV1ReadinessAudit(Object.assign({}, base, opts.auditOpts || {}));
  const reviewPacket  = buildExternalReviewFinalPacket(Object.assign({}, base, opts.reviewOpts || {}));
  const scorecard     = buildCostSpeedQualityScorecard(Object.assign({}, base, opts.scorecardOpts || {}));
  const roadmap       = buildProductExpansionRoadmap(Object.assign({}, base, opts.roadmapOpts || {}));

  const guardianReady = opts.guardianReady !== false;
  const auditAllConfirmed = auditResult.auditDecision === 'ALL_COMPONENTS_CONFIRMED';

  let decision = V1_DECISIONS.V1_COMPLETE;
  if (!guardianReady) decision = V1_DECISIONS.BLOCKED;
  else if (opts.blockers && opts.blockers.length > 0) decision = V1_DECISIONS.BLOCKED;
  else if (!auditAllConfirmed) decision = V1_DECISIONS.V1_READY_WITH_REVIEW;
  else if (REMAINING_RISKS.some(r => r.severity === 'high')) decision = V1_DECISIONS.V1_READY_WITH_REVIEW;

  const backupRequired = decision !== V1_DECISIONS.BLOCKED;

  const nextPhaseRoadmap = [
    'v111+: Real pilot execution (anesty_board) with Junya approval',
    'v115+: Limited production deployment (anesty_board)',
    'v120+: email_reply_bot draft-only pilot (after Gmail boundary cleared)',
    'v130+: sales_dx pilot (after data boundary legal/privacy review)',
    'v140+: Multi-product production operations'
  ];

  return {
    kosameV1CompleteGateId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    orchestraVersion: TOOL_META.version,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    // Integrated sub-gates v96-v109
    pilotOperationCompleteGate: pilotGate,
    pilotToProductionBridgeGate: bridgeGate,
    v1ReadinessAudit: auditResult,
    externalReviewPacket: reviewPacket,
    costSpeedQualityScorecard: scorecard,
    productExpansionRoadmap: roadmap,

    decision,
    decisionOptions: Object.values(V1_DECISIONS),

    versionRange: 'v96.0.0 - v110.0.0',
    completedPacks: {
      'v96': 'Pilot Scope Lock',
      'v97': 'Pilot Work Order Builder',
      'v98': 'Pilot Dry Run Execution Plan',
      'v99': 'Pilot Acceptance Review',
      'v100': 'First Pilot Operation Complete Gate',
      'v101': 'Operator Runbook',
      'v102': 'Human Approval Compression',
      'v103': 'Product Feedback Capture',
      'v104': 'Revision Sprint Planner',
      'v105': 'Pilot-to-Production Bridge Gate',
      'v106': 'v1.0 Readiness Audit',
      'v107': 'External Review Final Packet',
      'v108': 'Cost/Speed/Quality Scorecard',
      'v109': 'Product Expansion Roadmap',
      'v110': 'KOSAME Dev Orchestra v1.0 Complete Gate'
    },

    remainingRisks: REMAINING_RISKS,
    backupRequired,
    nextPhaseRoadmap,

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus: decision === V1_DECISIONS.V1_COMPLETE ? 'V1_COMPLETE_READY_FOR_DECLARATION'
        : decision === V1_DECISIONS.V1_READY_WITH_REVIEW ? 'V1_READY_PENDING_REVIEW'
        : 'NOT_READY',
      approvalActions: [
        'v1.0 version declaration (git commit/tag)',
        'production deployment authorization',
        'real pilot start',
        'external reviewer engagement',
        'real customer outreach'
      ],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: `KOSAME Dev Orchestra v110.0.0 complete. Decision: ${decision}. ` +
        'All v96-v110 packs implemented. Awaiting Junya final YES for v1.0 declaration.'
    },

    productExpansionPlan: roadmap.summary,
    auditScore: auditResult.auditScore,

    nextCommandsForHumanOwner: [
      '1. Review this report',
      '2. Run: npm run smoke:kosame-v1-complete-gate',
      '3. Run: npm run verify',
      `4. If decision is ${V1_DECISIONS.V1_COMPLETE} or ${V1_DECISIONS.V1_READY_WITH_REVIEW}: give YES for git commit`,
      '5. After commit: give YES for git tag v110.0.0',
      '6. After tag: give YES for git push + GitHub Actions',
      '7. Review remainingRisks before production deployment'
    ],

    realProductActionsExecuted: false,
    checkpointVersion: 'v110.0.0',
    checkpointNote: 'KOSAME Dev Orchestra v1.0 Complete Gate — integrates v96-v109',
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  V1_DECISIONS, REMAINING_RISKS,
  buildKosameV1CompleteGate
};

if (require.main === module) {
  const r = buildKosameV1CompleteGate({});
  console.log(JSON.stringify({
    decision: r.decision,
    auditScore: r.auditScore,
    remainingRisks: r.remainingRisks.length,
    nextCommands: r.nextCommandsForHumanOwner
  }, null, 2));
}
