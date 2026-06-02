'use strict';

const TOOL_META = {
  version: '21.0.0',
  title: 'First Product Repo Task Packet',
  slug: 'first-product-repo-task-packet-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_CANDIDATES = {
  sales_dx:          'kosame-sales-dx',
  anesty_board:      'kosame-anesty-board',
  backoffice_agent:  'kosame-backoffice-agent',
  email_reply_bot:   'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
};

const ALLOWED_FILE_ZONES = {
  sales_dx:          ['src/leads/**', 'src/components/**', 'tests/**', 'docs/**', 'README.md'],
  anesty_board:      ['src/board/**', 'src/views/**', 'tests/**', 'docs/**', 'README.md'],
  backoffice_agent:  ['src/agents/**', 'src/handlers/**', 'tests/**', 'docs/**', 'README.md'],
  email_reply_bot:   ['src/bot/**', 'src/templates/**', 'tests/**', 'docs/**', 'README.md'],
  cloud_run_pm_agent: ['tools/**', 'smoke/**', 'fixtures/**', 'docs/ai-dev-team/**', 'README.md']
};

const DENIED_FILE_ZONES = {
  sales_dx:          ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/auth/**'],
  anesty_board:      ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/insurance/**', 'src/health/**'],
  backoffice_agent:  ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/finance/**'],
  email_reply_bot:   ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/credentials/**'],
  cloud_run_pm_agent: ['.env*', 'secrets/**', 'credentials/**', 'apps/pm-agent/config/production.*']
};

const DATA_BOUNDARIES = {
  sales_dx:          'リードPII (name/email/phone) はコードやpromptに含めない',
  anesty_board:      '被保険者/患者PII・健康診断データ・保険金額は絶対に含めない',
  backoffice_agent:  '従業員PII・給与・内部財務データは含めない',
  email_reply_bot:   '実メールアドレス・個人名はコードやテンプレートに含めない',
  cloud_run_pm_agent: '顧客データは一切含めない'
};

const SECRET_BOUNDARIES = {
  sales_dx:          'API key / OAuth token / DB credentials は読み書きしない',
  anesty_board:      'API key / 保険証券データ / 健診情報は読み書きしない',
  backoffice_agent:  'API key / 財務データ / 従業員記録は読み書きしない',
  email_reply_bot:   'メール認証情報 / SMTP password / API key は読み書きしない',
  cloud_run_pm_agent: 'GCP service account key / Cloud Run env vars / Secret Manager値は読み書きしない'
};

const RECOMMENDED_PROVIDERS = {
  sales_dx:          'Claude (implementation) + こさめ/GPT (PM review)',
  anesty_board:      'Claude (implementation) + こさめ/GPT (PM review) + Grok (safety review)',
  backoffice_agent:  'Claude (implementation) + こさめ/GPT (PM review)',
  email_reply_bot:   'Claude (implementation) + Gemini (template draft) + こさめ/GPT (PM review)',
  cloud_run_pm_agent: 'Claude (implementation) + こさめ/GPT (PM review)'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'read .env', 'read secrets', 'read api key',
  'access customer data', 'access personal info',
  'access insurance data', 'access health data'
];

function buildClaudeTaskDraft(productType, taskGoal, allowedZones, deniedZones) {
  return [
    `# Claude Task Draft — ${productType}`,
    `## Task Goal`,
    taskGoal,
    `## Allowed File Zones`,
    allowedZones.map(z => `- ${z}`).join('\n'),
    `## Denied File Zones`,
    deniedZones.map(z => `- ${z}`).join('\n'),
    `## Forbidden Actions`,
    DANGEROUS_ACTIONS_DENIED.map(a => `- ${a}`).join('\n'),
    `## Safety`,
    '- dryRun: true (no real edits without human YES)',
    '- humanApprovalRequired: true',
    '- No git add / commit / push / tag without explicit じゅんやさん YES'
  ].join('\n\n');
}

function buildVerificationPlan(productType) {
  return {
    steps: [
      { step: 'node --check on all edited files', required: true },
      { step: 'npm run verify (or equivalent)', required: true },
      { step: 'git status --short', required: true },
      { step: 'git diff --stat HEAD', required: true }
    ],
    note: `Verification must pass before proceeding to release candidate for ${productType}`
  };
}

function buildTaskPacket(input) {
  const taskId         = `product-task-${Date.now()}`;
  const requestedProduct = String(input.requestedProduct || 'unknown').toLowerCase();
  const taskTitle      = String(input.taskTitle || input.taskGoal || '(task title)').trim();
  const taskGoal       = String(input.taskGoal || '(task goal)').trim();
  const businessContext = String(input.businessContext || '(business context)').trim();
  const implementationIntent = String(input.implementationIntent || taskGoal).trim();
  const expectedOutputs = input.expectedOutputs || [
    'implementation in allowed file zones',
    'test files updated',
    'docs updated',
    'verification result'
  ];

  const targetRepoCandidate = REPO_CANDIDATES[requestedProduct] || `kosame-${requestedProduct}`;
  const allowedFileZones    = input.allowedFileZones  || ALLOWED_FILE_ZONES[requestedProduct]  || ['src/**', 'docs/**'];
  const deniedFileZones     = input.deniedFileZones   || DENIED_FILE_ZONES[requestedProduct]   || ['.env*', 'secrets/**'];
  const dataBoundary        = input.dataBoundary      || DATA_BOUNDARIES[requestedProduct]     || 'No customer data';
  const secretBoundary      = input.secretBoundary    || SECRET_BOUNDARIES[requestedProduct]   || 'No secrets of any kind';
  const recommendedProvider = input.recommendedProvider || RECOMMENDED_PROVIDERS[requestedProduct] || 'Claude + こさめ/GPT';

  const isKnownProduct = SUPPORTED_PRODUCTS.includes(requestedProduct);
  const claudeTaskDraft = buildClaudeTaskDraft(requestedProduct, taskGoal, allowedFileZones, deniedFileZones);
  const verificationPlan = buildVerificationPlan(requestedProduct);

  const recommendedNextAction = isKnownProduct
    ? 'Task packet ready. Proceed to Product Repo Connection Prep Pack (v21.5.0) before sending to Claude.'
    : `Unknown product "${requestedProduct}". Supported: ${SUPPORTED_PRODUCTS.join(', ')}.`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    productRepoTaskId:   taskId,
    requestedProduct,
    targetRepoCandidate,
    taskTitle,
    taskGoal,
    businessContext,
    implementationIntent,
    allowedFileZones,
    deniedFileZones,
    dataBoundary,
    secretBoundary,
    expectedOutputs,
    recommendedProvider,
    claudeTaskDraft,
    verificationPlan,
    isKnownProduct,
    supportedProducts:   SUPPORTED_PRODUCTS,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealRepoEdit:      true,
    noRealExecution:     true
  };
}

function main() {
  console.log(JSON.stringify(buildTaskPacket({
    requestedProduct:    'sales_dx',
    taskTitle:           'メール返信機能の追加',
    taskGoal:            '営業DXにリード向けメール一括返信機能を追加する',
    businessContext:     '営業担当者が複数リードへ一括でフォローアップメールを送れるようにする',
    implementationIntent: 'src/leads/bulk-email-reply.js を新規作成し、UI コンポーネントに接続する',
    expectedOutputs:     ['src/leads/bulk-email-reply.js', 'tests/leads/bulk-email-reply.test.js', 'docs更新']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  buildTaskPacket
};
