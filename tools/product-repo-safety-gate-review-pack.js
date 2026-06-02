'use strict';

const TOOL_META = {
  version: '23.5.0',
  title: 'Product Repo Safety Gate Review Pack',
  slug: 'product-repo-safety-gate-review-pack'
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

const FINAL_DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const ALLOWED_ACTIONS = [
  'Read src files in allowed zones (dry-run)',
  'Run node --check on edited files',
  'Run npm run verify (non-destructive)',
  'Run git status --short',
  'Run git diff --stat HEAD',
  'Generate dry-run packet',
  'Export Claude prompt (no execution)'
];

const BLOCKED_ACTIONS = [
  'git add (without human YES)',
  'git commit (without human YES)',
  'git push (without human YES)',
  'git tag (without human YES)',
  'deploy / gcloud deploy / docker build',
  'rm -rf / git reset --hard / git clean -f',
  'Read .env / secrets / credentials',
  'Access customer PII / insurance data / health records / financial data',
  'Run arbitrary shell commands without human review'
];

const HUMAN_APPROVAL_GATES = [
  'こさめ/GPT PM: task scope and safety review before dispatch',
  'Claude: implementation + node --check before staging any file',
  'こさめ/GPT PM: diff review and verification result review before commit',
  'じゅんやさん: explicit final YES before git add / commit / push / tag / deploy'
];

const SECRET_BOUNDARY_SPECS = {
  sales_dx:          { rule: 'No API keys, OAuth tokens, DB credentials', files: ['.env*', 'secrets/**', 'credentials/**'] },
  anesty_board:      { rule: 'No API keys, insurance policy data, health records, patient info', files: ['.env*', 'secrets/**', 'src/insurance/**', 'src/health/**'] },
  backoffice_agent:  { rule: 'No API keys, employee records, financial data, payroll info', files: ['.env*', 'secrets/**', 'src/finance/**'] },
  email_reply_bot:   { rule: 'No email credentials, SMTP passwords, API keys', files: ['.env*', 'secrets/**', 'src/credentials/**'] },
  cloud_run_pm_agent: { rule: 'No GCP service account keys, Cloud Run env vars, Secret Manager values', files: ['.env*', 'secrets/**', 'credentials/**'] }
};

const CUSTOMER_DATA_BOUNDARY_SPECS = {
  sales_dx:          { rule: 'No lead PII (name/email/phone/address) in code, prompts, or logs', mock: 'Use anonymized/synthetic fixtures only' },
  anesty_board:      { rule: 'No policyholder/patient PII, health records, insurance amounts', mock: 'Use mock data — never real patient/policyholder data' },
  backoffice_agent:  { rule: 'No employee PII, salary, internal financials', mock: 'Use mock employee data only' },
  email_reply_bot:   { rule: 'No real email addresses or personal names in code or templates', mock: 'Use test@example.com and "Sample User" only' },
  cloud_run_pm_agent: { rule: 'No customer data of any form', mock: 'All data must be synthetic' }
};

const REGULATED_DATA_BOUNDARY_SPECS = {
  sales_dx:          { applicable: false, note: 'No regulated data (insurance/health/financial) applies' },
  anesty_board:      { applicable: true, note: 'REGULATED: Insurance policy data and health/medical records STRICTLY prohibited. Any access requires legal review.', categories: ['insurance policy data', 'health/medical records', 'patient PII'] },
  backoffice_agent:  { applicable: true, note: 'REGULATED: Employee financial records and HR data require special handling.', categories: ['employee salary', 'HR records', 'internal financials'] },
  email_reply_bot:   { applicable: false, note: 'No regulated data applies. Use mock email data only.' },
  cloud_run_pm_agent: { applicable: false, note: 'No regulated data applies.' }
};

const DEPLOY_RISK_SPECS = {
  sales_dx:          { riskLevel: 'medium', note: 'Staging required before production. No auto-deploy.' },
  anesty_board:      { riskLevel: 'high',   note: 'HIGH RISK: Insurance/health data involved. Full security review required before any deploy.' },
  backoffice_agent:  { riskLevel: 'high',   note: 'HIGH RISK: Employee/financial data involved. Security review required.' },
  email_reply_bot:   { riskLevel: 'medium', note: 'Email credential risk. Test with mock emails before any deploy.' },
  cloud_run_pm_agent: { riskLevel: 'low',   note: 'Internal tooling. Standard review applies.' }
};

const GIT_OP_RISK_SPECS = {
  requiresHumanYes: ['git add', 'git commit', 'git push', 'git tag', 'git reset --hard', 'git clean -f'],
  autoApproved:     ['git status --short', 'git log --oneline -5', 'git diff --stat HEAD'],
  note: 'No git write operations are auto-approved. All require explicit じゅんやさん YES.'
};

function buildSafetyChecklist(productType, input) {
  const regSpec    = REGULATED_DATA_BOUNDARY_SPECS[productType] || { applicable: false };
  const deploySpec = DEPLOY_RISK_SPECS[productType] || { riskLevel: 'medium' };
  return {
    'dryRun is true':                       input.dryRun === true,
    'humanApprovalRequired':                input.humanApprovalRequired === true,
    'targetProduct is known':               SUPPORTED_PRODUCTS.includes(productType),
    'secret boundary defined':              !!SECRET_BOUNDARY_SPECS[productType],
    'customer data boundary defined':       !!CUSTOMER_DATA_BOUNDARY_SPECS[productType],
    'regulated data boundary reviewed':     !regSpec.applicable || (input.regulatedDataAcknowledged === true),
    'deploy risk acknowledged':             deploySpec.riskLevel !== 'high' || (input.deployRiskAcknowledged === true),
    'git ops require human YES':            true,
    'no auto-deploy':                       true,
    'dangerousActionsDenied present':       Array.isArray(input.dangerousActionsDenied) && input.dangerousActionsDenied.length > 0,
    'allowedFileZones present':             Array.isArray(input.allowedFileZones) && input.allowedFileZones.length > 0,
    'deniedFileZones present':              Array.isArray(input.deniedFileZones) && input.deniedFileZones.length > 0,
    'rollbackPlan present':                 !!input.rollbackPlan
  };
}

function collectBlockers(checklist) {
  return Object.entries(checklist).filter(([, v]) => !v).map(([k]) => k);
}

function determineFinalDecision(blockers, productType) {
  if (blockers.length > 3)   return 'reject';
  if (blockers.length > 0)   return 'hold';
  const deploy = DEPLOY_RISK_SPECS[productType];
  if (deploy && deploy.riskLevel === 'high') return 'hold';
  return 'approve';
}

function buildSafetyGateReview(input) {
  const reviewId      = `safety-gate-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const dispatchPlan  = input.dispatchPlan || {};

  const targetRepoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const mergedInput = {
    dryRun:                 true,
    humanApprovalRequired:  true,
    allowedFileZones:       input.allowedFileZones  || dispatchPlan.allowedFileZones  || [],
    deniedFileZones:        input.deniedFileZones   || dispatchPlan.deniedFileZones   || [],
    dangerousActionsDenied: input.dangerousActionsDenied || dispatchPlan.dangerousActionsDenied || [],
    rollbackPlan:           input.rollbackPlan      || dispatchPlan.rollbackPlan      || null,
    regulatedDataAcknowledged: input.regulatedDataAcknowledged || false,
    deployRiskAcknowledged:    input.deployRiskAcknowledged    || false
  };

  const safetyChecklist     = buildSafetyChecklist(targetProduct, mergedInput);
  const blockerItems        = collectBlockers(safetyChecklist);
  const safetyGatePassed    = blockerItems.length === 0;
  const overrideDecision    = input.overrideDecision;
  const finalDecision       = overrideDecision || determineFinalDecision(blockerItems, targetProduct);

  const recommendedNextAction = safetyGatePassed && finalDecision === 'approve'
    ? 'Safety gate passed. Proceed to First Real Product Repo Execution Prompt Pack (v24.0.0).'
    : `Safety gate not cleared. Resolve blockers (${blockerItems.length}): ${blockerItems.slice(0, 2).join(', ')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    safetyGateReviewId:  reviewId,
    targetProduct,
    targetRepoCandidate,
    safetyChecklist,
    secretBoundaryReview:       SECRET_BOUNDARY_SPECS[targetProduct]         || { rule: 'No secrets of any kind', files: [] },
    customerDataBoundaryReview: CUSTOMER_DATA_BOUNDARY_SPECS[targetProduct]  || { rule: 'No customer data', mock: 'Synthetic data only' },
    regulatedDataBoundaryReview: REGULATED_DATA_BOUNDARY_SPECS[targetProduct] || { applicable: false, note: 'No regulated data' },
    deployRiskReview:           DEPLOY_RISK_SPECS[targetProduct]             || { riskLevel: 'medium', note: 'Standard review applies' },
    gitOperationReview:         GIT_OP_RISK_SPECS,
    allowedActions:             ALLOWED_ACTIONS,
    blockedActions:             BLOCKED_ACTIONS,
    humanApprovalGates:         HUMAN_APPROVAL_GATES,
    safetyGatePassed,
    blockerItems,
    finalDecision,
    finalDecisionOptions:       FINAL_DECISION_OPTIONS,
    recommendedNextAction,
    noRealRepoAccess:    true,
    noRealExecution:     true
  };
}

function main() {
  const { buildDispatchPlan } = require('./first-real-product-repo-dispatch-plan-pack');
  const dispatchPlan = buildDispatchPlan({
    targetProduct:   'sales_dx',
    taskTitle:       'メール一括返信機能の追加',
    taskGoal:        '営業DXにリード向けメール一括返信機能を追加する',
    businessContext: '営業担当者が複数リードへ一括フォローアップメールを送れるようにする'
  });
  console.log(JSON.stringify(buildSafetyGateReview({
    targetProduct: 'sales_dx',
    dispatchPlan
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  FINAL_DECISION_OPTIONS,
  ALLOWED_ACTIONS,
  BLOCKED_ACTIONS,
  HUMAN_APPROVAL_GATES,
  buildSafetyGateReview
};
