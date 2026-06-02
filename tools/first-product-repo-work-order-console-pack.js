'use strict';

const TOOL_META = {
  version: '25.0.0',
  title: 'First Product Repo Work Order Console',
  slug: 'first-product-repo-work-order-console-pack'
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

const COMMANDS_ALLOWED = [
  'node --check <editedFile>',
  'npm run verify (or product equivalent)',
  'npm test (non-destructive only)',
  'git status --short',
  'git diff --stat HEAD',
  'git log --oneline -5',
  'ls -la (read-only)',
  'cat README.md'
];

const COMMANDS_FORBIDDEN = [
  'git add (without explicit じゅんやさん YES)',
  'git commit (without explicit じゅんやさん YES)',
  'git push (without explicit じゅんやさん YES)',
  'git tag (without explicit じゅんやさん YES)',
  'git reset --hard (without explicit じゅんやさん YES)',
  'git clean -f',
  'rm -rf <anything>',
  'deploy / gcloud deploy / docker build / docker push',
  'cat .env / cat .env.* / cat secrets/**',
  'Access Secret Manager or cloud credential stores',
  'node -e (arbitrary eval)',
  'Any command writing to production systems'
];

const PRODUCT_CONTEXTS = {
  sales_dx:
    '営業DX: リード管理・営業活動支援プロダクト。リードPIIはコード・ログ・promptに含めない。',
  anesty_board:
    'ANESTY Board: 保険・健康管理プロダクト。被保険者PII・保険証券データ・健診情報は絶対に含めない。',
  backoffice_agent:
    'BackOffice Agent: 社内業務自動化エージェント。従業員PII・給与・内部財務データは含めない。',
  email_reply_bot:
    'Email Reply BOT: メール自動返信ボット。実メールアドレス・個人名はコード・テンプレートに含めない。',
  cloud_run_pm_agent:
    'Cloud Run PM Agent: KOSAME Dev Orchestra PM agent。GCPキー・Secret Manager値・顧客データは含めない。'
};

const REPORT_FORMAT_SPEC = {
  format:         'JSON packet',
  requiredFields: [
    'editedFiles',
    'diffSummary',
    'nodeCheckResult',
    'verifyResult',
    'smokeResult',
    'remainingRisks',
    'rollbackNote',
    'gitStatusOutput'
  ],
  instruction: 'Stop at commit candidate. Return JSON report. Do NOT git add / commit / push without explicit じゅんやさん YES.',
  handoffTarget: 'First Product Repo Handoff & Result Import Pack (v26.0.0)'
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add (automated)',
  'git commit (automated)',
  'git push (automated)',
  'git tag (automated)',
  'deploy (any form)',
  'gcloud deploy',
  'docker build',
  'rm -rf',
  'git reset --hard',
  'git clean -f',
  'read .env or secrets',
  'access customer PII',
  'access insurance / health / financial records'
];

function buildExpectedDeliverables(productType, taskGoal) {
  const base = [
    'JSON report packet with editedFiles, diffSummary, nodeCheckResult, verifyResult',
    'smokeResult and remainingRisks',
    'rollbackNote and gitStatusOutput',
    'NO git add / commit / push / tag'
  ];
  const byProduct = {
    sales_dx:          [`Updated files in src/leads/ or src/components/`, 'Updated tests in tests/'],
    anesty_board:      [`Updated files in src/board/ or src/views/ — NO insurance/health data`, 'Updated tests'],
    backoffice_agent:  [`Updated files in src/agents/ or src/handlers/`, 'Updated tests'],
    email_reply_bot:   [`Updated files in src/bot/ or src/templates/ — using mock emails only`, 'Updated tests'],
    cloud_run_pm_agent: [`New or updated tools/*.js`, `New or updated smoke/*.js`, `New or updated fixtures/*.json`, 'Updated docs/ai-dev-team/*.md']
  };
  return [...(byProduct[productType] || ['Updated files in allowed zones']), ...base];
}

function buildRollbackInstruction(productType, repoCandidate) {
  return [
    `git checkout -- <file> for each changed file in ${repoCandidate}`,
    'git reset --hard HEAD requires explicit じゅんやさん YES',
    `git branch -d feature/<taskId> requires explicit じゅんやさん YES`,
    'No automated rollback — human decision required'
  ].join('\n');
}

function buildWorkOrder(input) {
  const workOrderId   = `work-order-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const taskTitle     = String(input.taskTitle   || input.taskGoal || '(task title)').trim();
  const taskGoal      = String(input.taskGoal    || '(task goal)').trim();
  const businessContext    = String(input.businessContext    || '').trim();
  const productContext     = input.productContext     || PRODUCT_CONTEXTS[targetProduct]   || '(product context)';
  const userIntent         = String(input.userIntent         || taskGoal).trim();
  const implementationScope = String(input.implementationScope || taskGoal).trim();

  const isKnownProduct     = SUPPORTED_PRODUCTS.includes(targetProduct);
  const targetRepoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;
  const filesAllowedToTouch   = input.filesAllowedToTouch   || ALLOWED_FILE_ZONES[targetProduct]  || ['src/**', 'docs/**'];
  const filesForbiddenToTouch = input.filesForbiddenToTouch || DENIED_FILE_ZONES[targetProduct]   || ['.env*', 'secrets/**'];
  const verificationCommands  = input.verificationCommands  || COMMANDS_ALLOWED.slice(0, 5);
  const expectedDeliverables  = input.expectedDeliverables  || buildExpectedDeliverables(targetProduct, taskGoal);
  const rollbackInstruction   = input.rollbackInstruction   || buildRollbackInstruction(targetProduct, targetRepoCandidate);

  const notReadyReasons = [];
  if (!isKnownProduct)               notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (!taskGoal || taskGoal === '(task goal)') notReadyReasons.push('taskGoal is required');
  if (!businessContext)              notReadyReasons.push('businessContext is required');

  const workOrderReady = notReadyReasons.length === 0;

  const recommendedNextAction = workOrderReady
    ? 'Work order ready. Proceed to External Repo Preflight Command Pack (v25.5.0).'
    : `Work order not ready. Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    workOrderId,
    targetProduct,
    targetRepoCandidate,
    taskTitle,
    taskGoal,
    businessContext,
    productContext,
    userIntent,
    implementationScope,
    filesAllowedToTouch,
    filesForbiddenToTouch,
    commandsAllowed:     COMMANDS_ALLOWED,
    commandsForbidden:   COMMANDS_FORBIDDEN,
    verificationCommands,
    expectedDeliverables,
    reportFormat:        REPORT_FORMAT_SPEC,
    rollbackInstruction,
    isKnownProduct,
    workOrderReady,
    notReadyReasons,
    recommendedNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealRepoEdit:      true,
    noRealExecution:     true
  };
}

function main() {
  console.log(JSON.stringify(buildWorkOrder({
    targetProduct:      'sales_dx',
    taskTitle:          'メール一括返信機能の追加',
    taskGoal:           '営業DXにリード向けメール一括返信機能を追加する',
    businessContext:    '営業担当者が複数リードへ一括フォローアップメールを送れるようにする',
    userIntent:         'src/leads/bulk-email-reply.js を新規作成してUIに接続する',
    implementationScope: 'src/leads/bulk-email-reply.js と tests/leads/bulk-email-reply.test.js を新規作成'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  COMMANDS_ALLOWED,
  COMMANDS_FORBIDDEN,
  DANGEROUS_ACTIONS_DENIED,
  REPORT_FORMAT_SPEC,
  buildWorkOrder
};
