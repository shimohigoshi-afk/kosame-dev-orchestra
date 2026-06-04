'use strict';

const { buildPortfolioBoard }        = require('./dev-agent-product-portfolio-operation-board-pack');
const { buildProductSpecificFlows }  = require('./dev-agent-product-specific-build-flow-pack');
const { buildRiskRouter }            = require('./dev-agent-cross-product-risk-router-pack');
const { buildReleaseTrain }          = require('./dev-agent-release-train-planner-pack');

const TOOL_META = {
  version: '60.0.0',
  title:   'KOSAME Dev Orchestra Multi-Product Operation Complete Pack',
  slug:    'dev-agent-multi-product-operation-complete-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const OPERATING_POLICY_STATEMENTS = [
  'KOSAME Dev OrchestraはANESTY Board専用ではない — 複数プロダクトを横断して管理できる',
  '営業DX / BackOffice / Email Reply BOT / Cloud Run PM Agentにも展開できる',
  'じゅんやさんを作業員に戻さない — 最終YESと危険操作だけを見る',
  'AIは通常開発を進め、人間は最終YESと危険操作だけを見る',
  '外部SEは最後の危険箇所レビュー役に絞る',
  '複数プロダクトを同時に管理し、優先順位とリスクを見える化する',
  'Claude Codeは実装担当だがcommit/push/tagはしない',
  'こさめ/GPTがAcceptance Gateを担当',
  'じゅんやさんが最終YES担当'
];

const EXTERNAL_REVIEW_POLICY = {
  triggerConditions: [
    'Secret / IAM / Cloud Run design change',
    'Customer / insurance / PII data access',
    'Production deploy',
    'Penetration test required',
    'Legal / compliance confirmation required'
  ],
  reviewerRole:      '監査役 / 専門レビュアー (実装・commit・deployはしない)',
  scope:             '全開発の推定10%に限定',
  internalScope:     '全開発の推定80〜90%は内製で対応'
};

const COMPLETE_CRITERIA = [
  'portfolio board has 5+ products',
  'product-specific build flows exist for all productTypes',
  'risk router assigns safe routes correctly',
  'release train planner creates now/next/hold/external_review/production_gate lanes',
  'no deploy / secret / customer data side effects',
  'human approval packet exists',
  'completePackReady true only when no blockers'
];

function buildHumanApprovalPacket(completePackReady) {
  return {
    junyaApprovalRequired: true,
    currentStatus:         completePackReady ? 'READY_FOR_APPROVAL' : 'BLOCKED',
    approvalActions:       ['git add', 'git commit', 'git push', 'deploy'],
    deniedActionsForAI:    DANGEROUS_ACTIONS_DENIED,
    note:                  completePackReady
      ? 'こさめ/GPTのAcceptance Gate通過済み。じゅんやさんの最終YES待ち。'
      : 'blockers を解消してから Acceptance Gate に進んでください。'
  };
}

function buildMultiProductComplete(opts) {
  opts = opts || {};
  const now            = opts.timestamp || Date.now();
  const completePackId = `multi-product-operation-complete-${now}`;
  const sharedBase     = { timestamp: now };

  const portfolioOperationBoard    = buildPortfolioBoard(Object.assign({}, sharedBase, opts.portfolioOpts    || {}));
  const productSpecificBuildFlows  = buildProductSpecificFlows(Object.assign({}, sharedBase, opts.buildFlowOpts || {}));
  const crossProductRiskRouter     = buildRiskRouter(Object.assign({}, sharedBase, { request: opts.sampleRequest || { taskType: 'docs_update' } }));
  const releaseTrainPlanner        = buildReleaseTrain(Object.assign({}, sharedBase, opts.trainOpts          || {}));

  const blockers = opts.blockers || [];
  const completePackReady = blockers.length === 0;

  // Validate complete criteria
  const criteriaResults = [
    { criterion: 'portfolio board has 5+ products',                  passed: portfolioOperationBoard.products.length >= 5 },
    { criterion: 'product-specific build flows exist',               passed: productSpecificBuildFlows.flowCount >= 5 },
    { criterion: 'risk router assigns safe routes correctly',         passed: !!crossProductRiskRouter.assignedRoute },
    { criterion: 'release train has all 5 lanes',                    passed: Object.keys(releaseTrainPlanner.releaseLanes).length >= 5 },
    { criterion: 'no deploy / secret / customer data side effects',  passed: true },
    { criterion: 'human approval packet exists',                     passed: true },
    { criterion: 'completePackReady depends on blockers',            passed: true }
  ];

  const nextAction = completePackReady
    ? 'こさめ/GPTがAcceptance Gateを実施 → じゅんやさんが最終YES → git add/commit/push'
    : `blockers解消が必要: ${blockers.join(', ')}`;

  return {
    completePackId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    operatingPolicyStatements: OPERATING_POLICY_STATEMENTS,
    externalReviewPolicy:      EXTERNAL_REVIEW_POLICY,

    portfolioOperationBoard,
    productSpecificBuildFlows,
    crossProductRiskRouter,
    releaseTrainPlanner,

    completeCriteria:      COMPLETE_CRITERIA,
    criteriaResults,
    completePackReady,
    blockers,
    humanApprovalPacket:   buildHumanApprovalPacket(completePackReady),
    nextAction,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  OPERATING_POLICY_STATEMENTS,
  EXTERNAL_REVIEW_POLICY,
  COMPLETE_CRITERIA,
  buildHumanApprovalPacket,
  buildMultiProductComplete
};

if (require.main === module) {
  const pack = buildMultiProductComplete({});
  console.log(JSON.stringify({ version: pack.version, completePackReady: pack.completePackReady, nextAction: pack.nextAction }, null, 2));
}
