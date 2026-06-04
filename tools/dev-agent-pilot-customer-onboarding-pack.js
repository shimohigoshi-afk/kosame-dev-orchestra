'use strict';

const TOOL_META = {
  version: '74.0.0',
  title:   'KOSAME Dev Orchestra Pilot Customer Onboarding Pack',
  slug:    'dev-agent-pilot-customer-onboarding-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real customer data import without approval',
  'real contract execution',
  'real payment processing'
];

function buildPilotCustomerOnboarding(opts) {
  opts = opts || {};
  const now         = opts.timestamp || Date.now();
  const onboardingId = `pilot-onboarding-${now}`;

  const pilotCustomerCriteria = opts.pilotCustomerCriteria || [
    'Guardian Classが通過済みであること',
    '顧客の課題がプロダクトで解決できると判断できること',
    '顧客から非公式な「試したい」シグナルがあること',
    '機密情報・保険情報・個人情報の取り扱いに合意できること',
    'パイロット期間・目標・解約条件を事前に合意できること'
  ];

  const onboardingSteps = opts.onboardingSteps || [
    {
      step:        1,
      title:       'パイロット合意書の確認',
      description: 'パイロット期間・目的・成功基準・守秘義務を書面または口頭で合意する',
      humanRequired: true,
      dryRunOnly:   false
    },
    {
      step:        2,
      title:       '初期セットアップ (dryRun確認)',
      description: 'アカウント作成・初期設定の手順をdryRunで確認してから実行する',
      humanRequired: true,
      dryRunOnly:   false
    },
    {
      step:        3,
      title:       'キックオフミーティング',
      description: '使い方説明・質問対応・期待値調整を行う',
      humanRequired: true,
      dryRunOnly:   false
    },
    {
      step:        4,
      title:       '週次チェックイン',
      description: '進捗・課題・フィードバックを毎週収集する',
      humanRequired: false,
      dryRunOnly:   false
    },
    {
      step:        5,
      title:       '中間レビュー (2週間後)',
      description: '価値提供の確認・問題点の解消・継続意向の確認',
      humanRequired: true,
      dryRunOnly:   false
    },
    {
      step:        6,
      title:       'パイロット完了レビュー (30日後)',
      description: '成果報告・有料転換オファー・次ステップの合意',
      humanRequired: true,
      dryRunOnly:   false
    }
  ];

  const successMetrics = opts.successMetrics || [
    '週1回以上のアクティブ利用',
    '顧客から「続けたい」シグナルが出ること',
    '有料転換の意向を示すこと',
    '紹介・口コミが発生すること (optional)'
  ];

  return {
    onboardingId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    productIdea:             opts.productIdea || '(未設定)',
    pilotCustomerCriteria,
    onboardingSteps,
    successMetrics,

    escalationPath: opts.escalationPath || [
      'パイロット中に問題発生 → じゅんやさんに即報告',
      '顧客情報・個人情報に関わる問題 → 即座に停止してじゅんやさん + こさめ/GPTへエスカレーション',
      '保険・金融・法務に関わるリスク → 外部SE / 法務に相談'
    ],

    guardianClassRequired: true,
    realOnboardingExecuted: false,
    generatedAt:            new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildPilotCustomerOnboarding
};

if (require.main === module) {
  const result = buildPilotCustomerOnboarding({ productIdea: 'AI議事録自動化ツール' });
  console.log(JSON.stringify(result, null, 2));
}
