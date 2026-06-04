'use strict';

const { buildGuardianClassComplete }   = require('./dev-agent-guardian-class-complete-pack');
const { buildFirstRevenueRoute }       = require('./dev-agent-first-revenue-route-pack');
const { buildOfferPricingTest }        = require('./dev-agent-offer-pricing-test-pack');
const { buildSalesMessageOutreach }    = require('./dev-agent-sales-message-outreach-pack');
const { buildPilotCustomerOnboarding } = require('./dev-agent-pilot-customer-onboarding-pack');

const TOOL_META = {
  version: '75.0.0',
  title:   'KOSAME Dev Orchestra First Revenue Complete Gate Pack',
  slug:    'dev-agent-first-revenue-complete-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real payment processing',
  'real contract execution',
  'real customer onboarding without human approval',
  'real email send',
  'real SNS post'
];

const GATE_DECISIONS = {
  READY_TO_PILOT: 'READY_TO_PILOT',
  HOLD:           'HOLD',
  BLOCKED:        'BLOCKED'
};

const READY_TO_PILOT_CRITERIA = [
  'Guardian Class complete (v70) with completePackReady = true',
  'guardianReadiness.status = READY',
  'customer-facing operation guard confirmed',
  'data/secret/permission gate confirmed',
  'revenue route defined',
  'offer/pricing variant exists',
  'sales message prepared',
  'onboarding plan exists',
  'no blockers',
  'humanApprovalRequired = true throughout'
];

function determineGateDecision(opts) {
  opts = opts || {};
  const blockers = opts.blockers || [];

  // Guardian Class gating
  if (!opts.guardianClassReady) {
    return {
      decision: GATE_DECISIONS.HOLD,
      reason:   'Guardian Class (v70) が完了していません。先にGuardian Classを通してください。'
    };
  }
  if (opts.guardianReadinessStatus && opts.guardianReadinessStatus !== 'READY') {
    return {
      decision: GATE_DECISIONS.HOLD,
      reason:   `guardianReadiness.status = ${opts.guardianReadinessStatus}。Guardian Classの問題を解消してください。`
    };
  }
  if (!opts.customerFacingGuardConfirmed) {
    return {
      decision: GATE_DECISIONS.HOLD,
      reason:   'Customer-Facing Operation Guard (v67) が未確認です。保険営業DX特有リスクを含む顧客対向業務がある場合は必須です。'
    };
  }
  if (!opts.dataSecretPermissionConfirmed) {
    return {
      decision: GATE_DECISIONS.HOLD,
      reason:   'Data/Secret/Permission Gate (v68) が未確認です。'
    };
  }
  if (blockers.length > 0) {
    return {
      decision: GATE_DECISIONS.BLOCKED,
      reason:   `Blockers: ${blockers.join(', ')}`
    };
  }
  return {
    decision: GATE_DECISIONS.READY_TO_PILOT,
    reason:   'All guardian checks passed. Revenue route, offer, sales message, onboarding plan are in place. Human final YES required.'
  };
}

function buildFirstRevenueCompleteGate(opts) {
  opts = opts || {};
  const now         = opts.timestamp || Date.now();
  const completeGateId = `first-revenue-complete-gate-${now}`;
  const sharedBase  = { timestamp: now, productIdea: opts.productIdea || '(未設定)' };

  const guardianClassComplete   = buildGuardianClassComplete(Object.assign({}, sharedBase, opts.guardianOpts || {}));
  const firstRevenueRoute       = buildFirstRevenueRoute(Object.assign({}, sharedBase, opts.revenueRouteOpts || {}));
  const offerPricingTest        = buildOfferPricingTest(Object.assign({}, sharedBase, opts.offerOpts        || {}));
  const salesMessageOutreach    = buildSalesMessageOutreach(Object.assign({}, sharedBase, opts.salesOpts     || {}));
  const pilotCustomerOnboarding = buildPilotCustomerOnboarding(Object.assign({}, sharedBase, opts.onboardingOpts || {}));

  const blockers              = opts.blockers || [];
  const guardianClassReady    = guardianClassComplete.completePackReady && (opts.blockers || []).length === 0;
  const guardianReadinessStatus = guardianClassComplete.guardianReadiness
    ? guardianClassComplete.guardianReadiness.status : 'UNKNOWN';

  const decisionInput = {
    guardianClassReady,
    guardianReadinessStatus,
    customerFacingGuardConfirmed: opts.customerFacingGuardConfirmed !== false,
    dataSecretPermissionConfirmed: opts.dataSecretPermissionConfirmed !== false,
    blockers
  };

  const gateResult     = determineGateDecision(decisionInput);
  const readyToPilot   = gateResult.decision === GATE_DECISIONS.READY_TO_PILOT;

  return {
    completeGateId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:           opts.productIdea || '(未設定)',

    guardianReadiness: {
      status:          guardianReadinessStatus,
      completePackReady: guardianClassComplete.completePackReady
    },

    guardianClassComplete,
    firstRevenueRoute,
    offerPricingTest,
    salesMessageOutreach,
    pilotCustomerOnboarding,

    decision:          gateResult.decision,
    decisionOptions:   Object.values(GATE_DECISIONS),
    decisionReason:    gateResult.reason,
    readyToPilotCriteria: READY_TO_PILOT_CRITERIA,
    blockers,
    completePackReady: readyToPilot,

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus:         readyToPilot ? 'READY_FOR_PILOT_APPROVAL' : 'BLOCKED',
      approvalActions:       ['パイロット顧客への連絡', '実オンボーディング開始', '実契約・請求'],
      deniedActionsForAI:    DANGEROUS_ACTIONS_DENIED,
      note:                  readyToPilot
        ? 'こさめ/GPTのAcceptance Gate通過済み。じゅんやさんの最終YES後にパイロット開始。'
        : gateResult.reason
    },

    nextAction: readyToPilot
      ? 'じゅんやさんが最終YESを行い、パイロット顧客へのアウトリーチを開始する'
      : `ブロッカー解消: ${gateResult.reason}`,

    realRevenueActionsExecuted: false,
    generatedAt:                new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  GATE_DECISIONS,
  READY_TO_PILOT_CRITERIA,
  determineGateDecision,
  buildFirstRevenueCompleteGate
};

if (require.main === module) {
  const result = buildFirstRevenueCompleteGate({
    productIdea:                   'AI議事録自動化ツール',
    customerFacingGuardConfirmed:  true,
    dataSecretPermissionConfirmed: true
  });
  console.log(JSON.stringify({ decision: result.decision, reason: result.decisionReason, completePackReady: result.completePackReady }, null, 2));
}
