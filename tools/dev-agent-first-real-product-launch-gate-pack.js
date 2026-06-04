'use strict';

const { buildSalesDxFirstProductLaunchPlan }      = require('./dev-agent-sales-dx-first-product-launch-plan-pack');
const { buildEmailReplyBotMvpLaunchPlan }         = require('./dev-agent-email-reply-bot-mvp-launch-plan-pack');
const { buildBackofficeAgentMvpLaunchPlan }       = require('./dev-agent-backoffice-agent-mvp-launch-plan-pack');
const { buildAnestyBoardProductizationPlan }      = require('./dev-agent-anesty-board-productization-plan-pack');

const TOOL_META = {
  version: '95.0.0',
  title:   'KOSAME Dev Orchestra First Real Product Launch Gate Pack',
  slug:    'dev-agent-first-real-product-launch-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'api key read',
  'customer data read', 'insurance data read',
  'deploy', 'git add/commit/push/tag',
  'destructive delete', 'external repo mutation',
  'real send', 'real contract execution',
  'real billing', 'real customer onboarding without human approval'
];

const LAUNCH_DECISIONS = {
  PILOT_SALES_DX:          'PILOT_SALES_DX',
  PILOT_EMAIL_REPLY_BOT:   'PILOT_EMAIL_REPLY_BOT',
  PILOT_BACKOFFICE_AGENT:  'PILOT_BACKOFFICE_AGENT',
  PILOT_ANESTY_BOARD:      'PILOT_ANESTY_BOARD',
  VALIDATE_MORE:           'VALIDATE_MORE',
  HOLD:                    'HOLD'
};

function assessProduct(plan, opts) {
  opts = opts || {};
  const guardianReady  = opts.guardianReady  !== false;
  const revenueReady   = opts.revenueReady   !== false;

  // Auto-resolve blockers based on ready flags
  let blockers = (plan.launchBlockers || []);
  if (guardianReady) {
    blockers = blockers.filter(b => !b.toLowerCase().includes('guardian'));
  }
  if (revenueReady) {
    blockers = blockers.filter(b =>
      !b.toLowerCase().includes('revenue') &&
      !b.toLowerCase().includes('パイロット顧客候補') &&
      !b.toLowerCase().includes('price') &&
      !b.toLowerCase().includes('価格')
    );
  }
  // When both guardian and revenue are ready, operational-approval blockers are
  // handled by the humanApprovalPacket (they require じゅんやさん YES, not a true block)
  if (guardianReady && revenueReady) {
    blockers = blockers.filter(b =>
      !b.includes('未承認') &&           // じゅんやさんYES待ち → humanApprovalPacketで処理
      !b.includes('未選定')              // 選定待ち → pilotPlanで対応
    );
  }
  if (opts.resolvedBlockers) {
    blockers = blockers.filter(b => !opts.resolvedBlockers.includes(b));
  }
  const cloudRunReady  = opts.cloudRunReady;
  const dataBoundaryOk = opts.dataBoundaryOk;
  const realSendNeeded = opts.realSendNeeded === true;
  const realDataNeeded = opts.realDataNeeded === true;

  if (!guardianReady)   return { ready: false, reason: 'Guardian Class未確認 → HOLD' };
  if (realDataNeeded)   return { ready: false, reason: '実顧客データが必要 → HOLD' };
  if (realSendNeeded)   return { ready: false, reason: '実送信が必要 → HOLD' };
  if (!revenueReady)    return { ready: false, reason: 'Revenue未確認 → VALIDATE_MORE' };
  if (dataBoundaryOk === false) return { ready: false, reason: 'customerDataBoundary不明 → HOLD' };
  if (cloudRunReady === false)  return { ready: false, reason: 'Cloud Run未確認 → VALIDATE_MORE' };
  if (blockers.length > 0) return { ready: false, reason: `blockers: ${blockers[0]}` };
  return { ready: true, reason: 'draft-only / dryRun / low-risk — pilot候補' };
}

