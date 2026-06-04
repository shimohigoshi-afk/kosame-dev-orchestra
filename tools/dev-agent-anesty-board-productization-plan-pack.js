'use strict';

const TOOL_META = {
  version: '94.0.0',
  title:   'KOSAME Dev Orchestra ANESTY Board Productization Plan Pack',
  slug:    'dev-agent-anesty-board-productization-plan-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'api key read',
  'customer data read', 'insurance data read',
  'deploy', 'git add/commit/push/tag',
  'destructive delete', 'external repo mutation',
  'real Discord/Webhook send', 'real SNS post',
  'anesty-board repo mutation'
];

const PRODUCTIZATION_ANGLES = [
  { angle: 'SNS投稿制作支援Bot',    description: 'AIがSNS投稿の下書き・バリエーション・ハッシュタグを提案。人間が最終投稿。', riskLevel: 'low' },
  { angle: '会議・ブレスト支援Bot', description: 'Discord上でリアルタイムにアイデア整理・要点まとめを支援。会議録下書き生成。', riskLevel: 'medium' },
  { angle: 'コンテンツ企画支援',    description: '企画テンプレート・ターゲット分析・競合比較をAIで補助。人間が最終判断。', riskLevel: 'low' }
];

function buildAnestyBoardProductizationPlan(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const planId = `anesty-board-productization-plan-${now}`;

  return {
    anestyBoardProductizationPlanId: planId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:     'ANESTY Board',
    productType: 'discord_ai_board',

    productizationAngles: opts.productizationAngles || PRODUCTIZATION_ANGLES,

    targetUsers: opts.targetUsers || [
      '中小企業のマーケティング担当者',
      'フリーランスのコンテンツクリエイター',
      'SNS運用チーム',
      'ブレスト・会議を効率化したい経営者'
    ],

    pilotOffer: opts.pilotOffer || {
      type:          'pilot_free_then_paid',
      pilotPeriod:   '30日間無料パイロット',
      targetChannel: 'じゅんやさんの直販 / 紹介',
      paidTier:      '月額 数千〜数万円 (需要検証後に決定)',
      hardGuarantee: false
    },

    contentWorkflow: opts.contentWorkflow || {
      step1: 'ユーザーがDiscordでトピック・要件を入力',
      step2: 'ANESTY BoardがAIで下書き・提案を生成',
      step3: 'ユーザーが確認・修正',
      step4: 'ユーザーが実際に投稿・使用 (Botは代行しない)',
      autoPostBlocked: true
    },

    discordOperationalRisk: opts.discordOperationalRisk || {
      webhookSend:  'BLOCKED — じゅんやさんYES必須',
      botToken:     'BLOCKED — Secret Managerから取得。AIは読まない',
      autoPost:     'BLOCKED — 実投稿は人間のみ',
      customerData: 'BLOCKED — PII・顧客情報は扱わない'
    },

    guardianRequirements: opts.guardianRequirements || [
      'v66〜v70 Guardian Class通過必須',
      'Discord Bot token は Secret Manager に保管 (AIは読まない)',
      'Webhook / Bot実送信はじゅんやさんYES必須'
    ],

    revenueRequirements: opts.revenueRequirements || [
      'v71〜v75 Revenue Launch Line通過',
      'waitlist / 紹介経由で初期パイロット顧客を確保'
    ],

    launchBlockers: opts.launchBlockers || [
      'Guardian Class (v70) 未通過',
      'Discord Bot Token / Webhook Secret 設定 未承認',
      'パイロット顧客候補 未選定'
    ],

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  PRODUCTIZATION_ANGLES,
  buildAnestyBoardProductizationPlan
};

if (require.main === module) {
  console.log(JSON.stringify(buildAnestyBoardProductizationPlan({}), null, 2));
}
