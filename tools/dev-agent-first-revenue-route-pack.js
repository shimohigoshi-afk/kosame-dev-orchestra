'use strict';

const TOOL_META = {
  version: '71.0.0',
  title:   'KOSAME Dev Orchestra First Revenue Route Pack',
  slug:    'dev-agent-first-revenue-route-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real payment processing',
  'real contract execution',
  'real customer data collection'
];

const REVENUE_MODELS = {
  SUBSCRIPTION:    'subscription',
  ONE_TIME:        'one_time',
  FREEMIUM:        'freemium',
  PAY_PER_USE:     'pay_per_use',
  PILOT_FREE_THEN_PAID: 'pilot_free_then_paid'
};

const ACQUISITION_CHANNELS = [
  'direct_sales (じゅんやさんの直販)',
  'existing_customer_upsell (既存顧客へのアップセル)',
  'referral (紹介)',
  'sns_organic (SNSオーガニック)',
  'content_marketing',
  'waitlist_conversion (waitlist → paid)',
  'pilot_to_paid (pilot → 有料転換)'
];

function buildFirstRevenueRoute(opts) {
  opts = opts || {};
  const now     = opts.timestamp || Date.now();
  const routeId = `first-revenue-route-${now}`;

  return {
    routeId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:           opts.productIdea    || '(未設定)',
    targetCustomer:        opts.targetCustomer || '(未設定)',

    revenueModel:          opts.revenueModel   || REVENUE_MODELS.PILOT_FREE_THEN_PAID,
    pricingHypothesis:     opts.pricingHypothesis || {
      initialPilot: '無料パイロット (30日間)',
      paidTier:     '月額 数千〜数万円 (要検証)',
      note:         '価格は需要検証・パイロット結果を見てから決定する'
    },

    acquisitionChannel:    opts.acquisitionChannel || 'direct_sales (じゅんやさんの直販)',
    allAcquisitionChannels: ACQUISITION_CHANNELS,

    conversionPath:        opts.conversionPath || [
      '1. waitlist登録 or 直販コンタクト',
      '2. パイロット申し込み (無料 or 低価格)',
      '3. 価値提供確認 → 有料転換オファー',
      '4. 契約 → 継続利用 → 口コミ/紹介'
    ],

    firstRevenueTarget:    opts.firstRevenueTarget || {
      target:   '初回有料顧客 1件',
      timeline: 'パイロット開始後 30〜60日',
      note:     '数字は目安。業種・顧客規模により変動する'
    },

    revenueBlockers:       opts.revenueBlockers || [
      'Guardian Class未確認 → 顧客向け運用前にGuardian Classを通す',
      '価格未決定 → Offer/Pricing Testで検証する',
      '営業メッセージ未整備 → Sales Message/Outreachで準備する'
    ],

    humanApprovalRequired: true,
    realRevenueActions:    false,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  REVENUE_MODELS,
  ACQUISITION_CHANNELS,
  buildFirstRevenueRoute
};

if (require.main === module) {
  const result = buildFirstRevenueRoute({ productIdea: 'AI議事録自動化ツール', targetCustomer: '中小企業の営業チーム' });
  console.log(JSON.stringify(result, null, 2));
}
