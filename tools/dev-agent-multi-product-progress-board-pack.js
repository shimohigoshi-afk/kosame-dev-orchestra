'use strict';

const TOOL_META = {
  version: '79.0.0',
  title:   'KOSAME Dev Orchestra Multi-Product Progress Board Pack',
  slug:    'dev-agent-multi-product-progress-board-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'deploy (any form)', 'git push (automated)',
  'customer data read', 'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real external repo read', 'real repo mutation'
];

const DEFAULT_PRODUCTS = [
  {
    productId:       'kosame_dev_orchestra',
    productName:     'KOSAME Dev Orchestra',
    currentPhase:    'command_center_line',
    latestVersion:   'v75.0.0',
    status:          'ACTIVE',
    nextAction:      'v80 Command Center を完成 → Acceptance Gate → human YES',
    assignedAgent:   'Claude / Kuro',
    guardianStatus:  'READY',
    revenueStatus:   'NOT_APPLICABLE',
    riskLevel:       'low',
    humanYesRequired: true,
    blockedReason:    null
  },
  {
    productId:       'anesty_board',
    productName:     'ANESTY Board',
    currentPhase:    'controlled_task_operation',
    latestVersion:   'v87.x',
    status:          'ACTIVE',
    nextAction:      'Next controlled task via KOSAME Dev Orchestra build line',
    assignedAgent:   'Claude / Kuro',
    guardianStatus:  'PARTIAL',
    revenueStatus:   'NOT_STARTED',
    riskLevel:       'medium',
    humanYesRequired: true,
    blockedReason:    null
  },
  {
    productId:       'cloud_run_pm_agent',
    productName:     'Cloud Run PM Agent',
    currentPhase:    'production_monitoring',
    latestVersion:   'v1.x (deployed)',
    status:          'ACTIVE',
    nextAction:      'Monitor runtime; apply controlled updates via build line',
    assignedAgent:   'Claude / Kuro + External SE',
    guardianStatus:  'NEEDS_REVIEW',
    revenueStatus:   'NOT_APPLICABLE',
    riskLevel:       'high',
    humanYesRequired: true,
    blockedReason:    'External SE IAM review pending'
  },
  {
    productId:       'sales_dx',
    productName:     '営業DX',
    currentPhase:    'design',
    latestVersion:   'v1.0 (TBD)',
    status:          'PLANNING',
    nextAction:      'Define customer/insurance data boundary before implementation',
    assignedAgent:   'KOSAME / GPT + External SE',
    guardianStatus:  'NOT_STARTED',
    revenueStatus:   'NOT_STARTED',
    riskLevel:       'critical',
    humanYesRequired: true,
    blockedReason:    'Customer/insurance data boundary not defined'
  },
  {
    productId:       'backoffice_agent',
    productName:     'BackOffice Agent',
    currentPhase:    'design',
    latestVersion:   'v1.0 (TBD)',
    status:          'PLANNING',
    nextAction:      'Identify contract/legal/accounting boundaries',
    assignedAgent:   'KOSAME / GPT',
    guardianStatus:  'NOT_STARTED',
    revenueStatus:   'NOT_STARTED',
    riskLevel:       'high',
    humanYesRequired: true,
    blockedReason:    'Legal/accounting boundary not defined'
  },
  {
    productId:       'email_reply_bot',
    productName:     'Email Reply BOT',
    currentPhase:    'design',
    latestVersion:   'v1.0 (TBD)',
    status:          'PLANNING',
    nextAction:      'Define Gmail API send gate and PII handling policy',
    assignedAgent:   'Claude / Kuro',
    guardianStatus:  'NOT_STARTED',
    revenueStatus:   'NOT_STARTED',
    riskLevel:       'medium',
    humanYesRequired: true,
    blockedReason:    null
  }
];

function buildMultiProductProgressBoard(opts) {
  opts = opts || {};
  const now     = opts.timestamp || Date.now();
  const boardId = `multi-product-progress-${now}`;
  const products = opts.products || JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));

  const nowLane          = products.filter(p => p.status === 'ACTIVE' && !p.blockedReason && p.riskLevel === 'low').map(p => p.productId);
  const nextLane         = products.filter(p => p.status === 'ACTIVE' && !p.blockedReason && p.riskLevel !== 'low').map(p => p.productId);
  const holdLane         = products.filter(p => p.blockedReason).map(p => p.productId);
  const guardianLane     = products.filter(p => p.guardianStatus === 'NEEDS_REVIEW' || p.guardianStatus === 'NOT_STARTED').map(p => p.productId);
  const revenueLane      = products.filter(p => p.revenueStatus === 'READY_TO_PILOT').map(p => p.productId);
  const externalReviewLane = products.filter(p => ['cloud_run_pm_agent', 'sales_dx'].includes(p.productId)).map(p => p.productId);

  return {
    progressBoardId:    boardId,
    version:            TOOL_META.version,
    title:              TOOL_META.title,
    dryRun:             true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    products,
    nowLane,
    nextLane,
    holdLane,
    guardianLane,
    revenueLane,
    externalReviewLane,
    repoPathNote:  'repoPath is string reference only. No real repo read.',
    generatedAt:   new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_PRODUCTS,
  buildMultiProductProgressBoard
};

if (require.main === module) {
  const result = buildMultiProductProgressBoard({});
  console.log(JSON.stringify(result, null, 2));
}
