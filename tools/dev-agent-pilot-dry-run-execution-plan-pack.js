'use strict';

const TOOL_META = {
  version: '98.0.0',
  title: 'KOSAME Dev Orchestra Pilot Dry Run Execution Plan Pack',
  slug: 'dev-agent-pilot-dry-run-execution-plan-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real send', 'real billing', 'real deploy', 'real customer data read',
  'Gmail data read', 'PDF data read', 'insurance data read',
  'secret read', '.env read', 'git add/commit/push/tag', 'destructive delete'
];

const DRY_RUN_DECISIONS = {
  DRY_RUN_READY: 'DRY_RUN_READY',
  REVISE: 'REVISE',
  HOLD: 'HOLD',
  BLOCKED: 'BLOCKED'
};

const DRY_RUN_CANDIDATES = {
  anesty_board: {
    eligible: true,
    dryRunMode: 'local mock task CRUD + board display',
    preventedActions: ['real deploy', 'real customer data', 'real billing'],
    safetyLevel: 'high'
  },
  email_reply_bot: {
    eligible: true,
    dryRunMode: 'draft-only email generation, no real send',
    preventedActions: ['real Gmail send', 'real customer email read', 'real contract'],
    safetyLevel: 'medium'
  },
  sales_dx: {
    eligible: false,
    dryRunMode: null,
    preventedActions: ['all — full HOLD until data boundary cleared'],
    safetyLevel: 'low'
  },
  backoffice_agent: {
    eligible: false,
    dryRunMode: null,
    preventedActions: ['all — full HOLD until scope review complete'],
    safetyLevel: 'low'
  }
};

function buildPilotDryRunExecutionPlan(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `pilot-dry-run-plan-${now}`;

  const targetProducts = opts.targetProducts || ['anesty_board', 'email_reply_bot'];
  const guardianReady = opts.guardianReady !== false;

  let decision = DRY_RUN_DECISIONS.DRY_RUN_READY;
  if (!guardianReady) decision = DRY_RUN_DECISIONS.HOLD;
  if (opts.blockers && opts.blockers.length > 0) decision = DRY_RUN_DECISIONS.BLOCKED;

  const plans = targetProducts.reduce((acc, prod) => {
    const candidate = DRY_RUN_CANDIDATES[prod];
    if (!candidate) return acc;
    acc[prod] = {
      eligible: candidate.eligible,
      dryRunMode: candidate.dryRunMode,
      preventedActions: candidate.preventedActions,
      safetyLevel: candidate.safetyLevel,
      executionSteps: candidate.eligible ? [
        `1. Load mock/fixture data for ${prod}`,
        `2. Execute dry-run task in ${candidate.dryRunMode}`,
        '3. Capture output without external side effects',
        '4. Run smoke verification',
        '5. Report result to human for review'
      ] : [`${prod} is HOLD — do not execute`]
    };
    return acc;
  }, {});

  const safetyChecklist = [
    { check: 'no real sends', enforced: true },
    { check: 'no real billing', enforced: true },
    { check: 'no real deploy', enforced: true },
    { check: 'no customer data reads', enforced: true },
    { check: 'no secret/.env reads', enforced: true },
    { check: 'no destructive operations', enforced: true },
    { check: 'dryRun flag = true in all outputs', enforced: true }
  ];

  return {
    pilotDryRunPlanId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    targetProducts,
    dryRunPlans: plans,
    dryRunCandidates: DRY_RUN_CANDIDATES,
    safetyChecklist,

    decision,
    decisionOptions: Object.values(DRY_RUN_DECISIONS),

    guardianReadiness: { status: guardianReady ? 'READY' : 'NOT_CONFIRMED' },
    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['dry-run result review', 'pilot start authorization'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'All dry-run outputs must be reviewed by Junya before proceeding to real pilot'
    },

    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED, DRY_RUN_DECISIONS,
  DRY_RUN_CANDIDATES, buildPilotDryRunExecutionPlan
};

if (require.main === module) {
  const r = buildPilotDryRunExecutionPlan({});
  console.log(JSON.stringify({ decision: r.decision, plans: Object.keys(r.dryRunPlans) }, null, 2));
}
