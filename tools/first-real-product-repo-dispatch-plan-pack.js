'use strict';

const TOOL_META = {
  version: '23.0.0',
  title: 'First Real Product Repo Dispatch Plan',
  slug: 'first-real-product-repo-dispatch-plan-pack'
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
  sales_dx:          ['src/leads/**', 'src/components/**', 'tests/**', 'docs/**'],
  anesty_board:      ['src/board/**', 'src/views/**', 'tests/**', 'docs/**'],
  backoffice_agent:  ['src/agents/**', 'src/handlers/**', 'tests/**', 'docs/**'],
  email_reply_bot:   ['src/bot/**', 'src/templates/**', 'tests/**', 'docs/**'],
  cloud_run_pm_agent: ['tools/**', 'smoke/**', 'fixtures/**', 'docs/ai-dev-team/**']
};

const DENIED_FILE_ZONES = {
  sales_dx:          ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/auth/**'],
  anesty_board:      ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/insurance/**', 'src/health/**'],
  backoffice_agent:  ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/finance/**'],
  email_reply_bot:   ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/credentials/**'],
  cloud_run_pm_agent: ['.env*', 'secrets/**', 'credentials/**', 'apps/pm-agent/config/production.*']
};

const RECOMMENDED_PROVIDERS = {
  sales_dx:          'Claude (implementation)',
  anesty_board:      'Claude (implementation) + Grok (safety review)',
  backoffice_agent:  'Claude (implementation)',
  email_reply_bot:   'Claude (implementation) + Gemini (template draft)',
  cloud_run_pm_agent: 'Claude (implementation)'
};

const DISPATCH_ORDERS = {
  sales_dx: [
    { step: 1, action: 'Product Repo Connection Prep (v21.5.0)', provider: 'Claude/こさめ', required: true },
    { step: 2, action: 'Safety Gate Review (v23.5.0)',            provider: 'こさめ/GPT',    required: true },
    { step: 3, action: 'Execution Prompt Export (v24.0.0)',       provider: 'Claude',        required: true },
    { step: 4, action: 'Human final YES — じゅんやさん',          provider: 'Human',         required: true },
    { step: 5, action: 'Claude executes in product repo',         provider: 'Claude',        required: true },
    { step: 6, action: 'Verification & Handoff Collector',        provider: 'Claude/こさめ', required: true },
    { step: 7, action: 'Release Candidate Packet Builder',        provider: 'こさめ/GPT',    required: true }
  ]
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
  'read .env or .env.*',
  'read secrets/**',
  'access customer PII',
  'access insurance / health / financial records'
];

const REQUIRED_INPUTS = [
  'taskGoal',
  'targetProduct',
  'taskTitle',
  'businessContext',
  'allowedFileZones',
  'deniedFileZones'
];

function buildVerificationPlan(productType) {
  return {
    steps: [
      { step: 'node --check on all edited files', required: true },
      { step: 'npm run verify (or product equivalent)', required: true },
      { step: 'git status --short', required: true },
      { step: 'git diff --stat HEAD', required: true }
    ],
    productSpecific: productType === 'cloud_run_pm_agent'
      ? ['npm run smoke:all (subset)']
      : [`npm run test (${productType})`]
  };
}

function buildRollbackPlan(productType, targetRepo) {
  return {
    fileLevel:   'git checkout -- <file> for each changed file',
    repoLevel:   'git reset --hard HEAD requires explicit じゅんやさん YES',
    branchLevel: `Delete work branch: git branch -d feature/<taskId> (requires じゅんやさん YES)`,
    note:        `No automated rollback. Human decision required for any hard reset in ${targetRepo}.`
  };
}

function collectMissingInputs(input) {
  return REQUIRED_INPUTS.filter(key => !input[key] || String(input[key]).trim() === '');
}

function buildDispatchPlan(input) {
  const planId        = `dispatch-plan-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const taskTitle     = String(input.taskTitle  || input.taskGoal || '(task title)').trim();
  const taskGoal      = String(input.taskGoal   || '(task goal)').trim();
  const businessContext = String(input.businessContext || '').trim();
  const priority      = String(input.priority   || 'medium');

  const isKnownProduct      = SUPPORTED_PRODUCTS.includes(targetProduct);
  const targetRepoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;
  const allowedFileZones    = input.allowedFileZones || ALLOWED_FILE_ZONES[targetProduct] || ['src/**', 'docs/**'];
  const deniedFileZones     = input.deniedFileZones  || DENIED_FILE_ZONES[targetProduct]  || ['.env*', 'secrets/**'];
  const recommendedProvider = input.recommendedProvider || RECOMMENDED_PROVIDERS[targetProduct] || 'Claude';
  const dispatchOrder       = DISPATCH_ORDERS[targetProduct] || DISPATCH_ORDERS.sales_dx;

  const missingInputs = collectMissingInputs({ taskGoal, targetProduct, taskTitle, businessContext, allowedFileZones, deniedFileZones });
  const requiredInputs = REQUIRED_INPUTS;

  const verificationPlan = buildVerificationPlan(targetProduct);
  const rollbackPlan     = buildRollbackPlan(targetProduct, targetRepoCandidate);

  const notReadyReasons = [];
  if (!isKnownProduct)          notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (missingInputs.length > 0) notReadyReasons.push(`Missing required inputs: ${missingInputs.join(', ')}`);

  const dispatchReady = isKnownProduct && missingInputs.length === 0;

  const recommendedNextAction = dispatchReady
    ? 'Dispatch plan ready. Proceed to Product Repo Safety Gate Review (v23.5.0).'
    : `Dispatch plan not ready. Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    dispatchPlanId:      planId,
    targetProduct,
    targetRepoCandidate,
    taskTitle,
    taskGoal,
    businessContext,
    priority,
    recommendedProvider,
    dispatchOrder,
    requiredInputs,
    missingInputs,
    allowedFileZones,
    deniedFileZones,
    verificationPlan,
    rollbackPlan,
    isKnownProduct,
    dispatchReady,
    notReadyReasons,
    recommendedNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealRepoAccess:    true,
    noRealExecution:     true
  };
}

function main() {
  console.log(JSON.stringify(buildDispatchPlan({
    targetProduct:   'sales_dx',
    taskTitle:       'メール一括返信機能の追加',
    taskGoal:        '営業DXにリード向けメール一括返信機能を追加する',
    businessContext: '営業担当者が複数リードへ一括フォローアップメールを送れるようにする',
    priority:        'high'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  REQUIRED_INPUTS,
  buildDispatchPlan
};
