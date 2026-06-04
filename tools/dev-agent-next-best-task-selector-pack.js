'use strict';

const TOOL_META = {
  version: '86.0.0',
  title: 'KOSAME Dev Orchestra Next Best Task Selector Pack',
  slug: 'dev-agent-next-best-task-selector-pack'
};

const ROUTES = {
  CLAUDE_CODE: 'CLAUDE_CODE',
  GPT_AGENT: 'GPT_AGENT',
  GEMINI_REVIEW: 'GEMINI_REVIEW',
  GROK_REVIEW: 'GROK_REVIEW',
  HUMAN_APPROVAL: 'HUMAN_APPROVAL',
  EXTERNAL_SE_REVIEW: 'EXTERNAL_SE_REVIEW',
  HOLD: 'HOLD'
};

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'api key read',
  'customer data read',
  'insurance data read',
  'deploy',
  'git add/commit/push/tag',
  'destructive delete',
  'external repo mutation'
];

function routeTask(task = {}) {
  const flags = task.flags || {};
  const type = task.type || 'docs_update';

  if (flags.secret || flags.deploy || flags.customerData || flags.insuranceData) {
    return flags.highRisk ? ROUTES.HOLD : ROUTES.HUMAN_APPROVAL;
  }

  if (flags.externalReviewRequired || flags.productionImpact) return ROUTES.EXTERNAL_SE_REVIEW;
  if (type === 'pm_design' || type === 'acceptance_gate' || type === 'prompt_generation') return ROUTES.GPT_AGENT;
  if (type === 'long_text_review') return ROUTES.GEMINI_REVIEW;
  if (type === 'breakthrough_proposal') return ROUTES.GROK_REVIEW;
  return ROUTES.CLAUDE_CODE;
}

function buildNextBestTaskSelector(input = {}) {
  const candidateTasks = input.candidateTasks || [
    {
      taskId: 'task-v86-v90-safe-pack',
      title: 'Add semi-autonomous operation pack',
      product: 'kosame_dev_orchestra',
      type: 'pm_design',
      reason: 'GPT agent can prepare PM/design/acceptance layer while code execution remains gated',
      priority: 'HIGH',
      riskLevel: 'LOW',
      flags: {},
      requiredGuardians: ['verify_preserved', 'no_secret_read', 'input_file_supported'],
      expectedVerification: ['node --check', 'target smoke', 'npm run verify']
    },
    {
      taskId: 'task-secret-or-deploy',
      title: 'Any secret/deploy/customer-data work',
      product: 'any',
      type: 'danger_gate',
      reason: 'Human approval required',
      priority: 'HOLD',
      riskLevel: 'HIGH',
      flags: { secret: true, deploy: true, highRisk: true },
      requiredGuardians: ['guardian_data_secret_permission_gate'],
      expectedVerification: ['human approval packet']
    }
  ].map((task) => ({ ...task, recommendedAgent: task.recommendedAgent || routeTask(task) }));

  const recommendedTask = input.recommendedTask || candidateTasks.find((task) => task.recommendedAgent === ROUTES.GPT_AGENT) || candidateTasks[0];

  return {
    nextBestTaskSelectorId: input.nextBestTaskSelectorId || 'next-best-task-selector-v86',
    candidateTasks,
    recommendedTask,
    rejectedTasks: candidateTasks.filter((task) => task.recommendedAgent === ROUTES.HOLD),
    decisionReason: 'Use GPT_AGENT for PM/design/acceptance work; route code execution to guarded shell/Claude; keep danger gates human-approved.',
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    ROUTES
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildNextBestTaskSelector(), null, 2));
}

module.exports = {
  TOOL_META,
  ROUTES,
  DANGEROUS_ACTIONS_DENIED,
  routeTask,
  buildNextBestTaskSelector
};
