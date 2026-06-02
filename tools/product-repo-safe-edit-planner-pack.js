'use strict';

const TOOL_META = {
  version: '17.5.0',
  title: 'Product Repo Safe Edit Planner',
  slug: 'product-repo-safe-edit-planner-pack'
};

const PRODUCT_REPO_POLICIES = {
  sales_dx: {
    repoName:        'kosame-sales-dx',
    editableAreas:   ['./src/leads/**', './src/components/**', './tests/**', './docs/**'],
    deniedAreas:     ['./.env*', './secrets/**', './config/production.*', './src/auth/**'],
    secretBoundary:  'No API keys, OAuth tokens, or DB credentials may be read or written',
    customerDataBoundary: 'No lead PII (name/email/phone) may be included in code or prompts',
    safeFirstStep:   'Create feature branch spec in docs/ before any src/ edits',
    approvalGates:   ['こさめ/GPT PM approval', 'Claude implementation review', 'じゅんやさん final YES']
  },
  anesty_board: {
    repoName:        'kosame-anesty-board',
    editableAreas:   ['./src/board/**', './src/views/**', './tests/**', './docs/**'],
    deniedAreas:     ['./.env*', './secrets/**', './config/production.*', './src/insurance/**', './src/health/**'],
    secretBoundary:  'No API keys, insurance policy data, or health record data',
    customerDataBoundary: 'No patient/policyholder PII. No health diagnosis data. No insurance amounts.',
    safeFirstStep:   'Review board UI spec doc before any component edits',
    approvalGates:   ['こさめ/GPT PM approval', 'Claude implementation review', 'じゅんやさん final YES']
  },
  backoffice_agent: {
    repoName:        'kosame-backoffice-agent',
    editableAreas:   ['./src/agents/**', './src/handlers/**', './tests/**', './docs/**'],
    deniedAreas:     ['./.env*', './secrets/**', './config/production.*', './src/finance/**'],
    secretBoundary:  'No API keys, financial data, or employee records',
    customerDataBoundary: 'No employee PII, salary, or internal financial data',
    safeFirstStep:   'Define agent capability spec before handler edits',
    approvalGates:   ['こさめ/GPT PM approval', 'Claude implementation review', 'じゅんやさん final YES']
  },
  email_reply_bot: {
    repoName:        'kosame-email-reply-bot',
    editableAreas:   ['./src/bot/**', './src/templates/**', './tests/**', './docs/**'],
    deniedAreas:     ['./.env*', './secrets/**', './config/production.*', './src/credentials/**'],
    secretBoundary:  'No email credentials, SMTP passwords, or API keys',
    customerDataBoundary: 'No real email addresses or personal names in code or templates',
    safeFirstStep:   'Define reply template spec and test with mock emails only',
    approvalGates:   ['こさめ/GPT PM approval', 'Claude implementation review', 'じゅんやさん final YES']
  },
  cloud_run_pm_agent: {
    repoName:        'kosame-dev-orchestra',
    editableAreas:   ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'],
    deniedAreas:     ['./.env*', './secrets/**', './credentials/**', './apps/pm-agent/config/production.*'],
    secretBoundary:  'No GCP service account keys, Cloud Run env vars, or Secret Manager values',
    customerDataBoundary: 'No customer data in any form',
    safeFirstStep:   'Implement in tools/ with dry-run mode, then add smoke test',
    approvalGates:   ['こさめ/GPT PM approval', 'Claude implementation review', 'じゅんやさん final YES']
  }
};

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'read .env', 'read secrets', 'read customer data'
];

function buildVerificationPlan(productType) {
  const base = [
    { step: 'node --check on all edited files', required: true },
    { step: 'npm run verify', required: true },
    { step: 'git status --short', required: true },
    { step: 'git diff --stat HEAD', required: true }
  ];
  const byProduct = {
    sales_dx:  [{ step: 'npm run test:leads', required: false }],
    anesty_board: [{ step: 'npm run test:board', required: false }],
    backoffice_agent: [{ step: 'npm run test:agents', required: false }],
    email_reply_bot:  [{ step: 'npm run test:bot', required: false }],
    cloud_run_pm_agent: [{ step: 'npm run smoke:all (subset)', required: true }]
  };
  return [...base, ...(byProduct[productType] || [])];
}

function buildSafeEditPlan(input) {
  const planId      = `safe-edit-plan-${Date.now()}`;
  const productType = String(input.productType || 'unknown').toLowerCase();
  const taskGoal    = String(input.taskGoal || '(task goal)').trim();

  const policy = PRODUCT_REPO_POLICIES[productType] || {
    repoName:        `kosame-${productType}`,
    editableAreas:   ['./src/**', './docs/**', './tests/**'],
    deniedAreas:     ['./.env*', './secrets/**'],
    secretBoundary:  'No secrets of any kind',
    customerDataBoundary: 'No customer data',
    safeFirstStep:   'Define scope in docs before editing src',
    approvalGates:   ['こさめ/GPT PM approval', 'じゅんやさん final YES']
  };

  const verificationPlan = buildVerificationPlan(productType);
  const isKnownProduct   = !!PRODUCT_REPO_POLICIES[productType];

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    planId,
    productType,
    taskGoal,
    repoPolicy: {
      repoName: policy.repoName,
      approvalGates: policy.approvalGates
    },
    editableAreas:        policy.editableAreas,
    deniedAreas:          policy.deniedAreas,
    secretBoundary:       policy.secretBoundary,
    customerDataBoundary: policy.customerDataBoundary,
    safeFirstStep:        policy.safeFirstStep,
    verificationPlan,
    approvalGates:        policy.approvalGates,
    isKnownProduct,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    noRealRepoEdit: true,
    noRealExecution: true
  };
}

function main() {
  console.log(JSON.stringify(buildSafeEditPlan({
    productType: 'sales_dx',
    taskGoal:    '営業DXリード管理画面にCSVエクスポート機能を追加する'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_REPO_POLICIES,
  DANGEROUS_ACTIONS_DENIED,
  buildSafeEditPlan
};
