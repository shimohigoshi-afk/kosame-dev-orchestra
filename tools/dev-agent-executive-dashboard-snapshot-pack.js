'use strict';

const TOOL_META = {
  version: '76.0.0',
  title:   'KOSAME Dev Orchestra Executive Dashboard Snapshot Pack',
  slug:    'dev-agent-executive-dashboard-snapshot-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'deploy (any form)', 'git push (automated)',
  'customer data read', 'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real ad launch', 'real LP publish', 'real email send', 'real payment processing'
];

const COMPLETED_MILESTONES = [
  { version: 'v44.0.0', title: 'ANESTY Board実repo投入テスト接続',             status: 'DONE' },
  { version: 'v47.0.0', title: 'Operation Board見える化',                       status: 'DONE' },
  { version: 'v50.0.0', title: '日常運用で使える実用ライン化',                   status: 'DONE' },
  { version: 'v55.0.0', title: '外部SE監査10%化・本番GO/NO-GO・内製化効果記録', status: 'DONE' },
  { version: 'v60.0.0', title: '複数プロダクト横断運用ライン',                   status: 'DONE' },
  { version: 'v65.0.0', title: 'Product Validation Line (作る前に売れるか判断)', status: 'DONE' },
  { version: 'v70.0.0', title: 'Guardian Class (守りの設計)',                   status: 'DONE' },
  { version: 'v75.0.0', title: 'Revenue Launch Line (最初の売上化まで導線化)',   status: 'DONE' }
];

const PHASE_STATUSES = {
  BUILD_OS:           'READY',
  MULTI_PRODUCT:      'READY',
  PRODUCT_VALIDATION: 'READY',
  GUARDIAN_CLASS:     'READY',
  REVENUE_LAUNCH:     'READY',
  COMMAND_CENTER:     'BUILDING'
};

function buildExecutiveDashboardSnapshot(opts) {
  opts = opts || {};
  const now  = opts.timestamp || Date.now();
  const snapId = `executive-dashboard-${now}`;

  const currentTarget = opts.currentTarget || 'v80.0.0';
  const latestStable  = opts.latestStableVersion || 'v75.0.0';

  const productSummary = opts.productSummary || {
    total:    6,
    active:   2,
    planning: 3,
    onHold:   1,
    products: ['ANESTY Board (ACTIVE)', '営業DX (PLANNING)', 'BackOffice (PLANNING)',
               'Email Reply BOT (PLANNING)', 'Cloud Run PM Agent (ACTIVE)', 'KOSAME Dev Orchestra (ACTIVE)']
  };

  const guardianSummary = opts.guardianSummary || {
    attackSurfaceReview:      'REVIEWED',
    customerFacingGuard:      'REVIEWED',
    dataSecretPermissionGate: 'REVIEWED',
    defensiveRedTeamDryRun:   'REVIEWED',
    guardianClassComplete:    'REVIEWED',
    overallStatus:            'READY'
  };

  const revenueSummary = opts.revenueSummary || {
    firstRevenueRoute:       'DEFINED',
    offerPricingTest:        'DESIGNED',
    salesMessageOutreach:    'PREPARED',
    pilotCustomerOnboarding: 'PLANNED',
    firstRevenueGate:        'READY_TO_PILOT',
    overallStatus:           'READY_TO_PILOT'
  };

  const humanYesSummary = opts.humanYesSummary || {
    pendingCount:   3,
    topPriority:    'パイロット顧客へのアウトリーチ承認',
    blockedUntilYes: ['git commit / push / tag', 'deploy', '実顧客送信']
  };

  const riskSummary = opts.riskSummary || {
    critical:  0,
    high:      2,
    medium:    3,
    low:       5,
    topRisk:   'Customer data boundary (営業DX) not yet defined'
  };

  return {
    dashboardSnapshotId:   snapId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    latestStableVersion:   latestStable,
    currentTarget,
    currentPhase:          'Command Center Line (v76-v80)',
    completedMilestones:   COMPLETED_MILESTONES,
    activeMilestones:      opts.activeMilestones || [
      { version: 'v76-v80', title: 'Command Center Line', status: 'IN_PROGRESS' }
    ],
    phaseStatuses:         PHASE_STATUSES,
    nextRecommendedAction: opts.nextRecommendedAction || 'v80 Command Centerを完成 → Acceptance Gate → human YES',
    productSummary,
    guardianSummary,
    revenueSummary,
    humanYesSummary,
    riskSummary,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  COMPLETED_MILESTONES,
  PHASE_STATUSES,
  buildExecutiveDashboardSnapshot
};

if (require.main === module) {
  const result = buildExecutiveDashboardSnapshot({});
  console.log(JSON.stringify(result, null, 2));
}
