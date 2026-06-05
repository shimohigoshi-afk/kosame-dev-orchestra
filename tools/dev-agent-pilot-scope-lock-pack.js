'use strict';

const TOOL_META = {
  version: '96.0.0',
  title: 'KOSAME Dev Orchestra Pilot Scope Lock Pack',
  slug: 'dev-agent-pilot-scope-lock-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'insurance data read', 'Gmail data read', 'PDF data read',
  'real send', 'real contract execution', 'real billing', 'deploy',
  'git add/commit/push/tag', 'secret read', '.env read', 'destructive delete'
];

const PILOT_DECISIONS = {
  ANESTY_BOARD_PILOT: 'ANESTY_BOARD_PILOT',
  SALES_DX_HOLD: 'SALES_DX_HOLD',
  VALIDATE_MORE: 'VALIDATE_MORE',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED'
};

const PRODUCTS = {
  anesty_board: {
    pilotCandidate: true,
    dataRisk: 'low',
    holdReason: null,
    approvedScope: ['task CRUD dry-run', 'board display', 'docs editing', 'local mock data only'],
    excludedScope: ['real customer data', 'real billing', 'real deploy', 'live external sends'],
    dataBoundary: 'local/mock only'
  },
  sales_dx: {
    pilotCandidate: false,
    dataRisk: 'high',
    holdReason: 'real customer/insurance/Gmail/PDF data boundary not cleared',
    approvedScope: [],
    excludedScope: ['all real data operations', 'Gmail read', 'PDF processing', 'insurance data'],
    dataBoundary: 'HOLD - external data risk unresolved'
  },
  email_reply_bot: {
    pilotCandidate: false,
    dataRisk: 'medium',
    holdReason: 'real send/Gmail boundary not cleared for full pilot',
    approvedScope: ['draft-only mode'],
    excludedScope: ['real Gmail send', 'real customer email read', 'real contract'],
    dataBoundary: 'draft-only only'
  },
  backoffice_agent: {
    pilotCandidate: false,
    dataRisk: 'medium',
    holdReason: 'broader scope review pending',
    approvedScope: [],
    excludedScope: ['real billing data', 'real customer data'],
    dataBoundary: 'HOLD - scope review pending'
  }
};

function buildPilotScopeLock(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `pilot-scope-lock-${now}`;

  const guardianReady = opts.guardianReady !== false;
  const revenueReady = opts.revenueReady !== false;

  const pilotProduct = opts.pilotProduct || 'anesty_board';
  const pilot = PRODUCTS[pilotProduct] || PRODUCTS.anesty_board;

  let decision = PILOT_DECISIONS.ANESTY_BOARD_PILOT;
  if (!guardianReady) decision = PILOT_DECISIONS.HOLD;
  if (opts.blockers && opts.blockers.length > 0) decision = PILOT_DECISIONS.BLOCKED;

  return {
    pilotScopeLockId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    pilotProduct,
    pilotScope: pilot.approvedScope,
    excludedScope: pilot.excludedScope,
    dataBoundary: pilot.dataBoundary,
    guardianRequired: true,
    approvalGates: [
      'Junya final YES for pilot start',
      'Guardian readiness confirmed',
      'data boundary sign-off',
      'no real customer data confirmed'
    ],

    productStatus: Object.entries(PRODUCTS).reduce((acc, [k, v]) => {
      acc[k] = {
        pilotCandidate: v.pilotCandidate,
        holdReason: v.holdReason,
        dataBoundary: v.dataBoundary
      };
      return acc;
    }, {}),

    decision,
    decisionOptions: Object.values(PILOT_DECISIONS),

    guardianReadiness: { status: guardianReady ? 'READY' : 'NOT_CONFIRMED' },
    revenueReadiness: { status: revenueReady ? 'READY' : 'NOT_CONFIRMED' },

    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['pilot start', 'scope expansion beyond draft', 'real data access'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Junya must approve before any pilot execution begins. AI may not self-authorize pilot start.'
    },

    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = { TOOL_META, DANGEROUS_ACTIONS_DENIED, PILOT_DECISIONS, PRODUCTS, buildPilotScopeLock };

if (require.main === module) {
  const r = buildPilotScopeLock({});
  console.log(JSON.stringify({ decision: r.decision, pilotProduct: r.pilotProduct, dataBoundary: r.dataBoundary }, null, 2));
}
