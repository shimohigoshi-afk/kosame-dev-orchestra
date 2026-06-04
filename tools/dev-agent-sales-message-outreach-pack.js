'use strict';

const TOOL_META = {
  version: '73.0.0',
  title:   'KOSAME Dev Orchestra Sales Message / Outreach Pack',
  slug:    'dev-agent-sales-message-outreach-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real email send',
  'real SNS post',
  'real customer contact without human approval'
];

function buildSalesMessageOutreach(opts) {
  opts = opts || {};
  const now       = opts.timestamp || Date.now();
  const outreachId = `sales-message-outreach-${now}`;

  const salesMessages = opts.salesMessages || [
    {
      messageId:    'sm-001',
      channel:      'direct_sales',
      subject:      '[productIdea] — 課題解決のご提案',
      bodyTemplate: `[顧客名]様\n\n[課題]でお困りではないでしょうか。\n私どもの[productIdea]では、[価値提案]が実現できます。\n\n30日間の無料パイロットにご参加いただけないでしょうか。\n\n詳しくはこちら: [LP URL (人間確認後に設定)]\n\n[署名]`,
      tone:         'professional / consultative',
      dryRunOnly:   true,
      realSendExecuted: false
    },
    {
      messageId:    'sm-002',
      channel:      'existing_customer_upsell',
      subject:      '新機能のご案内: [productIdea]',
      bodyTemplate: `[顧客名]様\n\nいつもありがとうございます。\n新しく[productIdea]をリリースしました。[顧客の課題]に対応した機能です。\n\nぜひ先行パイロットにご招待したいと思います。\n\n[CTA]`,
      tone:         'friendly / personal',
      dryRunOnly:   true,
      realSendExecuted: false
    },
    {
      messageId:    'sm-003',
      channel:      'sns_post_draft',
      bodyTemplate: `[1秒で分かるキャッチコピー]\n\n[痛み/課題の描写]\n\n[価値提案]\n\nwaitlist登録はこちら👇\n[URL (人間確認後に設定)]\n\n#[ハッシュタグ]`,
      tone:         'conversational / hook-first',
      dryRunOnly:   true,
      realSendExecuted: false,
      note:         '実投稿は人間承認ゲートを通す'
    }
  ];

  const outreachSequence = opts.outreachSequence || [
    { step: 1, action: 'ターゲットリストを作成する (既存顧客 + waitlist + 紹介)', humanRequired: true },
    { step: 2, action: 'メッセージ草案をこさめ/GPTとレビューする',                humanRequired: false },
    { step: 3, action: 'じゅんやさんが最終メッセージを確認・承認する',            humanRequired: true },
    { step: 4, action: '実際のアウトリーチを実行する (メール/SNS)',               humanRequired: true },
    { step: 5, action: '返信・反応を記録してフォローアップする',                   humanRequired: true }
  ];

  return {
    outreachId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:       opts.productIdea || '(未設定)',
    salesMessages,
    outreachSequence,

    personalization: opts.personalization || {
      approach: 'じゅんやさんの営業経験・既存顧客知見を活かした個別訴求',
      note:     'テンプレートを使いつつ、顧客ごとに課題・状況を反映する'
    },

    safetyNotes: [
      '実メール送信は人間承認ゲートを通す',
      '個人情報・顧客情報をメッセージ本文に含める場合は別途確認',
      '保険・金融・法務に関わる表現は特に慎重に確認する',
      '誇大広告・根拠なき断定表現を使わない'
    ],

    realOutreachExecuted: false,
    generatedAt:          new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildSalesMessageOutreach
};

if (require.main === module) {
  const result = buildSalesMessageOutreach({ productIdea: 'AI議事録自動化ツール' });
  console.log(JSON.stringify(result, null, 2));
}
