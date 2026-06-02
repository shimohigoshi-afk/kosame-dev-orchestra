'use strict';

const TOOL_META = {
  version: '16.5.0',
  title: 'Repo Task Intake Console',
  slug: 'repo-task-intake-console-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const TASK_TYPES = [
  'feature', 'bugfix', 'docs', 'refactor', 'test', 'config', 'release'
];

const REPO_CANDIDATES = {
  sales_dx:          'kosame-sales-dx',
  anesty_board:      'kosame-anesty-board',
  backoffice_agent:  'kosame-backoffice-agent',
  email_reply_bot:   'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
};

const DANGEROUS_ITEMS = [
  'secret', '.env', 'api key', 'customer data', 'personal info',
  'health record', 'insurance', 'individual name', 'password', 'credential'
];

function detectRejectedItems(text) {
  const lower = String(text).toLowerCase();
  return DANGEROUS_ITEMS.filter(item => lower.includes(item));
}

function inferRiskLevel(input) {
  const text = JSON.stringify(input).toLowerCase();
  if (text.includes('deploy') || text.includes('production') || text.includes('release')) return 'high';
  if (text.includes('config') || text.includes('schema') || text.includes('migration')) return 'medium';
  return 'low';
}

function inferDataLevel(input) {
  const text = JSON.stringify(input).toLowerCase();
  if (text.includes('customer') || text.includes('patient') || text.includes('personal')) return 'C';
  if (text.includes('internal') || text.includes('employee')) return 'B';
  return 'A';
}

function buildIntakePacket(input) {
  const intakeId         = `intake-${Date.now()}`;
  const rawRequest       = String(input.rawRequest || input.taskGoal || '(no request)').trim();
  const requestedProduct = String(input.requestedProduct || 'unknown').toLowerCase();
  const taskType         = String(input.taskType || 'feature').toLowerCase();
  const taskGoal         = String(input.taskGoal || rawRequest).trim();
  const expectedOutputs  = input.expectedOutputs || ['implementation packet', 'verification result', 'release candidate'];
  const overrideRisk     = input.riskLevel;
  const overrideData     = input.dataLevel;

  const targetRepoCandidate = REPO_CANDIDATES[requestedProduct] || `kosame-${requestedProduct}-repo`;
  const riskLevel  = overrideRisk || inferRiskLevel(input);
  const dataLevel  = overrideData || inferDataLevel(input);
  const rejectedItems = detectRejectedItems(rawRequest + taskGoal);

  const isKnownProduct = SUPPORTED_PRODUCTS.includes(requestedProduct);
  const isKnownTaskType = TASK_TYPES.includes(taskType);
  const hasNoRejectedItems = rejectedItems.length === 0;

  const intakeValid = isKnownProduct && isKnownTaskType && hasNoRejectedItems && taskGoal.length > 0;

  const recommendedNextAction = (() => {
    if (!hasNoRejectedItems) return `Rejected: request includes sensitive items (${rejectedItems.join(', ')}). Do not proceed.`;
    if (!isKnownProduct)     return `Unknown product "${requestedProduct}". Supported: ${SUPPORTED_PRODUCTS.join(', ')}.`;
    if (intakeValid)         return 'Intake valid. Proceed to Cross-Repo Claude Execution Prompt Builder (v17.0.0).';
    return 'Intake incomplete. Provide taskGoal and requestedProduct.';
  })();

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    intakeId,
    requestedProduct,
    targetRepoCandidate,
    taskGoal,
    taskType,
    riskLevel,
    dataLevel,
    expectedOutputs,
    intakeValid,
    rejectedIfIncludesSecrets: true,
    rejectedItems,
    isKnownProduct,
    isKnownTaskType,
    supportedProducts: SUPPORTED_PRODUCTS,
    supportedTaskTypes: TASK_TYPES,
    recommendedNextAction,
    noRealRepoAccess: true,
    noRealExecution:  true
  };
}

function main() {
  console.log(JSON.stringify(buildIntakePacket({
    rawRequest:       '営業DXのリード管理画面にCSVエクスポート機能を追加したい',
    requestedProduct: 'sales_dx',
    taskType:         'feature',
    taskGoal:         '営業DXリード管理画面にCSVエクスポート機能を追加する',
    expectedOutputs:  ['feature implementation', 'smoke test', 'docs update']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  TASK_TYPES,
  REPO_CANDIDATES,
  buildIntakePacket
};
