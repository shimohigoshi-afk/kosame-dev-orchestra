'use strict';

const TOOL_META = {
  version: '77.0.0',
  title:   'KOSAME Dev Orchestra Guardian / Revenue Visual Board Pack',
  slug:    'dev-agent-guardian-revenue-visual-board-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'deploy (any form)', 'git push (automated)',
  'customer data read', 'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real email send', 'real payment processing', 'real contract execution'
];

const STATUS = {
  READY:            'READY',
  REVIEWED:         'REVIEWED',
  PENDING:          'PENDING',
  BLOCKED:          'BLOCKED',
  NOT_CONFIRMED:    'NOT_CONFIRMED',
  READY_TO_PILOT:   'READY_TO_PILOT',
  HOLD:             'HOLD'
};

function isGuardianReady(guardianClassStatus) {
  const required = ['attackSurfaceReview', 'customerFacingOperationGuard', 'dataSecretPermissionGate', 'defensiveRedTeamDryRun', 'guardianClassComplete'];
  return required.every(k => [STATUS.READY, STATUS.REVIEWED].includes(guardianClassStatus[k]));
}

function buildGuardianRevenueVisualBoard(opts) {
  opts = opts || {};
  const now     = opts.timestamp || Date.now();
  const boardId = `guardian-revenue-visual-board-${now}`;

  const guardianClassStatus = opts.guardianClassStatus || {
    attackSurfaceReview:        STATUS.REVIEWED,
    customerFacingOperationGuard: STATUS.REVIEWED,
    dataSecretPermissionGate:   STATUS.REVIEWED,
    defensiveRedTeamDryRun:     STATUS.REVIEWED,
    guardianClassComplete:      STATUS.READY
  };

  const guardianReady = isGuardianReady(guardianClassStatus);

  const revenueLaunchStatus = opts.revenueLaunchStatus || (guardianReady ? {
    firstRevenueRoute:        STATUS.READY,
    offerPricingTest:         STATUS.READY,
    salesMessageOutreach:     STATUS.READY,
    pilotCustomerOnboarding:  STATUS.READY,
    firstRevenueCompleteGate: STATUS.READY_TO_PILOT
  } : {
    firstRevenueRoute:        STATUS.BLOCKED,
    offerPricingTest:         STATUS.BLOCKED,
    salesMessageOutreach:     STATUS.BLOCKED,
    pilotCustomerOnboarding:  STATUS.BLOCKED,
    firstRevenueCompleteGate: STATUS.HOLD
  });

  const allItems = [
    ...Object.entries(guardianClassStatus).map(([k, v])   => ({ id: k, area: 'guardian', status: v })),
    ...Object.entries(revenueLaunchStatus).map(([k, v])   => ({ id: k, area: 'revenue',  status: v }))
  ];

  const blockedItems = allItems.filter(i => [STATUS.BLOCKED, STATUS.HOLD, STATUS.NOT_CONFIRMED].includes(i.status)).map(i => i.id);
  const readyItems   = allItems.filter(i => [STATUS.READY, STATUS.REVIEWED, STATUS.READY_TO_PILOT].includes(i.status)).map(i => i.id);
  const humanApprovalRequiredItems = allItems.filter(i => i.area === 'revenue' && [STATUS.READY, STATUS.READY_TO_PILOT].includes(i.status)).map(i => i.id);

  const nextAction = !guardianReady
    ? 'Guardian Classを完了してからRevenue Launch Lineへ進む'
    : blockedItems.length > 0
      ? `blockers解消: ${blockedItems.join(', ')}`
      : 'じゅんやさんの最終YESを待ってパイロット開始';

  return {
    visualBoardId:    boardId,
    version:          TOOL_META.version,
    title:            TOOL_META.title,
    dryRun:           true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    guardianClassStatus,
    revenueLaunchStatus,
    guardianReady,
    blockedItems,
    readyItems,
    humanApprovalRequiredItems,
    nextAction,
    safetyNotes: [
      'Guardian未確認ならRevenue READY表示にしない',
      'customer-facing productはv67 customerFacingOperationGuard通過必須',
      'data/secret/permission gate未通過ならHOLD表示',
      '実送信・実契約・実請求・実導入はしない'
    ],
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  STATUS,
  isGuardianReady,
  buildGuardianRevenueVisualBoard
};

if (require.main === module) {
  const result = buildGuardianRevenueVisualBoard({});
  console.log(JSON.stringify(result, null, 2));
}
