'use strict';

const TOOL_META = {
  version: '6.5.0',
  title: 'Provider Prompt Router CLI',
  slug: 'provider-prompt-router-cli-pack'
};

const BLOCKED_ACTIONS = [
  'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard', 'git clean',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance policy sharing',
  'health check info sharing', 'personal name in minutes sharing'
];

const BLOCKED_KEYWORDS = [
  '.env', 'API key', 'Secret', 'customer data',
  'insurance policy', 'health check', 'personal name', 'private contract'
];

const PROVIDER_CAPABILITIES = {
  claude:   { taskTypes: ['implementation', 'bugfix', 'refactor', 'review'], maxDataLevel: 'B', tier: 'primary'   },
  gemini:   { taskTypes: ['draft', 'document', 'bulk', 'expand', 'summarize'], maxDataLevel: 'A', tier: 'primary'  },
  grok:     { taskTypes: ['strategy', 'breakthrough', 'alternative', 'stuck'], maxDataLevel: 'A', tier: 'secondary' },
  deepseek: { taskTypes: ['code_proposal', 'fallback_code'],  maxDataLevel: 'A', tier: 'fallback'  },
  kimi:     { taskTypes: ['long_context', 'handoff_summary'], maxDataLevel: 'A', tier: 'fallback'  },
  kosame:   { taskTypes: ['decision', 'pm', 'routing', 'level_c'], maxDataLevel: 'C', tier: 'internal' },
  human:    { taskTypes: ['approval', 'irreversible'],        maxDataLevel: 'C', tier: 'approval'  }
};

const DATA_LEVEL_ORDER = ['A', 'B', 'C'];

function isDataLevelAllowed(providerMaxLevel, requestedLevel) {
  return DATA_LEVEL_ORDER.indexOf(requestedLevel) <= DATA_LEVEL_ORDER.indexOf(providerMaxLevel);
}

function checkSafetyBoundary(goal = '', dataLevel = 'A', provider = 'gemini') {
  const cap = PROVIDER_CAPABILITIES[provider];
  if (!cap) return { safe: false, reason: 'unknown provider' };

  if (!isDataLevelAllowed(cap.maxDataLevel, dataLevel)) {
    return { safe: false, reason: `data level ${dataLevel} exceeds ${provider} max (${cap.maxDataLevel})` };
  }

  const goalLower = goal.toLowerCase();
  const found = BLOCKED_KEYWORDS.filter(kw => goalLower.includes(kw.toLowerCase()));
  if (found.length > 0 && cap.tier !== 'internal' && cap.tier !== 'approval') {
    return { safe: false, reason: `blocked keywords detected: ${found.join(', ')}` };
  }

  return { safe: true, reason: 'within safety boundary' };
}

