'use strict';

const TOOL_META = {
  version: '7.0.0',
  title: 'Practical Dev Factory Runtime',
  slug: 'practical-dev-factory-runtime-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const TASK_TYPES = [
  'implementation', 'draft', 'strategy', 'review', 'repair', 'release'
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const DATA_LEVELS = ['A', 'B', 'C'];

const DATA_LEVEL_ORDER = ['A', 'B', 'C'];

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

const BLOCKED_KEYWORDS = [
  '.env', 'API key', 'Secret', 'customer data',
  'insurance policy', 'health check', 'personal name', 'private contract'
];

const PROVIDER_CAPABILITIES = {
  claude:   { taskTypes: ['implementation', 'bugfix', 'refactor', 'review', 'repair'], maxDataLevel: 'B', tier: 'primary'   },
  gemini:   { taskTypes: ['draft', 'document', 'bulk', 'expand', 'summarize'],         maxDataLevel: 'A', tier: 'primary'   },
  grok:     { taskTypes: ['strategy', 'breakthrough', 'alternative', 'stuck'],          maxDataLevel: 'A', tier: 'secondary' },
  deepseek: { taskTypes: ['code_proposal', 'fallback_code'],                            maxDataLevel: 'A', tier: 'fallback'  },
  kimi:     { taskTypes: ['long_context', 'handoff_summary'],                           maxDataLevel: 'A', tier: 'fallback'  },
  kosame:   { taskTypes: ['decision', 'pm', 'routing', 'level_c', 'release'],           maxDataLevel: 'C', tier: 'internal' },
  human:    { taskTypes: ['approval', 'irreversible'],                                  maxDataLevel: 'C', tier: 'approval'  }
};

const PRODUCT_PROVIDER_MAP = {
  sales_dx:              { primary: 'claude',  bulk: 'gemini', breakthrough: 'grok'   },
  email_reply:           { primary: 'claude',  bulk: 'gemini', breakthrough: 'grok'   },
  ai_bot:                { primary: 'claude',  bulk: 'gemini', breakthrough: 'grok'   },
  backoffice:            { primary: 'claude',  bulk: 'gemini', breakthrough: 'grok'   },
  anesty_board:          { primary: 'kosame',  bulk: 'gemini', breakthrough: 'grok'   },
  cloud_run_launch_pack: { primary: 'claude',  bulk: 'gemini', breakthrough: 'kosame' }
};

function isDataLevelAllowed(providerMaxLevel, requestedLevel) {
  return DATA_LEVEL_ORDER.indexOf(requestedLevel) <= DATA_LEVEL_ORDER.indexOf(providerMaxLevel);
}

function generateRuntimeId(projectName = 'project', taskType = 'implementation') {
  const ts = Date.now();
  const slug = String(projectName).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `runtime-${slug}-${taskType}-${ts}`;
}

function normalizeTask(input = {}) {
  const taskGoal     = String(input.taskGoal || '(task goal)').trim();
  const taskType     = TASK_TYPES.includes(input.taskType) ? input.taskType : 'implementation';
  const productLine  = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const riskLevel    = RISK_LEVELS.includes(input.riskLevel) ? input.riskLevel : 'low';
  const dataLevel    = DATA_LEVELS.includes(input.dataLevel) ? input.dataLevel : 'A';
  const hasBlockedKeyword = BLOCKED_KEYWORDS.some(kw => taskGoal.toLowerCase().includes(kw.toLowerCase()));
  return {
    taskGoal,
    taskType,
    productLine,
    riskLevel,
    dataLevel,
    hasBlockedKeyword,
    safeForExternal: !hasBlockedKeyword && dataLevel !== 'C' && riskLevel !== 'critical'
  };
}

function buildRealStatusSummary(currentStatus = '', productLine = 'backoffice') {
  return {
    productLine,
    rawStatus: currentStatus || '(no current status provided)',
    importedAt: new Date().toISOString(),
    statusClass: currentStatus ? 'provided' : 'missing',
    note: 'Real status imported from operator input. Verify against actual repo before proceeding.'
  };
}

function buildWorkBreakdown(taskGoal = '', taskType = 'implementation', productLine = 'backoffice') {
  const phases = [
    { phase: 'intake',          owner: 'kosame',     requiresHumanApproval: false },
    { phase: 'design',          owner: 'kosame',     requiresHumanApproval: false },
    { phase: 'implementation',  owner: 'claude',     requiresHumanApproval: true  },
    { phase: 'bulk_draft',      owner: 'gemini',     requiresHumanApproval: true  },
    { phase: 'verify',          owner: 'cloudShell', requiresHumanApproval: true  },
    { phase: 'repair_loop',     owner: 'claude',     requiresHumanApproval: true  },
    { phase: 'release',         owner: 'human',      requiresHumanApproval: true  }
  ];
  return { taskGoal, taskType, productLine, phases };
}

function routeProvider(taskType = 'implementation', dataLevel = 'A', riskLevel = 'low', preferredProvider = null, goal = '') {
  if (dataLevel === 'C') {
    return { selectedProvider: 'kosame', reason: 'data level C — kosame internal only', fallbacks: ['human'] };
  }
  if (riskLevel === 'critical') {
    return { selectedProvider: 'kosame', reason: 'critical risk — kosame review required', fallbacks: ['human'] };
  }

  if (preferredProvider && PROVIDER_CAPABILITIES[preferredProvider]) {
    const cap = PROVIDER_CAPABILITIES[preferredProvider];
    if (isDataLevelAllowed(cap.maxDataLevel, dataLevel)) {
      return { selectedProvider: preferredProvider, reason: 'preferred provider matched', fallbacks: buildFallbacks(preferredProvider, dataLevel) };
    }
  }

  if (taskType === 'implementation' || taskType === 'repair' || taskType === 'review') {
    if (isDataLevelAllowed('B', dataLevel)) {
      const provider = taskType === 'review' ? 'kosame' : 'claude';
      return { selectedProvider: provider, reason: `${taskType} task → ${provider}`, fallbacks: buildFallbacks(provider, dataLevel) };
    }
  }

  if (taskType === 'draft') {
    return { selectedProvider: 'gemini', reason: 'draft task → gemini', fallbacks: buildFallbacks('gemini', dataLevel) };
  }

  if (taskType === 'strategy') {
    return { selectedProvider: 'grok', reason: 'strategy task → grok', fallbacks: buildFallbacks('grok', dataLevel) };
  }

  if (taskType === 'release') {
    return { selectedProvider: 'kosame', reason: 'release task → kosame gate', fallbacks: ['human'] };
  }

  return { selectedProvider: 'kosame', reason: 'unmatched — kosame triage', fallbacks: ['human'] };
}

function buildFallbacks(primary, dataLevel = 'A') {
  const chains = {
    claude:  ['grok', 'deepseek', 'kosame'],
    gemini:  ['grok', 'kimi', 'kosame'],
    grok:    ['claude', 'deepseek', 'kosame'],
    deepseek:['claude', 'grok', 'kosame'],
    kimi:    ['gemini', 'grok', 'kosame'],
    kosame:  ['human']
  };
  const raw = chains[primary] || ['kosame'];
  if (dataLevel === 'A') return raw;
  return raw.filter(p => {
    const cap = PROVIDER_CAPABILITIES[p];
    return cap && isDataLevelAllowed(cap.maxDataLevel, dataLevel);
  }).concat(['kosame']).filter((v, i, a) => a.indexOf(v) === i);
}

function buildPromptTemplate(provider, taskGoal, taskType, productLine) {
  const templates = {
    claude:   `You are a precise implementation engineer.\nTask: ${taskGoal}\nProductLine: ${productLine}\nDo not read secrets, .env, or API key values. Return result as JSON.`,
    gemini:   `You are a bulk draft specialist.\nTask: ${taskGoal}\nProductLine: ${productLine}\nUse only public or sanitized information. No customer data.`,
    grok:     `You are a breakthrough analyst.\nTask: ${taskGoal}\nProductLine: ${productLine}\nProvide alternative designs. No confidential data.`,
    deepseek: `You are a fallback code proposer.\nTask: ${taskGoal}\nInput must be anonymized. No secrets or customer data.`,
    kimi:     `You are a long context summarizer.\nTask: ${taskGoal}\nOmit secrets, customer details, and sensitive identifiers.`,
    kosame:   `こさめ副社長として判断してください。\nタスク: ${taskGoal}\nProductLine: ${productLine}\n判断結果をJSON形式で返してください。`,
    human:    `Human approval required.\nTask: ${taskGoal}\nProductLine: ${productLine}\nPlease review and provide final YES/NO.`
  };
  return templates[provider] || templates.kosame;
}

function buildExecutionPackets(providerRoute, taskGoal, taskType, productLine) {
  const { selectedProvider, fallbacks } = providerRoute;
  const primaryPacket = {
    provider: selectedProvider,
    taskType,
    productLine,
    prompt: buildPromptTemplate(selectedProvider, taskGoal, taskType, productLine),
    tier: (PROVIDER_CAPABILITIES[selectedProvider] || {}).tier || 'internal',
    humanApprovalRequired: true
  };
  const fallbackPackets = (fallbacks || []).map(fb => ({
    provider: fb,
    taskType,
    productLine,
    prompt: buildPromptTemplate(fb, taskGoal, taskType, productLine),
    tier: (PROVIDER_CAPABILITIES[fb] || {}).tier || 'internal',
    isFallback: true
  }));
  return [primaryPacket, ...fallbackPackets];
}

function buildVerificationPlan(taskType = 'implementation', productLine = 'backoffice') {
  const steps = [
    { step: 'node --check on new JS files',       required: true },
    { step: 'npm run smoke for new packs',          required: true },
    { step: 'npm run verify (full suite)',           required: true },
    { step: 'git diff --stat (confirm non-empty)', required: true },
    { step: 'git status --short review',            required: true }
  ];
  if (taskType === 'release') {
    steps.push({ step: 'Human Approval before git tag / deploy', required: true });
  }
  return { taskType, productLine, steps, humanApprovalRequired: true };
}

function buildRepairLoopPlan(taskType = 'implementation', riskLevel = 'low') {
  return {
    enabled: true,
    maxRetries: riskLevel === 'critical' ? 1 : 3,
    repairOwner: 'claude',
    escalationOnFailure: 'kosame',
    gateOnEachRetry: riskLevel === 'high' || riskLevel === 'critical',
    steps: [
      { step: 'Capture failure output',        owner: 'cloudShell', auto: true  },
      { step: 'Route to claude for repair',    owner: 'claude',     auto: true  },
      { step: 'Re-run smoke / verify',         owner: 'cloudShell', auto: true  },
      { step: 'Escalate to kosame if 3 fails', owner: 'kosame',     auto: false }
    ]
  };
}

function buildHumanApprovalPacket(input = {}) {
  return {
    requestedBy: 'practical-dev-factory-runtime',
    projectName: input.projectName || '(unnamed)',
    productLine: input.productLine || 'backoffice',
    riskLevel:   input.riskLevel   || 'low',
    actionsRequiringApproval: [
      'git commit', 'git push', 'git tag', 'deploy',
      'docker build', 'gcloud run deploy'
    ],
    humanApprovalRequired: true,
    approver: 'じゅんやさん (final YES only — does not return to worker)',
    note: 'じゅんやさんは最終YESのみ。作業員に戻さない。'
  };
}

function buildPacket(input = {}) {
  const projectName       = input.projectName       || '(unnamed)';
  const repoPath          = input.repoPath          || '.';
  const taskGoal          = input.taskGoal          || '(task goal)';
  const productLine       = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const taskType          = TASK_TYPES.includes(input.taskType)       ? input.taskType    : 'implementation';
  const riskLevel         = RISK_LEVELS.includes(input.riskLevel)     ? input.riskLevel   : 'low';
  const dataLevel         = DATA_LEVELS.includes(input.dataLevel)     ? input.dataLevel   : 'A';
  const preferredProvider = input.preferredProvider || null;
  const currentStatus     = input.currentStatus     || '';

  const runtimeId           = generateRuntimeId(projectName, taskType);
  const normalizedTask      = normalizeTask({ taskGoal, taskType, productLine, riskLevel, dataLevel });
  const realStatusSummary   = buildRealStatusSummary(currentStatus, productLine);
  const workBreakdown       = buildWorkBreakdown(taskGoal, taskType, productLine);
  const providerRoute       = routeProvider(taskType, dataLevel, riskLevel, preferredProvider, taskGoal);
  const executionPackets    = buildExecutionPackets(providerRoute, taskGoal, taskType, productLine);
  const verificationPlan    = buildVerificationPlan(taskType, productLine);
  const repairLoopPlan      = buildRepairLoopPlan(taskType, riskLevel);
  const humanApprovalPacket = buildHumanApprovalPacket({ projectName, productLine, riskLevel });

  const recommendedNextAction = normalizedTask.safeForExternal
    ? `Dispatch to ${providerRoute.selectedProvider} — review execution packets and await human approval`
    : 'Safety violation detected — route to kosame before dispatching';

  return {
    version:              TOOL_META.version,
    title:                TOOL_META.title,
    dryRun:               true,
    humanApprovalRequired: true,
    runtimeId,
    projectName,
    repoPath,
    normalizedTask,
    realStatusSummary,
    workBreakdown,
    providerRoute,
    executionPackets,
    verificationPlan,
    repairLoopPlan,
    humanApprovalPacket,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    projectName:       process.env.KOSAME_PROJECT_NAME        || 'sample-project',
    repoPath:          process.env.KOSAME_REPO_PATH           || '.',
    taskGoal:          process.env.KOSAME_TASK_GOAL           || 'implement release note generator',
    productLine:       process.env.KOSAME_PRODUCT_LINE        || 'backoffice',
    taskType:          process.env.KOSAME_TASK_TYPE           || 'implementation',
    riskLevel:         process.env.KOSAME_RISK_LEVEL          || 'low',
    dataLevel:         process.env.KOSAME_DATA_LEVEL          || 'A',
    preferredProvider: process.env.KOSAME_PREFERRED_PROVIDER  || null,
    currentStatus:     process.env.KOSAME_CURRENT_STATUS      || 'git clean, smoke passing, ready for next task'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  TASK_TYPES,
  RISK_LEVELS,
  DATA_LEVELS,
  BLOCKED_DANGEROUS_ACTIONS,
  BLOCKED_KEYWORDS,
  PROVIDER_CAPABILITIES,
  PRODUCT_PROVIDER_MAP,
  isDataLevelAllowed,
  generateRuntimeId,
  normalizeTask,
  buildRealStatusSummary,
  buildWorkBreakdown,
  routeProvider,
  buildFallbacks,
  buildExecutionPackets,
  buildVerificationPlan,
  buildRepairLoopPlan,
  buildHumanApprovalPacket,
  buildPacket
};
