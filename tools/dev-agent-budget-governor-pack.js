'use strict';

const TOOL_META = {
  version: '110.1.0',
  title: 'Budget Governor Pack',
  slug: 'dev-agent-budget-governor-pack'
};

const DEFAULT_THRESHOLDS = {
  projectBudgetTargetJpy:      1500,
  projectBudgetHardCapJpy:     2000,
  warningAtPercent:            80,
  lockExpensiveModelsAtPercent: 90,
  requireHumanApprovalAtPercent: 100
};

const MODEL_TIERS = {
  cheap:    ['gemini-flash', 'gemini-pro', 'gpt-3.5-turbo', 'grok-1'],
  standard: ['claude-haiku', 'gpt-4o-mini', 'grok-2'],
  expensive: ['claude-opus', 'claude-sonnet', 'gpt-4o', 'gpt-4-turbo', 'grok-3']
};

// DeepSeek/Kimi excluded from tier system — blocked by Sanitized Handoff Guard
const EXPENSIVE_MODELS = MODEL_TIERS.expensive;

function detectModelTier(modelName) {
  const m = (modelName || '').toLowerCase();
  if (EXPENSIVE_MODELS.some(em => m.includes(em.toLowerCase()))) return 'expensive';
  if (MODEL_TIERS.standard.some(sm => m.includes(sm.toLowerCase()))) return 'standard';
  return 'cheap';
}

function evaluateBudget(input) {
  const {
    spentJpy      = 0,
    thresholds    = DEFAULT_THRESHOLDS,
    requestedModel = '',
    operationLabel = ''
  } = input || {};

  const t         = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const hardCap   = t.projectBudgetHardCapJpy;
  const usedPct   = hardCap > 0 ? Math.round((spentJpy / hardCap) * 100) : 0;
  const modelTier = detectModelTier(requestedModel);
  const isExpensive = modelTier === 'expensive';

  let budgetStatus, recommendedModelTier, escalationAllowed, humanApprovalRequired, approvalMessage;
  const blockedModels = [];

  if (usedPct >= t.requireHumanApprovalAtPercent) {
    budgetStatus          = 'OVER_BUDGET';
    recommendedModelTier  = 'cheap';
    escalationAllowed     = false;
    humanApprovalRequired = true;
    approvalMessage       = `Budget at ${usedPct}% (${spentJpy}JPY / ${hardCap}JPY). All expensive models locked. Human approval required before any escalation.`;
    blockedModels.push(...EXPENSIVE_MODELS);
  } else if (usedPct >= t.lockExpensiveModelsAtPercent) {
    budgetStatus          = 'NEAR_CAP';
    recommendedModelTier  = 'cheap';
    escalationAllowed     = false;
    humanApprovalRequired = true;
    approvalMessage       = `Budget at ${usedPct}% (${spentJpy}JPY / ${hardCap}JPY). Expensive models locked until human approves.`;
    blockedModels.push(...EXPENSIVE_MODELS);
  } else if (usedPct >= t.warningAtPercent) {
    budgetStatus          = 'WARNING';
    recommendedModelTier  = 'standard';
    escalationAllowed     = !isExpensive;
    humanApprovalRequired = isExpensive;
    approvalMessage       = isExpensive
      ? `Budget at ${usedPct}%. Confirm use of expensive model: ${requestedModel}?`
      : `Budget at ${usedPct}%. Prefer cheapest capable route.`;
    if (isExpensive) blockedModels.push(requestedModel);
  } else {
    budgetStatus          = 'OK';
    recommendedModelTier  = modelTier;
    escalationAllowed     = true;
    humanApprovalRequired = isExpensive;
    approvalMessage       = isExpensive
      ? `Confirm escalation to expensive model: ${requestedModel}?`
      : 'Low-cost models recommended and allowed.';
  }

  return {
    tool: TOOL_META.slug,
    version: TOOL_META.version,
    dryRun: true,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    budgetStatus,
    spentJpy,
    hardCapJpy: hardCap,
    usedPercent: usedPct,
    recommendedModelTier,
    escalationAllowed,
    humanApprovalRequired,
    approvalMessage,
    blockedModels,
    fallbackToCheapModels: !escalationAllowed,
    requestedModel,
    operationLabel,
    thresholds: t
  };
}

function main() {
  const result = evaluateBudget({
    spentJpy: 0,
    requestedModel: 'gemini-flash',
    operationLabel: 'bulk-code-review'
  });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DEFAULT_THRESHOLDS,
  MODEL_TIERS,
  EXPENSIVE_MODELS,
  detectModelTier,
  evaluateBudget
};