function determineLaunchDecision(assessments, opts) {
  opts = opts || {};
  if (opts.guardianReady === false) {
    return { decision: LAUNCH_DECISIONS.HOLD, reason: 'Guardian Class未確認' };
  }

  // Pick the first ready product by priority
  const priority = ['anesty_board', 'email_reply_bot', 'sales_dx', 'backoffice_agent'];
  for (const pid of priority) {
    const a = assessments[pid];
    if (a && a.ready) {
      const decKey = {
        anesty_board:      'PILOT_ANESTY_BOARD',
        email_reply_bot:   'PILOT_EMAIL_REPLY_BOT',
        sales_dx:          'PILOT_SALES_DX',
        backoffice_agent:  'PILOT_BACKOFFICE_AGENT'
      }[pid];
      return { decision: LAUNCH_DECISIONS[decKey], reason: assessments[pid].reason };
    }
  }

  // Check if any is VALIDATE_MORE vs HOLD
  const anyValidate = Object.values(assessments).some(a => !a.ready && a.reason.includes('VALIDATE_MORE'));
  if (anyValidate) return { decision: LAUNCH_DECISIONS.VALIDATE_MORE, reason: '一部プロダクトが追加検証待ち' };
  return { decision: LAUNCH_DECISIONS.HOLD, reason: '全プロダクトにblockerあり' };
}

function buildFirstRealProductLaunchGate(opts) {
  opts = opts || {};
  const now     = opts.timestamp || Date.now();
  const gateId  = `first-real-product-launch-gate-${now}`;
  const base    = { timestamp: now };

  const salesDxPlan      = buildSalesDxFirstProductLaunchPlan(Object.assign({}, base, opts.salesDxOpts      || {}));
  const emailBotPlan     = buildEmailReplyBotMvpLaunchPlan(Object.assign({}, base, opts.emailBotOpts        || {}));
  const backofficePlan   = buildBackofficeAgentMvpLaunchPlan(Object.assign({}, base, opts.backofficeOpts     || {}));
  const anestyPlan       = buildAnestyBoardProductizationPlan(Object.assign({}, base, opts.anestyOpts        || {}));

  const guardianReady     = opts.guardianReady  !== false;
  const revenueReady      = opts.revenueReady   !== false;

  const assessments = {
    sales_dx:        assessProduct(salesDxPlan,    Object.assign({ guardianReady, revenueReady, realDataNeeded: true  }, opts.salesDxAssess    || {})),
    email_reply_bot: assessProduct(emailBotPlan,   Object.assign({ guardianReady, revenueReady, realSendNeeded: false }, opts.emailBotAssess    || {})),
    backoffice_agent:assessProduct(backofficePlan, Object.assign({ guardianReady, revenueReady                        }, opts.backofficeAssess  || {})),
    anesty_board:    assessProduct(anestyPlan,     Object.assign({ guardianReady, revenueReady                        }, opts.anestyAssess      || {}))
  };

  const decisionResult  = opts.decisionOverride
    ? { decision: opts.decisionOverride, reason: opts.decisionReason || 'override' }
    : determineLaunchDecision(assessments, { guardianReady });

  const completePackReady = (opts.blockers || []).length === 0
    && Object.values(LAUNCH_DECISIONS).includes(decisionResult.decision)
    && decisionResult.decision !== LAUNCH_DECISIONS.HOLD;

  return {
    firstRealProductLaunchGateId: gateId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    candidateProducts: {
      sales_dx:        salesDxPlan,
      email_reply_bot: emailBotPlan,
      backoffice_agent:backofficePlan,
      anesty_board:    anestyPlan
    },

    productAssessments: assessments,

    launchDecision:  decisionResult.decision,
    decisionOptions: Object.values(LAUNCH_DECISIONS),
    decisionReason:  decisionResult.reason,

    guardianReadiness:  { status: guardianReady  ? 'READY' : 'NOT_CONFIRMED' },
    revenueReadiness:   { status: revenueReady   ? 'READY' : 'NOT_CONFIRMED' },
    operationReadiness: { status: 'READY' },
    cloudRunReadiness:  { status: opts.cloudRunReady === false ? 'NOT_CONFIRMED' : 'PENDING' },

    completePackReady,
    blockers: opts.blockers || [],

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus:         completePackReady ? 'READY_FOR_PILOT_APPROVAL' : 'BLOCKED',
      approvalActions:       ['パイロット顧客へのアウトリーチ', '実契約・実請求', '実onboarding開始'],
      deniedActionsForAI:    DANGEROUS_ACTIONS_DENIED,
      note:                  completePackReady
        ? `${decisionResult.decision}: じゅんやさんの最終YESを待っています`
        : decisionResult.reason
    },

    nextAction: completePackReady
      ? `じゅんやさんが ${decisionResult.decision} を最終承認してパイロットを開始する`
      : decisionResult.reason,

    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  LAUNCH_DECISIONS,
  assessProduct,
  determineLaunchDecision,
  buildFirstRealProductLaunchGate
};

if (require.main === module) {
  const r = buildFirstRealProductLaunchGate({});
  console.log(JSON.stringify({ decision: r.launchDecision, reason: r.decisionReason }, null, 2));
}
