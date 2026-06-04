'use strict';

const TOOL_META = {
  version: '62.0.0',
  title:   'KOSAME Dev Orchestra Landing Page Requirement Pack',
  slug:    'dev-agent-landing-page-requirement-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real LP publish',
  'real ad launch',
  'real SNS post',
  'real payment processing',
  'real user data collection'
];

const LP_PRINCIPLES = [
  '1秒で何のアプリか分かる',
  'ファーストビューで対象ユーザーと得られる価値が分かる',
  'SNSでスクショが拡散されやすいデザイン',
  'waitlist登録導線がある',
  '作り込みすぎず検証用LPとして軽量',
  '誇大広告・断定表現を避ける',
  '実LP公開はしない (dryRun要件生成まで)'
];

function buildLandingPageRequirement(opts) {
  opts = opts || {};
  const now                    = opts.timestamp || Date.now();
  const landingPageRequirementId = `lp-requirement-${now}`;

  const faqItems = opts.faqItems || [
    { question: 'いつから使えますか？',       answer: 'waitlist登録者に順次ご案内します (時期未定)' },
    { question: '料金はいくらですか？',       answer: 'まずは無料でお試しいただける予定です (確定後お知らせ)' },
    { question: 'どんな人に向いていますか？', answer: opts.targetUser || '(要定義)' },
    { question: '今すぐ使えますか？',         answer: 'waitlist登録フォームからご登録いただけます' }
  ];

  return {
    landingPageRequirementId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:          opts.productIdea  || '(未設定)',
    targetUser:           opts.targetUser   || '(未設定)',

    headline:             opts.headline     || `[対象ユーザー]の[課題]を、[価値提案]で解決する`,
    subHeadline:          opts.subHeadline  || '毎日の[業務名]をAIで自動化。[具体的ベネフィット]。',

    painBefore:           opts.painBefore   || '(要定義: ユーザーが感じている痛み)',
    desiredAfter:         opts.desiredAfter || '(要定義: ツールを使った後の理想状態)',

    coreValueProposition: opts.coreValueProposition || '(要定義: 競合と比べてなぜこれを使うべきか)',

    socialShareHook: opts.socialShareHook || [
      'ファーストビューのキャッチコピーがスクショされやすい',
      '「これ欲しかった」「自分のことだ」と思わせる一言',
      'Before/Afterの数値を視覚的に見せる (例: 30分→2分)'
    ],

    oneSecondMessage: opts.oneSecondMessage || '(要定義: 1文で価値を伝えるメッセージ)',

    firstViewRequirement: opts.firstViewRequirement || {
      hero_text:   '何ができるか1行で伝わるキャッチコピー',
      sub_text:    'ターゲットユーザーと得られる価値を補足',
      cta_button:  'waitlistに登録する / 先行登録する',
      visual:      'Before/After比較図 または デモ画面スクショ',
      social_proof: 'β利用者の声 (あれば) または 利用企業ロゴ'
    },

    waitlistCTA: opts.waitlistCTA || {
      text:        '先行登録して無料で試す',
      subtext:     '今なら先行アクセス枠に参加できます',
      formFields:  ['メールアドレス', '会社名(任意)', '職種(任意)'],
      thankYouMsg: 'ご登録ありがとうございます。準備ができ次第ご連絡します。'
    },

    proofOrDemoSection: opts.proofOrDemoSection || {
      type:    'demo_screenshot_or_video',
      content: '実際の画面スクショ / 動作デモ動画 (30秒以内)',
      note:    '作り込み前なので Figmaモックや Loomデモでも可'
    },

    faqItems,

    riskNotes: opts.riskNotes || [
      '誇大広告・根拠なき断定表現を使わない',
      '実LPは公開しない (dryRun設計まで)',
      '個人情報収集フォームは実装しない',
      'waitlist登録機能の実実装は別途承認ゲートを通す'
    ],

    lpPrinciples: LP_PRINCIPLES,
    generatedAt:  new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  LP_PRINCIPLES,
  buildLandingPageRequirement
};

if (require.main === module) {
  const result = buildLandingPageRequirement({
    productIdea:  'AI議事録自動化ツール',
    targetUser:   '中小企業の営業担当者',
    headline:     '会議の議事録を30秒で自動生成。営業担当者の30分を取り戻す。',
    subHeadline:  '録音するだけで要点・タスク・次回アクションを自動整理。'
  });
  console.log(JSON.stringify(result, null, 2));
}
