'use strict';

const TOOL_META = {
  version: '7.4.0',
  title: 'Repair Loop Controller',
  slug: 'repair-loop-controller-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const PROVIDERS = ['claude', 'gemini', 'grok', 'deepseek', 'kimi', 'kosame', 'human'];

const FAILURE_TYPES = [
  'verify_failure',
  'syntax_error',
  'missing_file',
  'type_error',
  'reference_error',
  'npm_error',
  'unclear_spec',
  'spec_issue',
  'provider_unavailable',
  'safety_block',
  'human_approval_required',
  'incomplete',
  'unknown_failure'
];

const BLOCKED_DANGEROUS_ACTIONS = [
  'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard', 'git clean',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance policy sharing',
  'health check info sharing', 'personal name in minutes sharing'
];

const REPAIR_ROUTING_TABLE = {
  verify_failure:           { primaryOwner: 'claude',   fallback: 'grok',   escalation: 'kosame', reason: 'Verify failure → claude repair first' },
  syntax_error:             { primaryOwner: 'claude',   fallback: 'grok',   escalation: 'kosame', reason: 'Syntax error → claude fix' },
  missing_file:             { primaryOwner: 'claude',   fallback: 'grok',   escalation: 'kosame', reason: 'Missing file → claude create' },
  type_error:               { primaryOwner: 'claude',   fallback: 'grok',   escalation: 'kosame', reason: 'TypeError → claude debug' },
  reference_error:          { primaryOwner: 'claude',   fallback: 'grok',   escalation: 'kosame', reason: 'ReferenceError → claude debug' },
  npm_error:                { primaryOwner: 'claude',   fallback: 'kosame', escalation: 'human',  reason: 'npm error → claude diagnose' },
  unclear_spec:             { primaryOwner: 'kosame',   fallback: 'human',  escalation: 'human',  reason: 'Unclear spec → kosame clarify' },
  spec_issue:               { primaryOwner: 'kosame',   fallback: 'human',  escalation: 'human',  reason: 'Spec issue → kosame judge' },
  provider_unavailable:     { primaryOwner: 'fallback', fallback: 'kosame', escalation: 'human',  reason: 'Provider unavailable → use fallback provider' },
  safety_block:             { primaryOwner: 'kosame',   fallback: 'human',  escalation: 'human',  reason: 'Safety block → kosame review required' },
  human_approval_required:  { primaryOwner: 'human',    fallback: 'human',  escalation: 'human',  reason: 'Human approval required → route to じゅんやさん' },
  incomplete:               { primaryOwner: 'claude',   fallback: 'gemini', escalation: 'kosame', reason: 'Incomplete → claude or gemini re-run' },
  unknown_failure:          { primaryOwner: 'kosame',   fallback: 'human',  escalation: 'human',  reason: 'Unknown failure → kosame triage required' }
};

const PROVIDER_FALLBACK_CHAINS = {
  claude:   ['grok', 'deepseek', 'kosame'],
  gemini:   ['grok', 'kimi', 'kosame'],
  grok:     ['claude', 'deepseek', 'kosame'],
  deepseek: ['claude', 'grok', 'kosame'],
  kimi:     ['gemini', 'grok', 'kosame'],
  kosame:   ['human'],
  human:    []
};

function routeRepair(failureType, currentProvider) {
  const routing = REPAIR_ROUTING_TABLE[failureType] || REPAIR_ROUTING_TABLE.unknown_failure;

  let repairProvider = routing.primaryOwner;
  if (repairProvider === 'fallback') {
    const chain = PROVIDER_FALLBACK_CHAINS[currentProvider] || ['kosame'];
    repairProvider = chain[0] || 'kosame';
  }

  return {
    failureType,
    repairProvider,
    fallbackProvider: routing.fallback === 'fallback'
      ? (PROVIDER_FALLBACK_CHAINS[currentProvider] || ['kosame'])[0]
      : routing.fallback,
    escalationProvider: routing.escalation,
    reason: routing.reason
  };
}

function buildRepairPrompt(failureType, errorOutput, taskGoal, repairProvider) {
  const errorSnippet = String(errorOutput || '(no error output)').slice(0, 500);
  const prompts = {
    claude: `You are a repair engineer. Fix the following failure.\nTask: ${taskGoal}\nFailureType: ${failureType}\nError:\n${errorSnippet}\nDo not read secrets or .env values. Return fixed code as JSON with filesChanged and summary fields.`,
    gemini: `You are a reorganization specialist. Rewrite or restructure the following to fix the issue.\nTask: ${taskGoal}\nFailureType: ${failureType}\nError:\n${errorSnippet}\nNo sensitive data.`,
    grok:   `You are a breakthrough analyst. The normal approach failed. Provide an alternative solution.\nTask: ${taskGoal}\nFailureType: ${failureType}\nError:\n${errorSnippet}\nNo confidential data.`,
    kosame: `こさめ副社長として判断してください。\nタスク: ${taskGoal}\n失敗タイプ: ${failureType}\nエラー:\n${errorSnippet}\n修正方針をJSON形式で返してください。`,
    human:  `Human review required.\nTask: ${taskGoal}\nFailureType: ${failureType}\nError:\n${errorSnippet}\nPlease decide: retry / escalate / cancel. Provide final YES/NO with reasoning.`
  };
  return prompts[repairProvider] || prompts.kosame;
}

function buildRepairSteps(failureType, repairProvider, attempt, maxRetries) {
  return [
    { step: 1, action: 'Capture full error output', owner: 'cloudShell', auto: true },
    { step: 2, action: `Dispatch repair prompt to ${repairProvider}`, owner: repairProvider, auto: repairProvider !== 'kosame' && repairProvider !== 'human' },
    { step: 3, action: 'Apply fix to codebase', owner: repairProvider, auto: false },
    { step: 4, action: 'Run node --check on changed files', owner: 'cloudShell', auto: true },
    { step: 5, action: 'Run npm run verify', owner: 'cloudShell', auto: true },
    { step: 6, action: `Evaluate result (attempt ${attempt}/${maxRetries})`, owner: 'cloudShell', auto: true },
    { step: 7, action: attempt >= maxRetries ? 'Escalate to kosame — max retries reached' : 'Loop back if still failing', owner: attempt >= maxRetries ? 'kosame' : 'system', auto: attempt < maxRetries }
  ];
}

function generateRepairId(failureType, taskGoal) {
  const ts = Date.now();
  const slug = String(taskGoal || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `repair-${failureType}-${slug}-${ts}`;
}

function buildPacket(input) {
  const failureType    = FAILURE_TYPES.includes(input.failureType) ? input.failureType : 'unknown_failure';
  const errorOutput    = input.errorOutput    || '(no error output)';
  const taskGoal       = String(input.taskGoal       || '(task goal)').trim();
  const taskType       = String(input.taskType       || 'implementation');
  const productLine    = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const currentProvider = PROVIDERS.includes(input.provider) ? input.provider : 'claude';
  const attempt        = Math.max(1, parseInt(input.attempt, 10) || 1);
  const maxRetries     = productLine === 'anesty_board' ? 1 : 3;

  const repairId     = generateRepairId(failureType, taskGoal);
  const repairRoute  = routeRepair(failureType, currentProvider);
  const repairPrompt = buildRepairPrompt(failureType, errorOutput, taskGoal, repairRoute.repairProvider);
  const repairSteps  = buildRepairSteps(failureType, repairRoute.repairProvider, attempt, maxRetries);

  const escalationRequired = attempt >= maxRetries ||
    failureType === 'safety_block' ||
    failureType === 'human_approval_required' ||
    failureType === 'unclear_spec' ||
    failureType === 'spec_issue';

  const recommendedNextAction = escalationRequired
    ? `Escalate to ${repairRoute.escalationProvider} — ${attempt >= maxRetries ? 'max retries reached' : 'requires human judgment'}`
    : `Dispatch repair prompt to ${repairRoute.repairProvider} (attempt ${attempt}/${maxRetries})`;

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    repairId,
    failureType,
    taskGoal,
    taskType,
    productLine,
    currentProvider,
    attempt,
    maxRetries,
    escalationRequired,
    repairRoute,
    repairPrompt,
    repairSteps,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    failureType:   process.env.KOSAME_FAILURE_TYPE   || 'syntax_error',
    errorOutput:   process.env.KOSAME_ERROR_OUTPUT   || 'SyntaxError: Unexpected token } at line 42',
    taskGoal:      process.env.KOSAME_TASK_GOAL      || 'implement release note generator',
    taskType:      process.env.KOSAME_TASK_TYPE      || 'implementation',
    productLine:   process.env.KOSAME_PRODUCT_LINE   || 'backoffice',
    provider:      process.env.KOSAME_PROVIDER       || 'claude',
    attempt:       process.env.KOSAME_ATTEMPT        || '1'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  PROVIDERS,
  FAILURE_TYPES,
  BLOCKED_DANGEROUS_ACTIONS,
  REPAIR_ROUTING_TABLE,
  PROVIDER_FALLBACK_CHAINS,
  routeRepair,
  buildRepairPrompt,
  buildRepairSteps,
  generateRepairId,
  buildPacket
};
