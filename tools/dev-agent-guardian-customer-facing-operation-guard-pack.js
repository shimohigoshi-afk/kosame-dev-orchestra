'use strict';

const TOOL_META = {
  version: '67.0.0',
  title:   'KOSAME Dev Orchestra Guardian Customer-Facing Operation Guard Pack',
  slug:    'dev-agent-guardian-customer-facing-operation-guard-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'deploy (any form)',
  'git push (automated)',
  'customer data read',
  'destructive delete (rm -rf, git reset --hard, git clean -f)',
  'real email send',
  'real customer data access',
  'real contract execution',
  'real insurance application submission'
];

const GENERAL_OPERATION_GUARDS = [
  { guardId: 'cog-001', category: 'general', title: 'PII in response body block',          severity: 'critical', description: '個人情報 (氏名・生年月日・住所・電話番号・メールアドレス) を顧客向けレスポンスに平文で出力しない', humanGateRequired: true },
  { guardId: 'cog-002', category: 'general', title: 'Real email send gate',                 severity: 'critical', description: '実メール送信はじゅんやさんの承認ゲートを通す', humanGateRequired: true },
  { guardId: 'cog-003', category: 'general', title: 'Customer data cross-contamination',    severity: 'critical', description: '顧客Aのデータを顧客Bに見せない (テナント分離を確認)', humanGateRequired: true },
  { guardId: 'cog-004', category: 'general', title: 'Unverified AI output disclaimer',      severity: 'high',    description: 'AIの出力は事実確認前に顧客へ送信しない', humanGateRequired: true },
  { guardId: 'cog-005', category: 'general', title: 'Complaint / escalation path',          severity: 'high',    description: 'クレーム・エスカレーション経路が定義されていること', humanGateRequired: false }
];

const INSURANCE_SALES_RISK_NOTES = [
  '告知義務違反につながる表現 (「問題ない」「大丈夫」等) を出さない',
  '健康状態・病歴・健診結果を本文メールに平文で出さない',
  '保険料試算をAIが断定しない (必ず「概算」「参考値」と明記する)',
  '保障額・保険料・契約詳細を本文にそのまま出さない',
  '既契約情報を誤って別顧客に見せない',
  '被保険者・契約者・受取人などの取り違えを防ぐ (複数人案件は必ず個別確認)',
  '保険会社・商品名・特約名・条件を誤って断定しない',
  '引受可否・診査結果・告知判断をAIが断定しない',
  '金融・保険・税務・法務に関わる判断は人間確認ゲートに置く',
  '本文に出してよい内容とPDF化すべき内容を分離する',
  'PDF化した場合はパスワード別送ルールを適用する'
];

const INSURANCE_SPECIFIC_GUARDS = [
  {
    guardId:             'ins-001',
    category:            'insurance_sales_dx',
    title:               '告知義務違反リスク表現ブロック',
    severity:            'critical',
    description:         '「問題ない」「大丈夫」「通る」など告知義務違反につながる断定表現をAIが出力しない',
    humanGateRequired:   true,
    disclosureDutyRiskGuard: true
  },
  {
    guardId:             'ins-002',
    category:            'insurance_sales_dx',
    title:               '健康情報本文ブロック',
    severity:            'critical',
    description:         '健康状態・病歴・健診結果を本文メール / チャット本文に平文で出さない。PDF化 + パスワード別送を徹底する',
    humanGateRequired:   true,
    healthInformationBodyBlock: true
  },
  {
    guardId:             'ins-003',
    category:            'insurance_sales_dx',
    title:               '保険料試算非断定ポリシー',
    severity:            'critical',
    description:         '保険料試算をAIが断定しない。「概算」「参考値」「正式な試算は担当者にご確認ください」を必ず付記する',
    humanGateRequired:   true,
    premiumEstimateNonDefinitivePolicy: true
  },
  {
    guardId:             'ins-004',
    category:            'insurance_sales_dx',
    title:               '既契約情報混同ガード',
    severity:            'critical',
    description:         '既契約情報を誤って別顧客に表示しない。顧客IDと契約IDの照合を必ず行う',
    humanGateRequired:   true,
    existingContractMixupGuard: true
  },
  {
    guardId:             'ins-005',
    category:            'insurance_sales_dx',
    title:               '被保険者・契約者・受取人確認',
    severity:            'critical',
    description:         '被保険者・契約者・受取人の取り違えを防ぐ。複数名が絡む案件は個別に確認する',
    humanGateRequired:   true,
    policyholderInsuredBeneficiaryVerification: true
  },
  {
    guardId:             'ins-006',
    category:            'insurance_sales_dx',
    title:               '引受可否・診査結果非断定',
    severity:            'critical',
    description:         '引受可否・診査結果・告知判断をAIが断定しない。保険会社の正式判断を待つ',
    humanGateRequired:   true
  },
  {
    guardId:             'ins-007',
    category:            'insurance_sales_dx',
    title:               '金融・保険・税務・法務判断人間ゲート',
    severity:            'critical',
    description:         '金融・保険・税務・法務に関わる判断は必ず人間確認ゲートに置く',
    humanGateRequired:   true
  },
  {
    guardId:             'ins-008',
    category:            'insurance_sales_dx',
    title:               '本文 vs PDF分離ポリシー',
    severity:            'high',
    description:         '保障額・保険料・契約詳細はPDF化し本文に平文で出さない。PDF化した場合はパスワード別送ルールを適用する',
    humanGateRequired:   true,
    insurancePdfSeparationPolicy: true
  }
];

function buildCustomerFacingGuard(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const guardId = `customer-facing-guard-${now}`;

  const allGuards = [
    ...GENERAL_OPERATION_GUARDS,
    ...INSURANCE_SPECIFIC_GUARDS
  ];

  const overrideStatuses = opts.overrideStatuses || {};
  const guards = allGuards.map(g => ({
    ...g,
    status: overrideStatuses[g.guardId] || 'pending'
  }));

  const criticalFailed = guards.filter(g => g.severity === 'critical' && g.status === 'failed');
  const overallStatus  = criticalFailed.length > 0 ? 'GUARD_FAILED' : 'PENDING_REVIEW';

  return {
    guardId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    product:               opts.product || 'KOSAME Dev Orchestra',

    operationGuards:       guards,
    insuranceSalesRiskNotes: INSURANCE_SALES_RISK_NOTES,

    // Insurance-specific policy flags (exported for v75 checks)
    disclosureDutyRiskGuard:                  true,
    healthInformationBodyBlock:               true,
    premiumEstimateNonDefinitivePolicy:       true,
    existingContractMixupGuard:               true,
    policyholderInsuredBeneficiaryVerification: true,
    insurancePdfSeparationPolicy:             true,

    overallStatus,
    criticalFailedCount:   criticalFailed.length,
    generatedAt:           new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  GENERAL_OPERATION_GUARDS,
  INSURANCE_SPECIFIC_GUARDS,
  INSURANCE_SALES_RISK_NOTES,
  buildCustomerFacingGuard
};

if (require.main === module) {
  const result = buildCustomerFacingGuard({});
  console.log(JSON.stringify(result, null, 2));
}
