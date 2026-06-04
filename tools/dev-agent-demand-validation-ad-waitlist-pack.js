'use strict';

const TOOL_META = {
  version: '63.0.0',
  title:   'KOSAME Dev Orchestra Demand Validation Ad / Waitlist Pack',
  slug:    'dev-agent-demand-validation-ad-waitlist-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real ad launch',
  'real LP publish',
  'real SNS post',
  'real payment processing',
  'real user data collection'
];

const CPA_THRESHOLDS = {
  strong:   { min: 0,    max: 300,  label: 'strong_signal',      note: 'CPA 300円以内: 強い需要シグナル。BUILD候補。' },
  moderate: { min: 300,  max: 1000, label: 'moderate_signal',    note: 'CPA 300〜1000円: 追加検証・訴求改善。VALIDATE_MORE候補。' },
  weak:     { min: 1000, max: null, label: 'weak_or_no_signal',  note: 'CPA 1000円超: 需要シグナルが弱い。PIVOT検討候補。' }
};

const VALIDATION_CHANNELS = ['x_post', 'x_ads', 'meta_ads', 'organic_sns', 'existing_customer_interview'];

function classifyCpa(cpaValue) {
  if (cpaValue === null || cpaValue === undefined) return { status: 'unknown', note: 'CPA未計測 — 先にデータを取る' };
  if (cpaValue <= 300)  return CPA_THRESHOLDS.strong;
  if (cpaValue <= 1000) return CPA_THRESHOLDS.moderate;
  return CPA_THRESHOLDS.weak;
}

function buildDemandValidation(opts) {
  opts = opts || {};
  const now                = opts.timestamp || Date.now();
  const demandValidationId = `demand-validation-${now}`;

  const cpaValue       = opts.actualCpa !== undefined ? opts.actualCpa : null;
  const cpaClassified  = classifyCpa(cpaValue);
  const waitlistCount  = opts.waitlistCount !== undefined ? opts.waitlistCount : null;

  let passCondition  = opts.passCondition;
  let pivotCondition = opts.pivotCondition;

  if (!passCondition) {
    passCondition = [
      'CPA 300円以内 かつ waitlist 10件以上 → BUILD候補',
      'X投稿のインプレッション比較でCTR 1%以上 → LP訴求が機能している',
      '既存顧客インタビューで「絶対使いたい」が3件以上 → BUILD候補'
    ];
  }
  if (!pivotCondition) {
    pivotCondition = [
      'CPA 1000円超 かつ waitlist 0件 → PIVOT/HOLD',
      'インプレッション100以上でCTR 0.1%未満 → 訴求を再定義',
      '既存顧客インタビューで「要らない」が過半数 → アイデア再定義',
      'CTAボタンのクリック率が1%未満 (十分な表示があった場合) → LP/訴求を改善'
    ];
  }

  return {
    demandValidationId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:       opts.productIdea || '(未設定)',
    validationChannels: VALIDATION_CHANNELS,

    adBudgetPlan: {
      isExampleOnly: true,
      isOptional:    true,
      executedInThisPack: false,
      note:          '実広告出稿はしない。以下はexampleOnly / 参考材料。',
      xAdsExample:   '¥5,000〜¥10,000 (CTR・CVR確認用の最小テスト)',
      metaAdsExample: '¥5,000〜¥10,000 (同上)',
      totalBudgetGuide: '初期検証予算は¥10,000〜¥20,000程度が目安 (業種・競争環境により変動)',
      hardGuarantee: false
    },

    waitlistTarget:   opts.waitlistTarget   || '初期目標: 10〜50件 (検証十分な母数として)',
    impressionEstimate: opts.impressionEstimate || '1,000〜5,000インプレッション (SNSまたは広告、初期検証用)',
    expectedClickSignal: opts.expectedClickSignal || 'CTR 1%以上をポジティブシグナルの初期目安とする',
    expectedWaitlistSignal: opts.expectedWaitlistSignal || '10件以上でBUILD候補検討、0件でHOLD/PIVOT',

    cpaCalculationMethod: opts.cpaCalculationMethod || '広告費÷waitlist登録件数。SNSオーガニックはCPA=0として補助指標に使う。',
    cpaThreshold: CPA_THRESHOLDS,
    actualCpa:    cpaValue,
    cpaStatus:    cpaClassified,
    waitlistCount,
    waitlistStatus: waitlistCount === null ? 'unknown'
      : waitlistCount === 0 ? 'HOLD_OR_PIVOT'
      : waitlistCount >= 10 ? 'POSITIVE_SIGNAL'
      : 'COLLECTING',

    resultReviewTemplate: opts.resultReviewTemplate || {
      fields: [
        'productIdea',
        'channel',
        'impressions',
        'clicks',
        'ctr',
        'waitlistSignups',
        'cpa',
        'qualitativeNotes',
        'recommendation'
      ],
      note: 'このテンプレートに実測値を埋めてこさめ/GPTへ報告する'
    },

    passCondition,
    pivotCondition,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  CPA_THRESHOLDS,
  VALIDATION_CHANNELS,
  classifyCpa,
  buildDemandValidation
};

if (require.main === module) {
  const result = buildDemandValidation({ productIdea: 'AI議事録自動化ツール' });
  console.log(JSON.stringify(result, null, 2));
}