function selectProvider(input = {}) {
  const taskType = input.taskType || 'implementation';
  const dataLevel = input.dataLevel || 'A';
  const riskLevel = input.riskLevel || 'low';
  const preferredProvider = input.preferredProvider || null;
  const goal = input.goal || '';

  if (dataLevel === 'C') {
    return { provider: 'kosame', reason: 'data level C — kosame internal only', fallbacks: ['human'] };
  }

  if (riskLevel === 'critical') {
    return { provider: 'kosame', reason: 'critical risk — kosame review required', fallbacks: ['human'] };
  }

  if (preferredProvider && PROVIDER_CAPABILITIES[preferredProvider]) {
    const cap = PROVIDER_CAPABILITIES[preferredProvider];
    const safety = checkSafetyBoundary(goal, dataLevel, preferredProvider);
    if (safety.safe && cap.taskTypes.some(t => taskType.includes(t) || t.includes(taskType))) {
      return { provider: preferredProvider, reason: 'preferred provider matched', fallbacks: buildFallbacks(preferredProvider, dataLevel) };
    }
  }

  if (taskType.includes('implementation') || taskType.includes('bugfix') || taskType.includes('refactor') || taskType.includes('review')) {
    if (isDataLevelAllowed('B', dataLevel)) return { provider: 'claude', reason: 'implementation task → claude', fallbacks: ['grok', 'deepseek', 'kosame'] };
  }

  if (taskType.includes('draft') || taskType.includes('document') || taskType.includes('bulk') || taskType.includes('summarize') || taskType.includes('expand')) {
    return { provider: 'gemini', reason: 'draft/bulk task → gemini', fallbacks: ['grok', 'kimi', 'kosame'] };
  }

  if (taskType.includes('strategy') || taskType.includes('breakthrough') || taskType.includes('stuck')) {
    return { provider: 'grok', reason: 'strategy/breakthrough task → grok', fallbacks: ['claude', 'kosame'] };
  }

  if (taskType.includes('long_context') || taskType.includes('handoff_summary')) {
    return { provider: 'kimi', reason: 'long context task → kimi', fallbacks: ['gemini', 'kosame'] };
  }

  return { provider: 'kosame', reason: 'unmatched task type → kosame triage', fallbacks: ['human'] };
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

function buildPromptPacket(provider, goal, taskType, productLine = 'backoffice') {
  const cap = PROVIDER_CAPABILITIES[provider] || PROVIDER_CAPABILITIES.kosame;
  const templates = {
    claude:   `You are a precise implementation engineer.\nTask: ${goal}\nDo not read secrets, .env, or API key values. Return result as JSON.`,
    gemini:   `You are a bulk draft specialist.\nTask: ${goal}\nUse only public or sanitized information. No customer data.`,
    grok:     `You are a breakthrough analyst.\nTask: ${goal}\nProvide alternative designs. No confidential data.`,
    deepseek: `You are a fallback code proposer.\nTask: ${goal}\nInput must be anonymized. No secrets or customer data.`,
    kimi:     `You are a long context summarizer.\nTask: ${goal}\nOmit secrets, customer details, and sensitive identifiers.`,
    kosame:   `こさめ副社長として判断してください。\nタスク: ${goal}\n判断結果をJSON形式で返してください。`,
    human:    `Human approval required.\nTask: ${goal}\nProductLine: ${productLine}\nPlease review and provide final YES/NO.`
  };
  return {
    provider,
    taskType,
    productLine,
    prompt: templates[provider] || templates.kosame,
    tier: cap.tier,
    humanApprovalRequired: cap.tier !== 'internal'
  };
}

function buildVerificationPlan(taskType, productLine = 'backoffice') {
  const steps = [
    { step: 'node --check on new JS files', required: true },
    { step: 'npm run verify (full suite)',   required: true },
    { step: 'git diff --stat (non-empty)',   required: true }
  ];
  if (taskType.includes('deploy') || taskType.includes('release')) {
    steps.push({ step: 'Human Approval before any deploy', required: true });
  }
  return { taskType, productLine, steps, humanApprovalRequired: true };
}

function buildPacket(input = {}) {
  const taskType       = input.taskType       || 'implementation';
  const productLine    = input.productLine    || 'backoffice';
  const riskLevel      = input.riskLevel      || 'low';
  const dataLevel      = input.dataLevel      || 'A';
  const preferredProvider = input.preferredProvider || null;
  const goal           = input.goal           || '(task goal)';

  const selection = selectProvider({ taskType, dataLevel, riskLevel, preferredProvider, goal });
  const selectedProvider = selection.provider;
  const fallbackProviders = selection.fallbacks;

  const safetyBoundary = checkSafetyBoundary(goal, dataLevel, selectedProvider);
  const promptPacket   = buildPromptPacket(selectedProvider, goal, taskType, productLine);
  const verificationPlan = buildVerificationPlan(taskType, productLine);

  const recommendedNextAction = safetyBoundary.safe
    ? `Dispatch to ${selectedProvider} — awaiting human approval`
    : `Safety boundary violated: ${safetyBoundary.reason} — route to kosame`;

  return {
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    selectedProvider,
    fallbackProviders,
    promptPacket,
    safetyBoundary,
    verificationPlan,
    blockedActions: BLOCKED_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    taskType:          process.env.KOSAME_TASK_TYPE       || 'implementation',
    productLine:       process.env.KOSAME_PRODUCT_LINE    || 'backoffice',
    riskLevel:         process.env.KOSAME_RISK_LEVEL      || 'low',
    dataLevel:         process.env.KOSAME_DATA_LEVEL      || 'A',
    preferredProvider: process.env.KOSAME_PREFERRED_PROVIDER || null,
    goal:              process.env.KOSAME_GOAL            || 'implement release note generator'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_ACTIONS,
  BLOCKED_KEYWORDS,
  PROVIDER_CAPABILITIES,
  isDataLevelAllowed,
  checkSafetyBoundary,
  selectProvider,
  buildFallbacks,
  buildPromptPacket,
  buildVerificationPlan,
  buildPacket
};
