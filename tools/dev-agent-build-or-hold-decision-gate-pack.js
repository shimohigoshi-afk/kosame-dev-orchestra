'use strict';

const { buildIdeaDiscovery }         = require('./dev-agent-product-idea-discovery-pack');
const { buildLandingPageRequirement }= require('./dev-agent-landing-page-requirement-pack');
const { buildDemandValidation, classifyCpa } = require('./dev-agent-demand-validation-ad-waitlist-pack');
const { buildMvpPmfMetrics, classifyLtvCac } = require('./dev-agent-mvp-pmf-metrics-pack');

const TOOL_META = {
  version: '65.0.0',
  title:   'KOSAME Dev Orchestra Build or Hold Decision Gate Pack',
  slug:    'dev-agent-build-or-hold-decision-gate-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real ad launch',
  'real LP publish',
  'real SNS post',
  'real payment processing',
  'real user data collection'
];

const DECISIONS = {
  BUILD:          'BUILD',
  HOLD:           'HOLD',
  PIVOT:          'PIVOT',
  VALIDATE_MORE:  'VALIDATE_MORE',
  SCALE:          'SCALE'
};

function determineDecision(opts) {
  opts = opts || {};
  const reasons  = [];
  const blockers = opts.blockers || [];

  // Hard blocks
  if (blockers.length > 0) {
    return { decision: DECISIONS.HOLD, reason: `Blockers: ${blockers.join(', ')}` };
  }

  // Target user undefined
  if (!opts.targetUser || opts.targetUser === '(未設定)') {
    return { decision: DECISIONS.HOLD, reason: 'ターゲットユーザーが未定義。HOLDして定義してから再評価。' };
  }

  // Low oneSecondUnderstandingScore
  if (opts.oneSecondUnderstandingScore !== undefined && opts.oneSecondUnderstandingScore < 5) {
    return { decision: DECISIONS.VALIDATE_MORE, reason: '1秒理解スコアが低い。訴求を再定義してから需要検証。' };
  }

  // Waitlist zero
  if (opts.waitlistCount === 0) {
    return { decision: DECISIONS.HOLD, reason: 'waitlist件数が0。HOLDまたはPIVOT。' };
  }

  // Metrics-based decisions (when data is available)
  const cpa            = opts.actualCpa;
  const cvr            = opts.cvr;
  const retention30d   = opts.retention30d;
  const ltv            = opts.ltv;
  const cac            = opts.cac;

  // SCALE: high retention + LTV > CAC
  if (retention30d !== null && retention30d !== undefined && retention30d >= 0.15) {
    const ltvCac = classifyLtvCac(ltv, cac);
    if (ltvCac.status === 'healthy' || ltvCac.status === 'organic') {
      reasons.push(`30日継続率${(retention30d*100).toFixed(0)}%以上 + LTV/CAC健全`);
      return { decision: DECISIONS.SCALE, reason: reasons.join(' / ') };
    }
  }

  // BUILD: CPA 100-300
  if (cpa !== null && cpa !== undefined && cpa <= 300 && cpa > 0) {
    reasons.push(`CPA ${cpa}円 (300円以内: 強い需要シグナル)`);
    return { decision: DECISIONS.BUILD, reason: reasons.join(' / ') };
  }

  // PIVOT: CPA 1000+
  if (cpa !== null && cpa !== undefined && cpa > 1000) {
    reasons.push(`CPA ${cpa}円 (1000円超: 需要シグナルが弱い)`);
    return { decision: DECISIONS.PIVOT, reason: reasons.join(' / ') };
  }

  // VALIDATE_MORE: CPA 300-1000
  if (cpa !== null && cpa !== undefined && cpa > 300 && cpa <= 1000) {
    reasons.push(`CPA ${cpa}円 (300〜1000円: 追加検証・訴求改善)`);
    return { decision: DECISIONS.VALIDATE_MORE, reason: reasons.join(' / ') };
  }

  // CVR-based
  if (cvr !== null && cvr !== undefined) {
    if (cvr >= 0.01) {
      reasons.push(`CVR ${(cvr*100).toFixed(1)}% (1%以上: 価値提供シグナル)`);
      return { decision: DECISIONS.BUILD, reason: reasons.join(' / ') };
    }
    if (cvr === 0) {
      return { decision: DECISIONS.PIVOT, reason: `CVR 0% (十分な母数あり): PIVOT検討` };
    }
  }

  // Insufficient data
  return { decision: DECISIONS.VALIDATE_MORE, reason: '判断に十分なデータがない。需要検証 (waitlist/広告) を先に行う。' };
}

