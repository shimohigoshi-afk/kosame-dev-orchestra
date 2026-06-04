'use strict';

const TOOL_META = {
  version: '93.0.0',
  title:   'KOSAME Dev Orchestra BackOffice Agent MVP Launch Plan Pack',
  slug:    'dev-agent-backoffice-agent-mvp-launch-plan-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read', '.env read', 'api key read',
  'customer data read', 'insurance data read',
  'deploy', 'git add/commit/push/tag',
  'destructive delete', 'external repo mutation',
  'real send', 'real contract execution',
  'real billing', 'real legal judgment',
  'real tax judgment', 'real labor judgment'
];

const ALLOWED_OPERATIONS = [
  '問い合わせ分類・ルーティング (テキスト入力)',
  '定型業務テンプレート生成 (下書きのみ)',
  '経費申請の形式チェック (提出前の確認サポート)',
  '契約書レビュー補助 (要点抽出のみ・法的判断なし)',
  'タスク優先度分類・整理',
  'FAQ自動応答下書き生成'
];

const FORBIDDEN_OPERATIONS = [
  '税務判断 — AIが税務上の判断を断定しない',
  '法務判断 — 契約の法的有効性・リスクをAIが断定しない',
  '労務判断 — 労働法・就業規則の解釈をAIが断定しない',
  '実送信 — メール・FAX・郵便の実送信はしない',
  '実契約締結 — 電子署名・契約確定はしない',
  '実請求 — 請求書発行・決済処理はしない',
  '実給与計算 — 給与・賞与の確定計算はしない'
];

const HUMAN_APPROVAL_OPERATIONS = [
  '税務・法務・労務に関わる最終判断',
  '契約書への署名・締結',
  '請求書の送付・決済処理',
  '個人情報・財務情報へのアクセス',
  '外部機関 (税務署・労働基準監督署等) への提出'
];

function buildBackofficeAgentMvpLaunchPlan(opts) {
  opts = opts || {};
  const now    = opts.timestamp || Date.now();
  const planId = `backoffice-agent-mvp-launch-plan-${now}`;

  return {
    backofficeAgentMvpLaunchPlanId: planId,
    version:               TOOL_META.version,
    title:                 TOOL_META.title,
    dryRun:                true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    product:     'BackOffice Agent',
    productType: 'backoffice_agent',

    mvpScope: opts.mvpScope || [
      '問い合わせ分類・優先度付け',
      '定型回答下書き生成 (Human確認後に送信)',
      '経費申請フォーム形式チェック補助'
    ],

    allowedOperations:      ALLOWED_OPERATIONS,
    forbiddenOperations:    FORBIDDEN_OPERATIONS,
    humanApprovalOperations: HUMAN_APPROVAL_OPERATIONS,

    dataBoundary: opts.dataBoundary || {
      financialData: 'HUMAN_GATE — 財務データへのアクセスはじゅんやさんYES必須',
      personalInfo:  'RESTRICTED — 氏名・住所・マイナンバー等は最小限アクセスのみ',
      contracts:     'READ_ONLY_DRAFT — 契約書は参照・要点抽出のみ。締結はしない',
      taxDocuments:  'HUMAN_GATE — 税務書類は人間確認後にのみ処理'
    },

    firstPilotTask: opts.firstPilotTask || {
      task:        '問い合わせメール自動分類 + 担当者割り振り候補提示',
      scope:       '分類と提案のみ。実送信・実割り振りは担当者が実行',
      humanReview: true,
      riskLevel:   'low'
    },

    launchBlockers: opts.launchBlockers || [
      'Guardian Class (v70) 未通過',
      '法務・税務判断ポリシー 未確定 — 外部法務確認推奨',
      '個人情報取り扱い規程 未整備'
    ],

    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  ALLOWED_OPERATIONS,
  FORBIDDEN_OPERATIONS,
  HUMAN_APPROVAL_OPERATIONS,
  buildBackofficeAgentMvpLaunchPlan
};

if (require.main === module) {
  console.log(JSON.stringify(buildBackofficeAgentMvpLaunchPlan({}), null, 2));
}
