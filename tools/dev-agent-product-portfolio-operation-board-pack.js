'use strict';

const TOOL_META = {
  version: '56.0.0',
  title:   'KOSAME Dev Orchestra Product Portfolio Operation Board Pack',
  slug:    'dev-agent-product-portfolio-operation-board-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const BLOCKED_DANGER_GATES = {
  secretRead:        'BLOCKED',
  envRead:           'BLOCKED',
  deploy:            'BLOCKED',
  gitPushByAI:       'BLOCKED',
  customerDataRead:  'BLOCKED',
  destructiveDelete: 'BLOCKED'
};

const DEFAULT_PRODUCTS = [
  {
    productId:             'anesty_board',
    productName:           'ANESTY Board',
    productType:           'discord_ai_board',
    repoPath:              '/home/shimohigoshi/anesty-board',
    currentPhase:          'controlled_task_operation',
    currentVersion:        'v87.x',
    readinessStatus:       'ACTIVE',
    nextAction:            'Next controlled task via KOSAME Dev Orchestra build line',
    recommendedAgent:      'Claude / Kuro',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: false
  },
  {
    productId:             'sales_dx',
    productName:           '営業DX',
    productType:           'sales_dx_pipeline',
    repoPath:              '/home/shimohigoshi/sales-dx (placeholder)',
    currentPhase:          'design',
    currentVersion:        'v1.x (TBD)',
    readinessStatus:       'PLANNING',
    nextAction:            'Define data boundary for customer/insurance data before any implementation',
    recommendedAgent:      'KOSAME / GPT + External SE',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: true
  },
  {
    productId:             'backoffice_agent',
    productName:           'BackOffice Agent',
    productType:           'backoffice_agent',
    repoPath:              '/home/shimohigoshi/backoffice-agent (placeholder)',
    currentPhase:          'design',
    currentVersion:        'v1.x (TBD)',
    readinessStatus:       'PLANNING',
    nextAction:            'Identify contract/legal/accounting boundaries before implementation',
    recommendedAgent:      'KOSAME / GPT',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: true
  },
  {
    productId:             'email_reply_bot',
    productName:           'Email Reply BOT',
    productType:           'email_reply_bot',
    repoPath:              '/home/shimohigoshi/email-reply-bot (placeholder)',
    currentPhase:          'design',
    currentVersion:        'v1.x (TBD)',
    readinessStatus:       'PLANNING',
    nextAction:            'Define Gmail API send gate and PII handling policy',
    recommendedAgent:      'Claude / Kuro',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: false
  },
  {
    productId:             'cloud_run_pm_agent',
    productName:           'Cloud Run PM Agent',
    productType:           'cloud_run_pm_agent',
    repoPath:              '/home/shimohigoshi/kosame-dev-orchestra (apps/pm-agent)',
    currentPhase:          'production',
    currentVersion:        'v1.x (deployed)',
    readinessStatus:       'ACTIVE',
    nextAction:            'Monitor runtime, apply controlled updates via build line',
    recommendedAgent:      'Claude / Kuro',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: true
  },
  {
    productId:             'kosame_dev_orchestra',
    productName:           'KOSAME Dev Orchestra',
    productType:           'dev_orchestra_core',
    repoPath:              '/home/shimohigoshi/kosame-dev-orchestra',
    currentPhase:          'active_development',
    currentVersion:        '56.0.0',
    readinessStatus:       'ACTIVE',
    nextAction:            'Continue Multi-Product Operation Line v56-v60',
    recommendedAgent:      'Claude / Kuro',
    humanApprovalRequired: true,
    dangerGates:           BLOCKED_DANGER_GATES,
    externalReviewRequired: false
  }
];

function buildPortfolioBoard(opts) {
  opts = opts || {};
  const now              = opts.timestamp || Date.now();
  const portfolioBoardId = `portfolio-board-${now}`;
  const products         = opts.products || JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));

  const blockedProducts = products.filter(p => p.readinessStatus === 'BLOCKED').map(p => p.productId);
  const readyProducts   = products.filter(p => p.readinessStatus === 'ACTIVE').map(p => p.productId);
  const priorityOrder   = opts.priorityOrder || products.map(p => p.productId);

  const globalSummary = {
    totalProducts:    products.length,
    activeProducts:   readyProducts.length,
    blockedProducts:  blockedProducts.length,
    planningProducts: products.filter(p => p.readinessStatus === 'PLANNING').length,
    externalReviewPending: products.filter(p => p.externalReviewRequired).length
  };

  return {
    portfolioBoardId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    products,
    globalSummary,
    priorityOrder,
    blockedProducts,
    readyProducts,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_PRODUCTS,
  BLOCKED_DANGER_GATES,
  buildPortfolioBoard
};

if (require.main === module) {
  const board = buildPortfolioBoard({});
  console.log(JSON.stringify(board, null, 2));
}
