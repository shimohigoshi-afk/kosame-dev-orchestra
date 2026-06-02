'use strict';

const TOOL_META = {
  version: '21.5.0',
  title: 'Product Repo Connection Prep Pack',
  slug: 'product-repo-connection-prep-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_PATH_CANDIDATES = {
  sales_dx:          '/home/shimohigoshi/kosame-sales-dx',
  anesty_board:      '/home/shimohigoshi/kosame-anesty-board',
  backoffice_agent:  '/home/shimohigoshi/kosame-backoffice-agent',
  email_reply_bot:   '/home/shimohigoshi/kosame-email-reply-bot',
  cloud_run_pm_agent: '/home/shimohigoshi/kosame-dev-orchestra'
};

const BRANCH_POLICIES = {
  sales_dx:          { defaultBranch: 'main', workBranch: 'feature/<taskId>', requiresPR: true },
  anesty_board:      { defaultBranch: 'main', workBranch: 'feature/<taskId>', requiresPR: true },
  backoffice_agent:  { defaultBranch: 'main', workBranch: 'feature/<taskId>', requiresPR: true },
  email_reply_bot:   { defaultBranch: 'main', workBranch: 'feature/<taskId>', requiresPR: true },
  cloud_run_pm_agent: { defaultBranch: 'main', workBranch: 'feature/<taskId>', requiresPR: false }
};

const SAFE_READ_COMMANDS = [
  'git status --short',
  'git log --oneline -5',
  'git diff --stat HEAD',
  'ls -la',
  'cat README.md',
  'node --check <file>'
];

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean -f',
  'cat .env', 'cat secrets', 'read api key'
];

const SECRET_ENV_POLICIES = {
  sales_dx:          'Do not read .env / secrets / config/production. Never echo or log API keys.',
  anesty_board:      'Do not read .env / secrets. Do not access insurance/health data files.',
  backoffice_agent:  'Do not read .env / secrets. Do not access finance/payroll data files.',
  email_reply_bot:   'Do not read .env / secrets / SMTP config. Never read real email credentials.',
  cloud_run_pm_agent: 'Do not read .env / secrets. Do not access Secret Manager or GCP service account keys.'
};

const CUSTOMER_DATA_POLICIES = {
  sales_dx:          'No lead PII in code, prompts, or logs. Use anonymized fixtures only.',
  anesty_board:      'No patient/policyholder PII. No health records. No insurance amounts. Use mock data only.',
  backoffice_agent:  'No employee PII, salary data, or internal financials. Use mock data only.',
  email_reply_bot:   'No real email addresses or personal names in code or templates. Use test@example.com only.',
  cloud_run_pm_agent: 'No customer data of any kind. All data must be synthetic.'
};

const VERIFICATION_COMMANDS = {
  sales_dx:          ['node --check <editedFile>', 'npm run verify', 'npm test', 'git status --short'],
  anesty_board:      ['node --check <editedFile>', 'npm run verify', 'npm test', 'git status --short'],
  backoffice_agent:  ['node --check <editedFile>', 'npm run verify', 'npm test', 'git status --short'],
  email_reply_bot:   ['node --check <editedFile>', 'npm run verify', 'npm test', 'git status --short'],
  cloud_run_pm_agent: ['node --check <editedFile>', 'npm run verify', 'git status --short']
};

const ROLLBACK_POLICIES = {
  sales_dx:          'git checkout -- <file> for individual files. git reset --hard requires explicit human YES.',
  anesty_board:      'git checkout -- <file> for individual files. git reset --hard requires explicit human YES.',
  backoffice_agent:  'git checkout -- <file> for individual files. git reset --hard requires explicit human YES.',
  email_reply_bot:   'git checkout -- <file> for individual files. git reset --hard requires explicit human YES.',
  cloud_run_pm_agent: 'git checkout -- <file> for individual files. git reset --hard requires explicit human YES.'
};

const HUMAN_APPROVAL_GATES = [
  'こさめ/GPT PM: task scope review before repo access',
  'Claude: implementation and node --check before staging',
  'こさめ/GPT PM: diff review before commit',
  'じゅんやさん: final YES before git add / commit / push / tag'
];

