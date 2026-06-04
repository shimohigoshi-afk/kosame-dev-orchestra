'use strict';

const TOOL_META = {
  version: '91.0.0',
  title:   'KOSAME Dev Orchestra Sales DX First Product Launch Plan Pack',
  slug:    'dev-agent-sales-dx-first-product-launch-plan-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'api key read',
  'customer data read', 'insurance data read',
  'deploy', 'git add/commit/push/tag',
  'destructive delete', 'external repo mutation',
  'real Gmail send', 'real customer contact',
  'real contract execution', 'real payment processing'
];

const DEFAULT_GUARDIAN_REQUIREMENTS = [
  'v67 customerFacingOperationGuard — 告知義務・健康情報・保険料非断定・PDF分離',
  'v68 dataSecretPermissionGate — 顧客データ/Secret/IAM境界確認',
  'v70 guardianClassComplete — 全Guardian通過必須',
  'v75 firstRevenueCompleteGate — パイロット前にRevenue Gate通過'
];

const DEFAULT_DATA_BOUNDARY = {
  customerPII:         'BLOCKED — 氏名・生年月日・住所・電話番号は本文に出さない',
  insuranceData:       'BLOCKED — 保険証券・健診情報・病歴はPDF化 + パスワード別送',
  premiumEstimate:     'NON_DEFINITIVE — 「概算」「参考値」と明記。AIが断定しない',
  existingContracts:   'BLOCKED — 既契約情報を誤って別顧客に見せない',
  policyholderCheck:   'REQUIRED — 被保険者・契約者・受取人の取り違えを防ぐ',
  financialLegalJudge: 'HUMAN_GATE — 金融・保険・税務・法務判断は人間確認ゲート'
};

function buildSalesDxFirstProductLaunchPlan(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const planId = `sales-dx-launch-plan-${now}`;

  const launchBlockers = opts.launchBlockers || [
    'Guardian Class (v70) 未通過 — customerFacingGuard / dataSecretPermission 確認必須',
    '顧客/保険データ境界 未定義 — External SE レビュー必須',
    'Cloud Run deploy 未承認 — じゅんやさんのYES必須',
    '実顧客データアクセス 未承認 — Guardian + 外部SEレビュー後にじゅんやさんYES'
  ];

  return {
    salesDxLaunchPlanId:   planId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:     '営業DX',
    productType: 'sales_dx_pipeline',

    firstUseCase: opts.firstUseCase || {
      title:       'AI議事録・提案書下書き生成 (draft-only)',
      description: '営業担当者の会議後の議事録・提案書下書きをAIで自動生成する。実送信・実顧客データアクセスはしない。',
      scope:       'draft_only',
      realSend:    false
    },

    targetCustomer: opts.targetCustomer || '中小企業の営業チーム (既存顧客からのパイロット)',

    minimumMvpScope: opts.minimumMvpScope || [
      '議事録下書き生成 (テキスト入力 → 構造化テキスト出力)',
      '提案書テンプレート適用 (テンプレート選択 → 下書き生成)',
      'Human-in-the-loop: 全出力をじゅんやさん/担当者が確認してから使用'
    ],

    guardianRequirements:  DEFAULT_GUARDIAN_REQUIREMENTS,
    revenueRequirements:   ['v71〜v75 Revenue Launch Line通過', 'パイロット顧客候補の合意', '価格仮説の検証'],
    cloudRunRequirements:  ['Cloud Run deploy じゅんやさんYES後のみ', 'IAM/Secret Managerは外部SEレビュー後'],
    dataBoundary:          DEFAULT_DATA_BOUNDARY,
    launchBlockers,

    nextAction: launchBlockers.length > 0
      ? `blockers解消が必要: ${launchBlockers[0]}`
      : 'パイロット顧客へのアウトリーチ準備を開始する (じゅんやさんYES後)',

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  DEFAULT_GUARDIAN_REQUIREMENTS,
  DEFAULT_DATA_BOUNDARY,
  buildSalesDxFirstProductLaunchPlan
};

if (require.main === module) {
  console.log(JSON.stringify(buildSalesDxFirstProductLaunchPlan({}), null, 2));
}
