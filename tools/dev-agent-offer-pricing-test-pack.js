'use strict';

const TOOL_META = {
  version: '72.0.0',
  title:   'KOSAME Dev Orchestra Offer / Pricing Test Pack',
  slug:    'dev-agent-offer-pricing-test-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real payment processing',
  'real billing execution',
  'real contract execution'
];

function buildOfferPricingTest(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const testId = `offer-pricing-test-${now}`;

  const offerVariants = opts.offerVariants || [
    {
      variantId:    'ov-001',
      name:         '無料パイロット (30日)',
      price:        0,
      period:       '30日間無料',
      cta:          '無料で試してみる',
      hypothesis:   '無料で試せることで初期ハードルを下げ、価値提供後に有料転換',
      targetSegment: 'リスク回避型の中小企業'
    },
    {
      variantId:    'ov-002',
      name:         '月額スタータープラン',
      price:        null,
      period:       '月額 (価格TBD)',
      cta:          '今すぐ始める',
      hypothesis:   '月額制でキャッシュフローを安定化。価格は需要検証後に決定',
      targetSegment: '継続利用を前提とした企業'
    },
    {
      variantId:    'ov-003',
      name:         '初回割引オファー',
      price:        null,
      period:       '初月 XX% OFF (価格TBD)',
      cta:          '今だけ特別価格で',
      hypothesis:   '初回割引で決断ハードルを下げる。割引率は実際の反応を見てから決定',
      targetSegment: '価格感度が高い層'
    }
  ];

  return {
    testId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:    opts.productIdea || '(未設定)',
    offerVariants,

    pricingMatrix: opts.pricingMatrix || {
      note:          '価格は需要検証・競合調査・LTV/CAC試算を基に設定する',
      hardGuarantee: false,
      suggestedRange: '月額 数千〜数万円 (業種・規模・価値により変動)',
      pricingPrinciples: [
        '競合より安くする必要はない。価値で正当化する',
        '最初から高い価格を設定して後で下げるほうが逆より難しい',
        'AIコスト・インフラコストをLTV/CACに含めて設定する',
        '断定的な価格提示はしない (dryRun段階では特に)'
      ]
    },

    testMethodology: opts.testMethodology || [
      '複数バリアントをパイロット顧客に提示し反応を観察する',
      'A/Bテストが可能なら実施する (人間承認後)',
      '「いくらなら払うか」インタビューを既存顧客に行う',
      'waitlist登録者への価格感度アンケート'
    ],

    successMetrics: opts.successMetrics || [
      'オファー提示後の商談転換率',
      '価格に対するポジティブ反応率',
      '有料転換件数 (パイロット → paid)',
      '解約率 (価格起因)'
    ],

    realBillingExecuted: false,
    generatedAt:         new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildOfferPricingTest
};

if (require.main === module) {
  const result = buildOfferPricingTest({ productIdea: 'AI議事録自動化ツール' });
  console.log(JSON.stringify(result, null, 2));
}
