'use strict';

const { buildReviewPacket }      = require('./dev-agent-external-se-review-packet-pack');
const { buildSecurityChecklist } = require('./dev-agent-security-review-checklist-pack');
const { buildGoNoGoReview }      = require('./dev-agent-production-go-no-go-review-pack');
const { buildCostSavingReport }  = require('./dev-agent-cost-saving-internal-build-report-pack');

const TOOL_META = {
  version: '55.0.0',
  title:   'KOSAME Dev Orchestra External Review Handoff Complete Pack',
  slug:    'dev-agent-external-review-handoff-complete-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)'
];

const PURPOSE_STATEMENTS = [
  '外部SEを「作る人」ではなく「最後の危険箇所を見る監査役」にする',
  'じゅんやさんを作業員に戻さない',
  'KOSAME Dev Orchestraで通常開発の80〜90%を内製する',
  '残り10%はセキュリティ / 本番影響 / 個人情報 / 保険情報 / インフラ / DB / 認証の専門レビューに絞る',
  'Claude Codeは実装担当だがcommit/push/tagはしない',
  'こさめ/GPTがAcceptance Gateを担当',
  'じゅんやさんが最終YES担当'
];

function buildExternalReviewerInstructions(opts) {
  opts = opts || {};
  return {
    role:          '外部SEは「監査役・専門レビュアー」です。実装・commit・deployは行いません。',
    scopeIn:       opts.reviewScope || [
      'セキュリティ設計レビュー',
      '個人情報 / 保険情報データ boundary 監査',
      'IAM / Secret Manager 設計確認',
      'Cloud Run 認証設定確認',
      'GitHub Actions workflow セキュリティ確認',
      'Penetration test / 脆弱性診断',
      '法務 / コンプライアンス確認'
    ],
    scopeOut:      [
      'docs / smoke / fixture の追加作業',
      'README / runbook の文言変更',
      'git commit / push / tag の代行',
      'deploy の代行',
      'Secret 値の閲覧・操作'
    ],
    deliverables:  [
      'セキュリティ問題点一覧 (severity 付き)',
      'GO / HOLD / NO-GO 推奨判定とその根拠',
      '本番公開前に必須の対応項目リスト',
      '個人情報 / 保険情報 data boundary の評価コメント'
    ],
    escalationPath: 'じゅんやさん (最終GO判定者) → こさめ/GPT (PM調整) → Claude Code (修正実装)'
  };
}

function buildHumanApprovalPacket(acceptanceReady) {
  return {
    junyaApprovalRequired: true,
    currentStatus:         acceptanceReady ? 'READY_FOR_APPROVAL' : 'BLOCKED',
    approvalActions:       ['git add', 'git commit', 'git push', 'deploy'],
    deniedActionsForAI:    DANGEROUS_ACTIONS_DENIED,
    note:                  acceptanceReady
      ? 'こさめ/GPTのAcceptance Gate通過済み。じゅんやさんの最終YES待ち。'
      : 'Acceptance Gate を通過していません。blockers を解消してください。'
  };
}

function buildHandoffComplete(opts) {
  opts = opts || {};
  const now           = opts.timestamp || Date.now();
  const completePackId = `external-review-handoff-complete-${now}`;

  const sharedBase = {
    product:       opts.product       || 'KOSAME Dev Orchestra / ANESTY Board',
    repo:          opts.repo          || '/home/shimohigoshi/kosame-dev-orchestra',
    targetVersion: opts.targetVersion || TOOL_META.version,
    timestamp:     now
  };

  const externalSEReviewPacket    = buildReviewPacket(Object.assign({}, sharedBase, opts.reviewPacketOpts    || {}));
  const securityReviewChecklist   = buildSecurityChecklist(Object.assign({}, sharedBase, opts.checklistOpts   || {}));
  const productionGoNoGoReview    = buildGoNoGoReview(Object.assign({}, sharedBase, opts.goNoGoOpts          || {}));
  const costSavingInternalBuildReport = buildCostSavingReport(Object.assign({}, sharedBase, opts.costReportOpts || {}));

  const blockers = [
    ...(opts.blockers || []),
    ...(productionGoNoGoReview.blockers || [])
  ];
  const completePackReady = blockers.length === 0;

  const nextAction = completePackReady
    ? 'こさめ/GPTがAcceptance Gateを実施 → じゅんやさんが最終YES → 外部SEへ handoff packet を送付'
    : `blockers解消が必要: ${blockers.join(', ')}`;

  return {
    completePackId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:          sharedBase.product,
    repo:             sharedBase.repo,
    orchestraVersion: TOOL_META.version,

    purposeStatements: PURPOSE_STATEMENTS,

    externalSEReviewPacket,
    securityReviewChecklist,
    productionGoNoGoReview,
    costSavingInternalBuildReport,

    handoffSummary: opts.handoffSummary || [
      'v51: 外部SEに渡すReview Packet生成済み',
      'v52: セキュリティチェックリスト生成済み',
      'v53: Production Go/No-Go判定ロジック実装済み',
      'v54: コスト削減・内製化記録レポート生成済み',
      'v55: 全packetを統合したHandoff Complete Pack生成済み'
    ],

    externalReviewerInstructions: buildExternalReviewerInstructions(opts),
    humanApprovalPacket:           buildHumanApprovalPacket(completePackReady),
    completePackReady,
    blockers,
    nextAction,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PURPOSE_STATEMENTS,
  buildExternalReviewerInstructions,
  buildHumanApprovalPacket,
  buildHandoffComplete
};

if (require.main === module) {
  const pack = buildHandoffComplete({});
  console.log(JSON.stringify(pack, null, 2));
}