const SAFE_WRITE_ZONES = {
  sales_dx:          ['src/leads/**', 'src/components/**', 'tests/**', 'docs/**'],
  anesty_board:      ['src/board/**', 'src/views/**', 'tests/**', 'docs/**'],
  backoffice_agent:  ['src/agents/**', 'src/handlers/**', 'tests/**', 'docs/**'],
  email_reply_bot:   ['src/bot/**', 'src/templates/**', 'tests/**', 'docs/**'],
  cloud_run_pm_agent: ['tools/**', 'smoke/**', 'fixtures/**', 'docs/ai-dev-team/**']
};

const DENIED_ZONES = {
  sales_dx:          ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/auth/**'],
  anesty_board:      ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/insurance/**', 'src/health/**'],
  backoffice_agent:  ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/finance/**'],
  email_reply_bot:   ['.env*', 'secrets/**', 'credentials/**', 'config/production.*', 'src/credentials/**'],
  cloud_run_pm_agent: ['.env*', 'secrets/**', 'credentials/**', 'apps/pm-agent/config/production.*']
};

function buildConnectionPrepPacket(input) {
  const prepId      = `connection-prep-${Date.now()}`;
  const productType = String(input.productType || 'unknown').toLowerCase();
  const taskId      = String(input.taskId || '(task-id)');

  const isKnownProduct = SUPPORTED_PRODUCTS.includes(productType);

  const repoPathCandidate = input.repoPathCandidate || REPO_PATH_CANDIDATES[productType] || `/home/shimohigoshi/kosame-${productType}`;
  const branchPolicy      = input.branchPolicy      || BRANCH_POLICIES[productType]      || { defaultBranch: 'main', workBranch: `feature/${taskId}`, requiresPR: true };
  const safeWriteZones    = input.safeWriteZones    || SAFE_WRITE_ZONES[productType]    || ['src/**', 'docs/**'];
  const deniedZones       = input.deniedZones       || DENIED_ZONES[productType]       || ['.env*', 'secrets/**'];
  const secretAndEnvPolicy    = input.secretAndEnvPolicy    || SECRET_ENV_POLICIES[productType]    || 'No secrets of any kind';
  const customerDataPolicy    = input.customerDataPolicy    || CUSTOMER_DATA_POLICIES[productType] || 'No customer data';
  const verificationCommands  = input.verificationCommands  || VERIFICATION_COMMANDS[productType]  || ['npm run verify', 'git status --short'];
  const rollbackPolicy        = input.rollbackPolicy        || ROLLBACK_POLICIES[productType]      || 'git checkout -- <file>';

  const repoExistenceCheckPlan = {
    note:     'dry-run only — do not actually execute these commands without human YES',
    commands: [
      `ls ${repoPathCandidate}`,
      `cd ${repoPathCandidate} && git status --short`,
      `cd ${repoPathCandidate} && git log --oneline -3`
    ]
  };

  const notReadyReasons = [];
  if (!isKnownProduct) notReadyReasons.push(`Unknown product: ${productType}`);
  if (!repoPathCandidate) notReadyReasons.push('repoPathCandidate not set');

  const connectionReady = isKnownProduct && notReadyReasons.length === 0;

  const recommendedNextAction = connectionReady
    ? 'Connection prep complete. Proceed to First Product Repo Claude Prompt Exporter (v22.0.0).'
    : `Connection prep incomplete: ${notReadyReasons.join('; ')}. Resolve before proceeding.`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    connectionPrepId:    prepId,
    productType,
    taskId,
    repoPathCandidate,
    repoExistenceCheckPlan,
    branchPolicy,
    safeReadCommands:    SAFE_READ_COMMANDS,
    safeWriteZones,
    deniedZones,
    secretAndEnvPolicy,
    customerDataPolicy,
    verificationCommands,
    rollbackPolicy,
    humanApprovalGates:  HUMAN_APPROVAL_GATES,
    connectionReady,
    notReadyReasons,
    recommendedNextAction,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealRepoAccess:    true,
    noRealExecution:     true
  };
}

function main() {
  console.log(JSON.stringify(buildConnectionPrepPacket({
    productType: 'sales_dx',
    taskId:      'product-task-001'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  DANGEROUS_ACTIONS_DENIED,
  HUMAN_APPROVAL_GATES,
  buildConnectionPrepPacket
};
