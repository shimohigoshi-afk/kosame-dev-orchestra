'use strict';

const TOOL_META = {
  version: '92.0.0',
  title:   'KOSAME Dev Orchestra Email Reply BOT MVP Launch Plan Pack',
  slug:    'dev-agent-email-reply-bot-mvp-launch-plan-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'api key read',
  'customer data read', 'insurance data read',
  'deploy', 'git add/commit/push/tag',
  'destructive delete', 'external repo mutation',
  'real Gmail send', 'real email send',
  'real customer contact', 'real attachment access'
];

function buildEmailReplyBotMvpLaunchPlan(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const planId = `email-reply-bot-mvp-launch-plan-${now}`;

  return {
    emailReplyBotMvpLaunchPlanId: planId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:     'Email Reply BOT',
    productType: 'email_reply_bot',

    mvpScope: opts.mvpScope || [
      '返信文案の下書き生成 (draft-only、実送信なし)',
      'トーン / フォーマット調整',
      'テンプレート分類・適用',
      'Human-in-the-loop: 全下書きを担当者が確認してから送信'
    ],

    draftOnlyPolicy: {
      enabled:     true,
      description: '全メール出力はdraftのみ。実送信はじゅんやさん / 担当者のGmailから手動送信。',
      autoSend:    false
    },

    autoSendBlocked: true,

    gmailHandlingPolicy: opts.gmailHandlingPolicy || {
      apiAccess:   'HUMAN_GATE — Gmail API呼び出しはじゅんやさんYES後のみ',
      draftOnly:   true,
      sendGate:    'Human confirmation required before any send',
      oauthScope:  'gmail.readonly or gmail.compose (not gmail.send unless approved)'
    },

    pdfSeparationPolicy: opts.pdfSeparationPolicy || {
      enabled:     true,
      description: '保障額・保険料・契約詳細・健康情報はPDF化し本文に平文で出さない',
      passwordRule: 'パスワードは別メールで別送する',
      categories:  ['保険料試算', '保障額', '契約詳細', '健康状態', '病歴', '健診結果']
    },

    humanReviewPolicy: opts.humanReviewPolicy || {
      required:     true,
      reviewer:     'じゅんやさん / 担当者',
      reviewSteps:  ['AI下書き生成', '担当者確認・修正', '送信実行 (人間のみ)'],
      escalation:   '保険・金融・法務表現が含まれる場合は必ず確認してから送信'
    },

    pilotPlan: opts.pilotPlan || {
      pilotCustomer:  '既存顧客 (じゅんやさんが選定)',
      pilotDuration:  '30日間',
      successMetrics: ['下書き採用率 > 50%', '担当者の修正時間 > 30%削減', '誤表現 0件'],
      guardianCheck:  'v70 Guardian Class通過必須'
    },

    launchBlockers: opts.launchBlockers || [
      'Gmail API OAuth設定 未承認 (じゅんやさんYES必須)',
      'Guardian Class (v70) 未通過',
      'PII / 保険情報取り扱いポリシー 未確定'
    ],

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildEmailReplyBotMvpLaunchPlan
};

if (require.main === module) {
  console.log(JSON.stringify(buildEmailReplyBotMvpLaunchPlan({}), null, 2));
}
