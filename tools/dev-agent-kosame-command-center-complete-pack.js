'use strict';

const { buildExecutiveDashboardSnapshot }  = require('./dev-agent-executive-dashboard-snapshot-pack');
const { buildGuardianRevenueVisualBoard }  = require('./dev-agent-guardian-revenue-visual-board-pack');
const { buildHumanYesQueueBoard }          = require('./dev-agent-human-yes-queue-board-pack');
const { buildMultiProductProgressBoard }   = require('./dev-agent-multi-product-progress-board-pack');

const TOOL_META = {
  version: '80.0.0',
  title:   'KOSAME Dev Orchestra Command Center Complete Pack',
  slug:    'dev-agent-kosame-command-center-complete-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'deploy (any form)', 'git push (automated)',
  'customer data read', 'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real email send', 'real payment processing', 'real contract execution',
  'real external repo mutation', 'Discord/Webhook send'
];

const COMMAND_CENTER_OPERATING_POLICY = [
  'じゅんやさんを作業員に戻さない',
  'ログを全部読ませない — ダッシュボードで要点を提示する',
  '必要なYESだけ見せる',
  '危険操作は承認ゲートに置く',
  'AIは準備・検証・表示まで担当する',
  '人間は最終YESを担当する',
  '複数プロダクトの現在地を見える化する',
  'Guardian通過状況とRevenue準備状況を同時に見る',
  'Command CenterはShell上の司令室。Discord連携はまだしない',
  'Discord/Webhook送信なし',
  '実repo読取なし',
  '実deployなし'
];

const COMPLETE_CRITERIA = [
  'executive dashboard exists',
  'guardian/revenue visual board exists',
  'human YES queue exists',
  'multi-product progress board exists',
  'dashboardText rendered (contains required sections)',
  'no deploy executed',
  'no secret read',
  'no customer data read',
  'no external repo mutation',
  'completePackReady true only when no blockers'
];

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m'
};

function renderDashboardText(snap, guardian, queue, progress) {
  const lines = [];
  lines.push(C.bold + '='.repeat(60) + C.reset);
  lines.push(C.bold + '  KOSAME Command Center' + C.reset);
  lines.push(C.bold + '='.repeat(60) + C.reset);
  lines.push('');

  // VERSION
  lines.push(C.bold + 'VERSION' + C.reset);
  lines.push('  Latest stable : ' + (snap.latestStableVersion || '-'));
  lines.push('  Current target: ' + (snap.currentTarget        || '-'));
  lines.push('  Orchestra v   : ' + TOOL_META.version);
  lines.push('');

  // PRODUCTS
  lines.push(C.bold + 'PRODUCTS' + C.reset);
  for (const p of (progress.products || [])) {
    const st = p.status === 'ACTIVE'    ? C.green  + p.status + C.reset
             : p.status === 'PLANNING'  ? C.yellow + p.status + C.reset
             : p.status;
    lines.push('  ' + p.productName.padEnd(26) + st);
  }
  lines.push('');

  // GUARDIAN
  lines.push(C.bold + 'GUARDIAN' + C.reset);
  const gcs = guardian.guardianClassStatus || {};
  for (const [k, v] of Object.entries(gcs)) {
    const col = ['READY','REVIEWED'].includes(v) ? C.green + v + C.reset : C.yellow + v + C.reset;
    lines.push('  ' + k.padEnd(32) + col);
  }
  lines.push('  guardianReady: ' + (guardian.guardianReady ? C.green + 'YES' + C.reset : C.red + 'NO' + C.reset));
  lines.push('');

  // REVENUE
  lines.push(C.bold + 'REVENUE' + C.reset);
  const rls = guardian.revenueLaunchStatus || {};
  for (const [k, v] of Object.entries(rls)) {
    const col = ['READY','READY_TO_PILOT'].includes(v) ? C.green + v + C.reset
              : v === 'BLOCKED' ? C.red + v + C.reset : C.yellow + v + C.reset;
    lines.push('  ' + k.padEnd(32) + col);
  }
  lines.push('');

  // HUMAN YES QUEUE
  lines.push(C.bold + 'HUMAN YES QUEUE' + C.reset);
  lines.push('  Pending: ' + (queue.approvalSummary ? queue.approvalSummary.total : '-'));
  lines.push('  autoProceedAllowed: ' + (queue.autoProceedAllowed ? C.red + 'true' + C.reset : C.green + 'false' + C.reset));
  lines.push('  Top items:');
  const topItems = (queue.pendingApprovals || []).slice(0, 3);
  for (const item of topItems) {
    lines.push('    - ' + item.title + ' (' + item.riskLevel + ')');
  }
  lines.push('');

  // NEXT ACTION
  lines.push(C.bold + 'NEXT ACTION' + C.reset);
  lines.push('  ' + (snap.nextRecommendedAction || '-'));
  lines.push('');

  lines.push(C.bold + '='.repeat(60) + C.reset);
  return lines.join('\n');
}

function buildCommandCenterComplete(opts) {
  opts = opts || {};
  const now             = opts.timestamp || Date.now();
  const commandCenterId = `command-center-complete-${now}`;
  const base            = { timestamp: now };

  const executiveDashboardSnapshot = buildExecutiveDashboardSnapshot(Object.assign({}, base, opts.dashboardOpts  || {}));
  const guardianRevenueVisualBoard = buildGuardianRevenueVisualBoard(Object.assign({}, base, opts.guardianOpts   || {}));
  const humanYesQueueBoard         = buildHumanYesQueueBoard(Object.assign({}, base, opts.queueOpts            || {}));
  const multiProductProgressBoard  = buildMultiProductProgressBoard(Object.assign({}, base, opts.progressOpts   || {}));

  const blockers        = opts.blockers || [];
  const completePackReady = blockers.length === 0;
  const dashboardText   = renderDashboardText(executiveDashboardSnapshot, guardianRevenueVisualBoard, humanYesQueueBoard, multiProductProgressBoard);

  return {
    commandCenterId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    orchestraVersion:      TOOL_META.version,
    commandCenterLevel:    'Shell-based / no Discord / no Webhook',
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    executiveDashboardSnapshot,
    guardianRevenueVisualBoard,
    humanYesQueueBoard,
    multiProductProgressBoard,
    commandCenterOperatingPolicy: COMMAND_CENTER_OPERATING_POLICY,
    dashboardText,
    nextAction: completePackReady
      ? 'こさめ/GPTがAcceptance Gateを実施 → じゅんやさんが最終YES'
      : `blockers解消: ${blockers.join(', ')}`,
    completeCriteria:  COMPLETE_CRITERIA,
    completePackReady,
    blockers,
    humanApprovalPacket: {
      junyaApprovalRequired: true,
      currentStatus:         completePackReady ? 'READY_FOR_APPROVAL' : 'BLOCKED',
      note:                  'じゅんやさんがCommand Center全体を確認してから次フェーズへ'
    },
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  COMMAND_CENTER_OPERATING_POLICY,
  COMPLETE_CRITERIA,
  renderDashboardText,
  buildCommandCenterComplete
};

if (require.main === module) {
  const result = buildCommandCenterComplete({});
  console.log(result.dashboardText);
}