function buildDecisionGate(opts) {
  opts = opts || {};
  const now           = opts.timestamp || Date.now();
  const decisionGateId = `build-or-hold-${now}`;
  const sharedBase    = { productIdea: opts.productIdea || '(未設定)', timestamp: now };

  const ideaDiscovery         = buildIdeaDiscovery(Object.assign({}, sharedBase, opts.ideaOpts    || {}));
  const landingPageRequirement = buildLandingPageRequirement(Object.assign({}, sharedBase, opts.lpOpts || {}));
  const demandValidation       = buildDemandValidation(Object.assign({}, sharedBase, opts.demandOpts || {}));
  const mvpPmfMetrics          = buildMvpPmfMetrics(Object.assign({}, sharedBase, opts.metricsOpts || {}));

  const decisionInput = {
    targetUser:                opts.targetUser                || (opts.ideaOpts && opts.ideaOpts.targetUser) || '(未設定)',
    oneSecondUnderstandingScore: opts.oneSecondUnderstandingScore !== undefined ? opts.oneSecondUnderstandingScore
      : (opts.ideaOpts && opts.ideaOpts.oneSecondUnderstandingScore !== undefined ? opts.ideaOpts.oneSecondUnderstandingScore : undefined),
    waitlistCount:             opts.waitlistCount,
    actualCpa:                 opts.actualCpa,
    cvr:                       opts.cvr,
    retention30d:              opts.retention30d,
    ltv:                       opts.ltv,
    cac:                       opts.cac,
    blockers:                  opts.blockers || []
  };

  const decisionResult = opts.decisionOverride
    ? { decision: opts.decisionOverride, reason: opts.decisionReason || 'Manual override' }
    : determineDecision(decisionInput);

  const completePackReady = (opts.blockers || []).length === 0;

  return {
    decisionGateId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:    opts.productIdea || '(未設定)',
    ideaDiscovery,
    landingPageRequirement,
    demandValidation,
    mvpPmfMetrics,

    decisionOptions: Object.values(DECISIONS),
    decision:        decisionResult.decision,
    decisionReason:  decisionResult.reason,
    confidence:      opts.confidence || (
      (opts.actualCpa !== undefined || opts.cvr !== undefined || opts.retention30d !== undefined)
        ? 'data_based' : 'hypothesis_only'
    ),

    blockerItems: opts.blockers || [],
    completePackReady,

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus:         completePackReady ? 'READY_FOR_REVIEW' : 'BLOCKED',
      note:                  'じゅんやさんが最終判断 (Build / Hold / Pivot / Scale) を行います',
      deniedActionsForAI:    DANGEROUS_ACTIONS_DENIED
    },

    nextAction: decisionResult.decision === DECISIONS.BUILD         ? 'BuildラインでMVP開発を開始する'
              : decisionResult.decision === DECISIONS.SCALE         ? 'ScaleラインでCAC削減・LTV向上を推進する'
              : decisionResult.decision === DECISIONS.VALIDATE_MORE ? '需要検証 (waitlist/LP/広告) を先に行う'
              : decisionResult.decision === DECISIONS.PIVOT         ? 'アイデアを再定義してPIVOTする'
              : 'blockers解消後に再評価する',

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DECISIONS,
  determineDecision,
  buildDecisionGate
};

if (require.main === module) {
  // Demo: CPA 200円 → BUILD
  const result = buildDecisionGate({
    productIdea: 'AI議事録自動化ツール',
    targetUser:  '中小企業の営業担当者',
    actualCpa:   200
  });
  console.log(JSON.stringify({ decision: result.decision, reason: result.decisionReason }, null, 2));
}
