'use strict';

const TOOL_META = {
  version: '7.2.0',
  title: 'Task Execution Packet Generator',
  slug: 'task-execution-packet-generator-pack'
};

const PRODUCT_LINES = [
  'sales_dx', 'email_reply', 'ai_bot', 'backoffice', 'anesty_board', 'cloud_run_launch_pack'
];

const TASK_TYPES = [
  'implementation', 'draft', 'strategy', 'review', 'repair', 'release', 'bugfix', 'docs', 'bulk'
];

const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const DATA_LEVELS = ['A', 'B', 'C'];

const PROVIDERS = ['claude', 'gemini', 'grok', 'deepseek', 'kimi', 'kosame', 'human'];

const BLOCKED_DANGEROUS_ACTIONS = [
  'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard', 'git clean',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance policy sharing',
  'health check info sharing', 'personal name in minutes sharing'
];

const ALWAYS_DENIED_FILES = [
  '.env', '.env.*', '*.pem', '*.key', 'secrets/**', 'credentials/**',
  '**/node_modules/**', '.git/**', 'Dockerfile', 'cloud-run/**',
  'apps/pm-agent/**'
];

const PRODUCT_LINE_ALLOWED_PATTERNS = {
  sales_dx:              ['tools/sales_dx/**', 'smoke/dev-agent-sales*', 'fixtures/sales*', 'docs/ai-dev-team/*sales*'],
  email_reply:           ['tools/email_reply/**', 'smoke/dev-agent-email*', 'fixtures/email*', 'docs/ai-dev-team/*email*'],
  ai_bot:                ['tools/ai_bot/**', 'smoke/dev-agent-ai-bot*', 'fixtures/ai-bot*', 'docs/ai-dev-team/*ai-bot*'],
  backoffice:            ['tools/**', 'smoke/**', 'fixtures/**', 'docs/ai-dev-team/**'],
  anesty_board:          ['tools/anesty*', 'smoke/dev-agent-anesty*', 'fixtures/anesty*', 'docs/ai-dev-team/*anesty*'],
  cloud_run_launch_pack: ['tools/pm-agent*', 'tools/cloud-run*', 'smoke/dev-agent-cloud*', 'docs/ai-dev-team/*cloud*']
};

const PRODUCT_LINE_DENIED_FILES = {
  anesty_board: ['tools/provider*', 'tools/gemini*', 'tools/grok*', 'tools/deepseek*', 'tools/kimi*']
};

function buildAllowedFiles(taskType, productLine, repoPath) {
  const base = (PRODUCT_LINE_ALLOWED_PATTERNS[productLine] || PRODUCT_LINE_ALLOWED_PATTERNS.backoffice).map(
    p => `${repoPath || '.'}/${p}`
  );
  if (taskType === 'release') {
    base.push(`${repoPath || '.'}/package.json`);
  }
  if (taskType === 'docs' || taskType === 'draft') {
    return base.filter(p => p.includes('docs') || p.includes('fixtures'));
  }
  return base;
}

function buildDeniedFiles(productLine, repoPath) {
  const root = repoPath || '.';
  const always = ALWAYS_DENIED_FILES.map(f => `${root}/${f}`);
  const productSpecific = (PRODUCT_LINE_DENIED_FILES[productLine] || []).map(f => `${root}/${f}`);
  return [...always, ...productSpecific];
}

function buildVerifyCommands(taskType, productLine) {
  const cmds = [
    { command: 'node --check {newFiles}', description: 'Syntax check all new/modified JS files', required: true },
    { command: 'npm run smoke:{packSlug}', description: 'Run specific smoke test for this pack', required: true },
    { command: 'npm run verify', description: 'Run full verification suite', required: true },
    { command: 'git diff --stat HEAD', description: 'Confirm non-empty diff', required: true },
    { command: 'git status --short', description: 'Confirm clean working tree (no untracked junk)', required: true }
  ];
  if (taskType === 'release') {
    cmds.push({ command: 'Human Approval required before git tag / deploy', description: 'Release gate', required: true });
  }
  if (productLine === 'anesty_board') {
    cmds.push({ command: 'Data level C check — confirm no external provider used', description: 'ANESTY Board safety gate', required: true });
  }
  return cmds;
}

function buildDoneCriteria(taskGoal, taskType, productLine) {
  const base = [
    'All new JS files pass node --check',
    'Smoke test for this pack passes',
    'npm run verify passes without errors',
    'git diff --stat HEAD is non-empty',
    'No new secrets or .env values exposed',
    `Task goal completed: ${taskGoal}`
  ];
  if (taskType === 'implementation' || taskType === 'bugfix' || taskType === 'repair') {
    base.push('New tool file created and exported correctly');
    base.push('Fixture file exists and is valid JSON');
  }
  if (taskType === 'docs' || taskType === 'draft') {
    base.push('Documentation file created in docs/ai-dev-team/');
    base.push('Release record file exists');
  }
  if (taskType === 'release') {
    base.push('package.json version updated');
    base.push('Human approval received before commit/tag');
  }
  if (productLine === 'anesty_board') {
    base.push('No external provider used — kosame or human only');
  }
  return base;
}

