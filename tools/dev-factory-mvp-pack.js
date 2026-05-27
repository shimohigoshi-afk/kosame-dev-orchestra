'use strict';

const TOOL_META = {
  version: '6.0.0',
  title: 'Dev Factory MVP',
  slug: 'dev-factory-mvp-pack'
};

const PRODUCT_LINES = ['sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const BLOCKED_DANGEROUS_ACTIONS = [
  'git commit',
  'git push',
  'git tag',
  'deploy',
  'docker build',
  'gcloud run deploy',
  'rm -rf',
  'git reset --hard',
  'git clean',
  'Secret value read',
  '.env value read',
  'API key value read',
  'customer data sharing',
  'insurance policy sharing',
  'health check info sharing',
  'personal name in minutes sharing'
];

const EXTERNAL_PROVIDERS = ['gemini', 'claude', 'grok', 'deepseek', 'kimi'];

const BLOCKED_FOR_EXTERNAL = [
  'customer data', 'Secret', '.env', 'API key',
  'insurance policy', 'health check', 'personal name', 'private contract'
];

const PROVIDER_ROLE_MAP = {
  sales_dx:            { primary: 'claude', bulk: 'gemini', breakthrough: 'grok' },
  email_reply:         { primary: 'claude', bulk: 'gemini', breakthrough: 'grok' },
  ai_bot:              { primary: 'claude', bulk: 'gemini', breakthrough: 'grok' },
  backoffice:          { primary: 'claude', bulk: 'gemini', breakthrough: 'grok' },
  anesty_board:        { primary: 'kosame', bulk: 'gemini', breakthrough: 'grok' },
  cloud_run_launch_pack: { primary: 'claude', bulk: 'gemini', breakthrough: 'kosame' }
};

function buildWorkBreakdown(taskGoal = '', productLine = 'backoffice') {
  return {
    taskGoal,
    productLine,
    phases: [
      { phase: 'design',         owner: 'kosame',    requiresHumanApproval: false },
      { phase: 'implementation', owner: 'claude',    requiresHumanApproval: true  },
      { phase: 'bulk_draft',     owner: 'gemini',    requiresHumanApproval: true  },
      { phase: 'verify',         owner: 'cloudShell',requiresHumanApproval: true  },
      { phase: 'release',        owner: 'human',     requiresHumanApproval: true  }
    ]
  };
}

function assignProviders(productLine = 'backoffice', preferredProviders = []) {
  const defaults = PROVIDER_ROLE_MAP[productLine] || PROVIDER_ROLE_MAP.backoffice;
  return {
    primary: preferredProviders[0] || defaults.primary,
    bulk: preferredProviders[1] || defaults.bulk,
    breakthrough: defaults.breakthrough,
    execution: 'cloudShell',
    approval: 'human',
    pm: 'kosame'
  };
}

function sanitizePromptPackets(taskGoal = '', riskLevel = 'low') {
  const highRiskKeywords = BLOCKED_FOR_EXTERNAL;
  const found = highRiskKeywords.filter(kw => taskGoal.toLowerCase().includes(kw.toLowerCase()));
  const sanitized = found.length === 0;
  return {
    sanitized,
    blockedKeywords: found,
    safeForExternal: sanitized && riskLevel !== 'critical',
    riskLevel
  };
}

function createVerificationPlan(productLine = 'backoffice') {
  return {
    steps: [
      { step: 'node --check on new JS files',         required: true },
      { step: 'npm run smoke for new packs',           required: true },
      { step: 'npm run verify (full suite)',            required: true },
      { step: 'git diff --stat (confirm non-empty)',   required: true },
      { step: 'git status --short review',             required: true }
    ],
    productLine,
    humanApprovalRequired: true
  };
}

function createHumanApprovalPacket(input = {}) {
  return {
    requestedBy: 'dev-factory-mvp',
    projectName: input.projectName || '(unnamed)',
    productLine: input.productLine || 'backoffice',
    riskLevel: input.riskLevel || 'low',
    actionsRequiringApproval: [
      'git commit', 'git push', 'git tag', 'deploy'
    ],
    humanApprovalRequired: true,
    approver: 'じゅんやさん (final YES only — does not return to worker)',
    note: 'じゅんやさんは最終YESのみ。作業員に戻さない。'
  };
}

function buildPacket(input = {}) {
  const projectName = input.projectName || '(unnamed)';
  const repoPath = input.repoPath || '.';
  const taskGoal = input.taskGoal || '(task goal)';
  const productLine = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const riskLevel = RISK_LEVELS.includes(input.riskLevel) ? input.riskLevel : 'low';
  const preferredProviders = input.preferredProviders || [];

  const workBreakdown = buildWorkBreakdown(taskGoal, productLine);
  const providerAssignments = assignProviders(productLine, preferredProviders);
  const sanitizedPromptPackets = sanitizePromptPackets(taskGoal, riskLevel);
  const verificationPlan = createVerificationPlan(productLine);
  const humanApprovalPacket = createHumanApprovalPacket({ projectName, productLine, riskLevel });
  const blockedDangerousActions = BLOCKED_DANGEROUS_ACTIONS;
  const recommendedNextAction = sanitizedPromptPackets.sanitized
    ? `Dispatch to ${providerAssignments.primary} — awaiting human approval`
    : 'Sanitize task description before dispatching to external provider';

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    projectName,
    repoPath,
    taskGoal,
    productLine,
    riskLevel,
    workBreakdown,
    providerAssignments,
    sanitizedPromptPackets,
    verificationPlan,
    humanApprovalPacket,
    blockedDangerousActions,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    projectName: process.env.KOSAME_PROJECT_NAME || 'sample-project',
    repoPath: process.env.KOSAME_REPO_PATH || '.',
    taskGoal: process.env.KOSAME_TASK_GOAL || 'implement release note generator',
    productLine: process.env.KOSAME_PRODUCT_LINE || 'backoffice',
    riskLevel: process.env.KOSAME_RISK_LEVEL || 'low',
    preferredProviders: (process.env.KOSAME_PREFERRED_PROVIDERS || 'claude,gemini').split(',')
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  RISK_LEVELS,
  BLOCKED_DANGEROUS_ACTIONS,
  EXTERNAL_PROVIDERS,
  BLOCKED_FOR_EXTERNAL,
  PROVIDER_ROLE_MAP,
  buildWorkBreakdown,
  assignProviders,
  sanitizePromptPackets,
  createVerificationPlan,
  createHumanApprovalPacket,
  buildPacket
};
