'use strict';

const TOOL_META = {
  version: '32.0.0',
  title: 'First Product Repo Selection Console',
  slug: 'first-product-repo-selection-console'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy (any form)',
  'docker build',
  'gcloud deploy',
  'git push (automated)',
  'git tag (automated)',
  'git commit (automated)',
  'git add (automated)',
  'secret read',
  'env read',
  'customer data read',
  'destructive delete (rm -rf, git clean -f, git reset --hard)'
];

const PRODUCT_PROFILES = {
  sales_dx: {
    product:             'sales_dx',
    repoCandidate:       'kosame-sales-dx',
    businessImpact:      'medium',
    implementationRisk:  'low',
    safetyRisk:          'low',
    secretRequired:      false,
    productionImpact:    false,
    regulatedData:       false,
    firstTouchSuitability: 'high',
    rationale: '顧客向け営業DXツール。本番影響なし・Secret不要・docsやREADME中心で低リスク初回作業が可能。'
  },
  anesty_board: {
    product:             'anesty_board',
    repoCandidate:       'kosame-anesty-board',
    businessImpact:      'high',
    implementationRisk:  'medium',
    safetyRisk:          'high',
    secretRequired:      true,
    productionImpact:    true,
    regulatedData:       true,
    firstTouchSuitability: 'low',
    rationale: '保険・健診情報を扱う規制データあり。Secret必須・本番影響大・最初の投入候補としてはhold推奨。'
  },
  backoffice_agent: {
    product:             'backoffice_agent',
    repoCandidate:       'kosame-backoffice-agent',
    businessImpact:      'high',
    implementationRisk:  'medium',
    safetyRisk:          'medium',
    secretRequired:      true,
    productionImpact:    true,
    regulatedData:       false,
    firstTouchSuitability: 'low',
    rationale: '社内バックオフィス処理。Secret必要・本番影響あり。初回は低リスク箇所（docs/runbook）に限定するなら条件付き可。'
  },
  email_reply_bot: {
    product:             'email_reply_bot',
    repoCandidate:       'kosame-email-reply-bot',
    businessImpact:      'medium',
    implementationRisk:  'low',
    safetyRisk:          'low',
    secretRequired:      false,
    productionImpact:    false,
    regulatedData:       false,
    firstTouchSuitability: 'high',
    rationale: 'メール自動返信BOT。ドキュメント・smoke・runbook作業から始めやすく低リスク。Secret不要・本番影響なし。'
  },
  cloud_run_pm_agent: {
    product:             'cloud_run_pm_agent',
    repoCandidate:       'kosame-dev-orchestra',
    businessImpact:      'high',
    implementationRisk:  'low',
    safetyRisk:          'low',
    secretRequired:      false,
    productionImpact:    false,
    regulatedData:       false,
    firstTouchSuitability: 'medium',
    rationale: 'このorchestration repo自身。既に運用中でsmoke充実。ただし自己改変リスクあり。既存テスト破壊に注意。'
  }
};

const DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const REQUIRED_HUMAN_INPUTS = [
  'selectedProduct',
  'businessPriorityConfirmed',
  'firstTaskScopeConfirmed'
];

function rankProducts() {
  return Object.values(PRODUCT_PROFILES)
    .sort((a, b) => {
      const scoreA = (a.firstTouchSuitability === 'high' ? 3 : a.firstTouchSuitability === 'medium' ? 2 : 1);
      const scoreB = (b.firstTouchSuitability === 'high' ? 3 : b.firstTouchSuitability === 'medium' ? 2 : 1);
      return scoreB - scoreA;
    });
}

function buildSelectionConsole(input) {
  const selectionId = `repo-selection-${Date.now()}`;

  const rankedProducts   = rankProducts();
  const recommended      = rankedProducts[0];
  const providedInputs   = input.providedHumanInputs || [];
  const missingInputs    = REQUIRED_HUMAN_INPUTS.filter(k => !providedInputs.includes(k));
  const selectedProduct  = input.selectedProduct || null;
  const overrideReason   = input.overrideReason   || null;

  const finalProduct = selectedProduct
    ? (PRODUCT_PROFILES[selectedProduct] || recommended)
    : recommended;

  const selectionReason = overrideReason ||
    (selectedProduct
      ? `Human selected: ${selectedProduct}. ${PRODUCT_PROFILES[selectedProduct]?.rationale || ''}`
      : `Auto-recommendation based on safety & risk scoring: ${recommended.rationale}`);

  const holdProducts = Object.values(PRODUCT_PROFILES)
    .filter(p => p.firstTouchSuitability === 'low')
    .map(p => ({ product: p.product, reason: p.rationale }));

  const humanApprovalRequired = true;

  const selectionReady = missingInputs.length === 0 || !!selectedProduct;

  const recommendedNextAction = selectionReady
    ? `Product selected: ${finalProduct.product}. Proceed to v33 First Touch Dry Run Pack.`
    : `Selection pending. Missing human inputs: ${missingInputs.join(', ')}`;

  return {
    version:                TOOL_META.version,
    title:                  TOOL_META.title,
    dryRun:                 true,
    humanApprovalRequired,
    repoSelectionId:        selectionId,
    productCandidates:      rankedProducts,
    recommendedFirstProduct: finalProduct,
    selectionReason,
    businessImpact:         finalProduct.businessImpact,
    implementationRisk:     finalProduct.implementationRisk,
    safetyRisk:             finalProduct.safetyRisk,
    holdProducts,
    repoReadinessAssumption: [
      `${finalProduct.repoCandidate} repo exists on host (not verified in dry-run)`,
      'Repo is git-initialized with at least one commit',
      'No secrets in working tree root',
      'docs/ or README.md exists for low-risk first task'
    ],
    requiredHumanInputs:    REQUIRED_HUMAN_INPUTS,
    missingInputs,
    decisionOptions:        DECISION_OPTIONS,
    selectionReady,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealRepoAccess:       true,
    noRealCommit:           true,
    noRealDeploy:           true
  };
}

function main() {
  console.log(JSON.stringify(buildSelectionConsole({
    providedHumanInputs: ['selectedProduct', 'businessPriorityConfirmed', 'firstTaskScopeConfirmed'],
    selectedProduct:     'email_reply_bot',
    overrideReason:      'こさめ/GPT PM判断: Email Reply BOTはSecret不要・本番影響なし・docs整備から始めやすい。'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PRODUCT_PROFILES,
  DECISION_OPTIONS,
  REQUIRED_HUMAN_INPUTS,
  buildSelectionConsole
};