function buildForbiddenActions(taskType, riskLevel, dataLevel) {
  const base = [...BLOCKED_DANGEROUS_ACTIONS];
  if (riskLevel === 'high' || riskLevel === 'critical') {
    base.push('auto-dispatch without human review');
    base.push('multi-file bulk edit without per-file confirmation');
  }
  if (dataLevel === 'C') {
    base.push('dispatch to any external AI provider');
    base.push('copy Level C data to public or shared system');
  }
  if (taskType === 'release') {
    base.push('increment version without human approval');
    base.push('push to main without kosame sign-off');
  }
  return [...new Set(base)];
}

function buildReportFormat(provider, taskType) {
  return {
    format: 'JSON',
    requiredFields: ['status', 'summary', 'filesChanged', 'verifyResult', 'issues', 'nextAction'],
    statusValues: ['success', 'failure', 'incomplete', 'needs_repair', 'pending_approval'],
    exampleStructure: {
      status: 'success',
      summary: 'Brief description of what was done',
      filesChanged: ['tools/example-pack.js', 'smoke/dev-agent-example-smoke.js'],
      verifyResult: 'npm run verify PASS',
      issues: [],
      nextAction: 'Route to kosame for final review'
    },
    provider,
    taskType
  };
}

function generatePacketId(taskGoal, taskType) {
  const ts = Date.now();
  const slug = String(taskGoal).toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `exec-${slug}-${taskType}-${ts}`;
}

function buildPacket(input) {
  const taskGoal    = String(input.taskGoal    || '(task goal)').trim();
  const taskType    = TASK_TYPES.includes(input.taskType)       ? input.taskType    : 'implementation';
  const productLine = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const riskLevel   = RISK_LEVELS.includes(input.riskLevel)     ? input.riskLevel   : 'low';
  const dataLevel   = DATA_LEVELS.includes(input.dataLevel)     ? input.dataLevel   : 'A';
  const provider    = PROVIDERS.includes(input.provider)        ? input.provider    : 'claude';
  const repoPath    = String(input.repoPath || '.');

  const packetId       = generatePacketId(taskGoal, taskType);
  const allowedFiles   = buildAllowedFiles(taskType, productLine, repoPath);
  const deniedFiles    = buildDeniedFiles(productLine, repoPath);
  const verifyCommands = buildVerifyCommands(taskType, productLine);
  const doneCriteria   = buildDoneCriteria(taskGoal, taskType, productLine);
  const forbiddenActions = buildForbiddenActions(taskType, riskLevel, dataLevel);
  const reportFormat   = buildReportFormat(provider, taskType);

  const dataLevelNote = dataLevel === 'C'
    ? 'Level C data: kosame or human only — no external provider dispatch'
    : dataLevel === 'B'
      ? 'Level B data: claude allowed, gemini/grok require anonymization'
      : 'Level A data: all providers allowed (anonymize before dispatch to deepseek/kimi)';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    packetId,
    taskGoal,
    taskType,
    productLine,
    riskLevel,
    dataLevel,
    provider,
    repoPath,
    allowedFiles,
    deniedFiles,
    verifyCommands,
    doneCriteria,
    forbiddenActions,
    reportFormat,
    dataLevelNote,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction: `Execute task using ${provider}. Complete all verifyCommands. Report in JSON format.`
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    taskGoal:    process.env.KOSAME_TASK_GOAL    || 'implement release note generator',
    taskType:    process.env.KOSAME_TASK_TYPE    || 'implementation',
    productLine: process.env.KOSAME_PRODUCT_LINE || 'backoffice',
    riskLevel:   process.env.KOSAME_RISK_LEVEL   || 'low',
    dataLevel:   process.env.KOSAME_DATA_LEVEL   || 'A',
    provider:    process.env.KOSAME_PROVIDER     || 'claude',
    repoPath:    process.env.KOSAME_REPO_PATH    || '.'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  PRODUCT_LINES,
  TASK_TYPES,
  RISK_LEVELS,
  DATA_LEVELS,
  PROVIDERS,
  BLOCKED_DANGEROUS_ACTIONS,
  ALWAYS_DENIED_FILES,
  buildAllowedFiles,
  buildDeniedFiles,
  buildVerifyCommands,
  buildDoneCriteria,
  buildForbiddenActions,
  buildReportFormat,
  generatePacketId,
  buildPacket
};
