'use strict';

const TOOL_META = {
  version: '61.0.0',
  title:   'KOSAME Dev Orchestra Product Idea Discovery Pack',
  slug:    'dev-agent-product-idea-discovery-pack'
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

const EVALUATION_DIMENSIONS = [
  '1秒で何のアプリか伝わるか',
  'ユーザーの悩みが明確か',
  '競合がいるか (需要の証拠として活用)',
  '差別化余地があるか',
  'UI/UXや見せ方で勝てるか',
  '営業現場・SNS・既存顧客から逆算できているか',
  '海外でバズったものを日本向けにローカライズできるか',
  'じゅんやさんの営業力・現場知見が活かせるか'
];

function scoreOneSecondUnderstanding(opts) {
  opts = opts || {};
  let score = 5;
  if (opts.productIdea && opts.productIdea.length < 20)  score += 2;
  if (opts.targetUser  && opts.targetUser.length  < 30)  score += 1;
  if (opts.painPoint   && opts.painPoint.length   < 40)  score += 1;
  if (score > 10) score = 10;
  return opts.oneSecondUnderstandingScore !== undefined ? opts.oneSecondUnderstandingScore : score;
}

function buildIdeaDiscovery(opts) {
  opts = opts || {};
  const now              = opts.timestamp || Date.now();
  const ideaDiscoveryId  = `idea-discovery-${now}`;
  const score            = scoreOneSecondUnderstanding(opts);

  const ideaRisks = opts.ideaRisks || [
    'ターゲットユーザーが曖昧な場合、訴求が刺さらない',
    '競合の完成度が高い場合、差別化できない可能性がある',
    '課金意欲が低い層を対象にしている場合、LTV/CACが合わない',
    '開発工数が大きい場合、MVP前に予算が尽きるリスクがある'
  ];

  const nextValidationStep = opts.nextValidationStep || (
    score >= 8
      ? 'LP要件生成 → waitlist需要検証'
      : score >= 5
        ? 'ターゲットユーザーと訴求を絞り込んでから再評価'
        : 'アイデアを再定義する (ターゲット / 課題 / 価値を明確化)'
  );

  return {
    ideaDiscoveryId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:     opts.productIdea     || '(未設定)',
    targetUser:      opts.targetUser      || '(未設定)',
    painPoint:       opts.painPoint       || '(未設定)',

    urgency:         opts.urgency         || 'medium',
    willingnessToPayHypothesis: opts.willingnessToPayHypothesis || '月額 数百〜数千円レンジを想定 (要検証)',

    snsHookHypothesis: opts.snsHookHypothesis || [
      '「AIが〇〇を代わりにやってくれる」系は拡散されやすい',
      '「コストが 1/10 になった」等の具体的成果は引用されやすい',
      'Before/After のスクショが拡散の起点になりやすい'
    ],

    oneSecondUnderstandingScore: score,
    oneSecondUnderstandingNote:  score >= 8 ? '良好' : score >= 5 ? '要改善' : '要再定義',

    competitorSignal: opts.competitorSignal || {
      exists:   opts.competitorExists !== false,
      note:     '競合の存在は需要の証拠として積極的に活用する',
      examples: opts.competitorExamples || ['(要調査)']
    },

    differentiationAngles: opts.differentiationAngles || [
      'UIの分かりやすさ・速さで勝つ',
      '日本語最適化・業界特化で勝つ',
      'じゅんやさんの営業力・既存顧客ルートで初期展開'
    ],

    localizationOpportunity: opts.localizationOpportunity || '海外でバズった同カテゴリの日本語版として投入できる可能性を検討する',

    salesInsight: opts.salesInsight || [
      '営業現場の課題から逆算してプロダクトを定義するアプローチが有効',
      '既存顧客へのヒアリングでwillingnessToPay仮説を早期検証できる',
      'じゅんやさんの直販チャネルを初期獲得に活用する'
    ],

    ideaRisks,
    evaluationDimensions: EVALUATION_DIMENSIONS,
    nextValidationStep,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  EVALUATION_DIMENSIONS,
  scoreOneSecondUnderstanding,
  buildIdeaDiscovery
};

if (require.main === module) {
  const result = buildIdeaDiscovery({
    productIdea: 'AI議事録自動化ツール',
    targetUser:  '中小企業の営業担当者',
    painPoint:   '会議後の議事録作成に毎回30分かかる',
    urgency:     'high'
  });
  console.log(JSON.stringify(result, null, 2));
}
