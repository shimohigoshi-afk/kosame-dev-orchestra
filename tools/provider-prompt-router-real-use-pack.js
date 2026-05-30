'use strict';

const TOOL_META = {
  version: '7.1.0',
  title: 'Provider Prompt Router Real Use Pack',
  slug: 'provider-prompt-router-real-use-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const TASK_TYPES = [
  'implementation', 'draft', 'strategy', 'review', 'repair', 'release', 'bugfix', 'docs', 'bulk'
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const DATA_LEVELS = ['A', 'B', 'C'];
const DATA_LEVEL_ORDER = ['A', 'B', 'C'];

const BLOCKED_DANGEROUS_ACTIONS = [
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
  claude:   { taskTypes: ['implementation', 'bugfix', 'refactor', 'review', 'repair'], maxDataLevel: 'B', tier: 'primary'   },
  gemini:   { taskTypes: ['draft', 'document', 'bulk', 'expand', 'summarize', 'docs'], maxDataLevel: 'A', tier: 'primary'   },
  grok:     { taskTypes: ['strategy', 'breakthrough', 'alternative', 'stuck'],          maxDataLevel: 'A', tier: 'secondary' },
  deepseek: { taskTypes: ['code_proposal', 'fallback_code'],                            maxDataLevel: 'A', tier: 'fallback'  },
  kimi:     { taskTypes: ['long_context', 'handoff_summary'],                           maxDataLevel: 'A', tier: 'fallback'  },
  kosame:   { taskTypes: ['decision', 'pm', 'routing', 'level_c', 'release', 'final'], maxDataLevel: 'C', tier: 'internal' },
  human:    { taskTypes: ['approval', 'irreversible'],                                  maxDataLevel: 'C', tier: 'approval'  }
};

const PRODUCT_LINE_GUIDANCE = {
  sales_dx:              'Sales DX productLine: Focus on lead/pipeline automation, CRM integration. No customer PII in external providers.',
  email_reply:           'Email Reply productLine: Draft email templates only. Strip customer names and contact info before external dispatch.',
  ai_bot:                'AI Bot productLine: Conversational flow, NLP patterns. No actual user conversation data to external providers.',
  backoffice:            'Backoffice productLine: Internal workflow automation. Sanitize employee data before external dispatch.',
  anesty_board:          'ANESTY Board productLine: Health/insurance data. Level C protection required. kosame or human review only.',
  cloud_run_launch_pack: 'Cloud Run productLine: Infrastructure/deploy tasks. Human approval required for any deploy action.'
};

function isDataLevelAllowed(providerMaxLevel, requestedLevel) {
  return DATA_LEVEL_ORDER.indexOf(requestedLevel) <= DATA_LEVEL_ORDER.indexOf(providerMaxLevel);
}

function checkSafety(taskGoal, dataLevel, provider) {
  const cap = PROVIDER_CAPABILITIES[provider];
  if (!cap) return { safe: false, reason: `unknown provider: ${provider}` };
  if (!isDataLevelAllowed(cap.maxDataLevel, dataLevel)) {
    return { safe: false, reason: `data level ${dataLevel} exceeds ${provider} max (${cap.maxDataLevel})` };
  }
  const goalLower = String(taskGoal).toLowerCase();
  const found = BLOCKED_KEYWORDS.filter(kw => goalLower.includes(kw.toLowerCase()));
  if (found.length > 0 && cap.tier !== 'internal' && cap.tier !== 'approval') {
    return { safe: false, reason: `blocked keywords: ${found.join(', ')}` };
  }
  return { safe: true, reason: 'within safety boundary' };
}

function routeProvider(taskType, dataLevel, riskLevel, preferredProvider, taskGoal) {
  if (dataLevel === 'C') {
    return { selectedProvider: 'kosame', reason: 'data level C — kosame internal only', fallbacks: ['human'] };
  }
  if (riskLevel === 'critical') {
    return { selectedProvider: 'kosame', reason: 'critical risk — kosame review required', fallbacks: ['human'] };
  }
  if (taskType === 'release' || taskType === 'final') {
    return { selectedProvider: 'kosame', reason: `${taskType} task → kosame gate`, fallbacks: ['human'] };
  }
  if (taskType === 'review' || taskType === 'safety') {
    return { selectedProvider: 'kosame', reason: 'review/safety task → kosame', fallbacks: ['human'] };
  }

  if (preferredProvider && PROVIDER_CAPABILITIES[preferredProvider]) {
    const safety = checkSafety(taskGoal, dataLevel, preferredProvider);
    if (safety.safe) {
      return { selectedProvider: preferredProvider, reason: 'preferred provider matched', fallbacks: buildFallbacks(preferredProvider, dataLevel) };
    }
  }

  if (taskType === 'implementation' || taskType === 'bugfix' || taskType === 'refactor' || taskType === 'repair') {
    if (isDataLevelAllowed('B', dataLevel)) {
      return { selectedProvider: 'claude', reason: `${taskType} task → claude`, fallbacks: buildFallbacks('claude', dataLevel) };
    }
  }

  if (taskType === 'draft' || taskType === 'docs' || taskType === 'bulk' || taskType === 'document') {
    return { selectedProvider: 'gemini', reason: `${taskType} task → gemini`, fallbacks: buildFallbacks('gemini', dataLevel) };
  }

  if (taskType === 'strategy' || taskType === 'breakthrough') {
    return { selectedProvider: 'grok', reason: `${taskType} task → grok`, fallbacks: buildFallbacks('grok', dataLevel) };
  }

  return { selectedProvider: 'kosame', reason: 'unmatched task type → kosame triage', fallbacks: ['human'] };
}

function buildFallbacks(primary, dataLevel) {
  const chains = {
    claude:   ['grok', 'deepseek', 'kosame'],
    gemini:   ['grok', 'kimi', 'kosame'],
    grok:     ['claude', 'deepseek', 'kosame'],
    deepseek: ['claude', 'grok', 'kosame'],
    kimi:     ['gemini', 'grok', 'kosame'],
    kosame:   ['human']
  };
  const raw = chains[primary] || ['kosame'];
  if (!dataLevel || dataLevel === 'A') return raw;
  return raw.filter(p => {
    const cap = PROVIDER_CAPABILITIES[p];
    return cap && isDataLevelAllowed(cap.maxDataLevel, dataLevel);
  }).concat(['kosame']).filter((v, i, a) => a.indexOf(v) === i);
}

function buildPromptPacket(provider, taskGoal, taskType, productLine) {
  const guidance = PRODUCT_LINE_GUIDANCE[productLine] || '';
  const templates = {
    claude:   `You are a precise implementation engineer working on ${productLine}.\nContext: ${guidance}\nTask: ${taskGoal}\nTaskType: ${taskType}\nDo not read secrets, .env, or API key values. Return result as JSON.`,
    gemini:   `You are a bulk draft specialist for ${productLine}.\nContext: ${guidance}\nTask: ${taskGoal}\nTaskType: ${taskType}\nUse only public or sanitized information. No customer data.`,
    grok:     `You are a breakthrough analyst for ${productLine}.\nContext: ${guidance}\nTask: ${taskGoal}\nTaskType: ${taskType}\nProvide alternative strategies. No confidential data.`,
    deepseek: `You are a fallback code proposer.\nTask: ${taskGoal}\nProductLine: ${productLine}\nInput must be anonymized. No secrets or customer data.`,
    kimi:     `You are a long context summarizer.\nTask: ${taskGoal}\nProductLine: ${productLine}\nOmit secrets, customer details, and sensitive identifiers.`,
    kosame:   `こさめ副社長として判断してください。\nProductLine: ${productLine}\nContext: ${guidance}\nタスク: ${taskGoal}\nTaskType: ${taskType}\n判断結果をJSON形式で返してください。`,
    human:    `Human approval required.\nTask: ${taskGoal}\nProductLine: ${productLine}\nTaskType: ${taskType}\nContext: ${guidance}\nPlease review and provide final YES/NO.`
  };
  const cap = PROVIDER_CAPABILITIES[provider] || PROVIDER_CAPABILITIES.kosame;
  return {
    provider,
    taskType,
    productLine,
    prompt: templates[provider] || templates.kosame,
    tier: cap.tier,
    humanApprovalRequired: cap.tier !== 'internal'
  };
}

function buildContextualGuidance(taskType, productLine, riskLevel) {
  const base = PRODUCT_LINE_GUIDANCE[productLine] || 'General task context.';
  const riskNote = riskLevel === 'high' || riskLevel === 'critical'
    ? `HIGH RISK (${riskLevel}): Require kosame review before external dispatch.`
    : `Risk level ${riskLevel}: proceed per routing policy.`;
  const typeNote = {
    implementation: 'Implementation: claude preferred. Verify with node --check and npm run smoke.',
    draft:          'Draft/Docs: gemini preferred. No sensitive data.',
    strategy:       'Strategy: grok preferred. Provide three alternatives minimum.',
    review:         'Review: kosame required. No external provider for final review.',
    repair:         'Repair: claude preferred. Capture error output first.',
    release:        'Release: kosame + human approval required. No auto-execute.',
    bugfix:         'Bugfix: claude preferred. Include reproduce steps in packet.',
    docs:           'Docs: gemini preferred. Sanitize before dispatch.',
    bulk:           'Bulk: gemini preferred. Batch in segments, no PII.'
  }[taskType] || 'Default routing: kosame triage.';
  return { productLineGuidance: base, riskNote, taskTypeNote: typeNote };
}

function buildPacket(input) {
  const taskType          = TASK_TYPES.includes(input.taskType) ? input.taskType : 'implementation';
  const productLine       = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const riskLevel         = RISK_LEVELS.includes(input.riskLevel) ? input.riskLevel : 'low';
  const dataLevel         = DATA_LEVELS.includes(input.dataLevel) ? input.dataLevel : 'A';
  const preferredProvider = input.preferredProvider || null;
  const taskGoal          = String(input.taskGoal || '(task goal)').trim();

  const providerRoute       = routeProvider(taskType, dataLevel, riskLevel, preferredProvider, taskGoal);
  const safetyCheck         = checkSafety(taskGoal, dataLevel, providerRoute.selectedProvider);
  const promptPacket        = buildPromptPacket(providerRoute.selectedProvider, taskGoal, taskType, productLine);
  const contextualGuidance  = buildContextualGuidance(taskType, productLine, riskLevel);

  const hasBlockedKeyword = BLOCKED_KEYWORDS.some(kw => taskGoal.toLowerCase().includes(kw.toLowerCase()));

  const recommendedNextAction = safetyCheck.safe && !hasBlockedKeyword
    ? `Dispatch to ${providerRoute.selectedProvider} — review prompt packet and await human approval`
    : `Safety violation: ${safetyCheck.reason} — route to kosame before dispatching`;

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    taskType,
    productLine,
    riskLevel,
    dataLevel,
    taskGoal,
    hasBlockedKeyword,
    providerRoute,
    promptPacket,
    safetyCheck,
    contextualGuidance,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    taskType:          process.env.KOSAME_TASK_TYPE        || 'implementation',
    productLine:       process.env.KOSAME_PRODUCT_LINE     || 'backoffice',
    riskLevel:         process.env.KOSAME_RISK_LEVEL       || 'low',
    dataLevel:         process.env.KOSAME_DATA_LEVEL       || 'A',
    preferredProvider: process.env.KOSAME_PREFERRED_PROVIDER || null,
    taskGoal:          process.env.KOSAME_TASK_GOAL        || 'implement release note generator'
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
  PRODUCT_LINE_GUIDANCE,
  isDataLevelAllowed,
  checkSafety,
  routeProvider,
  buildFallbacks,
  buildPromptPacket,
  buildContextualGuidance,
  buildPacket
};
