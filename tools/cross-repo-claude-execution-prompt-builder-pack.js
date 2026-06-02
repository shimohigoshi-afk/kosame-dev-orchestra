'use strict';

const TOOL_META = {
  version: '17.0.0',
  title: 'Cross-Repo Claude Execution Prompt Builder',
  slug: 'cross-repo-claude-execution-prompt-builder-pack'
};

const FORBIDDEN_ACTIONS = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'read .env', 'read secrets', 'read api key',
  'access customer data', 'access personal info'
];

const DEFAULT_VERIFY_COMMANDS = [
  'node --check <editedFile>',
  'npm run verify',
  'npm test',
  'git status --short',
  'git diff --stat HEAD'
];

const REPORT_FORMAT = {
  sections: ['diff summary', 'node --check result', 'verify result', 'smoke result', 'remaining risks'],
  format: 'JSON packet',
  handoffTarget: 'Post-Edit Verification Collector (v18.5.0)'
};

function buildAllowedFiles(productType, scope) {
  const base = ['./docs/**', './README.md'];
  const byProduct = {
    sales_dx:          ['./src/leads/**', './src/components/**', './tests/**'],
    anesty_board:      ['./src/board/**', './src/views/**', './tests/**'],
    backoffice_agent:  ['./src/agents/**', './src/handlers/**', './tests/**'],
    email_reply_bot:   ['./src/bot/**', './src/templates/**', './tests/**'],
    cloud_run_pm_agent: ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**']
  };
  return [...(byProduct[productType] || ['./src/**', './tests/**']), ...base];
}

function buildDeniedFiles(productType) {
  return [
    './.env', './.env.*',
    './secrets/**', './credentials/**',
    './config/production.*',
    './node_modules/**',
    './.git/**'
  ];
}

function buildPrompt(input) {
  const promptId       = `prompt-${Date.now()}`;
  const intakePacket   = input.intakePacket || {};
  const targetRepo     = String(input.targetRepo || intakePacket.targetRepoCandidate || '(repo)').trim();
  const productType    = String(input.productType || intakePacket.requestedProduct || 'unknown');
  const taskGoal       = String(input.taskGoal || intakePacket.taskGoal || '(task goal)').trim();
  const riskLevel      = String(input.riskLevel || intakePacket.riskLevel || 'low');
  const implementationScope = input.implementationScope || taskGoal;
  const verifyCommands = input.verifyCommands || DEFAULT_VERIFY_COMMANDS;
  const doneCriteria   = input.doneCriteria || [
    'All target files updated as specified',
    'node --check passes on all edited files',
    'npm run verify passes',
    'git status shows only intended files changed',
    'No secrets / .env / API keys read or modified'
  ];
  const rollbackPolicy = input.rollbackPolicy ||
    'git checkout -- <file> for individual files. git reset --hard requires explicit human approval.';

  const allowedFiles = input.allowedFiles || buildAllowedFiles(productType, implementationScope);
  const deniedFiles  = input.deniedFiles  || buildDeniedFiles(productType);

  const claudePrompt = [
    `# Claude Implementation Prompt`,
    `## Target Repo`,
    targetRepo,
    `## Task Goal`,
    taskGoal,
    `## Implementation Scope`,
    implementationScope,
    `## Allowed Files`,
    allowedFiles.map(f => `- ${f}`).join('\n'),
    `## Denied Files`,
    deniedFiles.map(f => `- ${f}`).join('\n'),
    `## Forbidden Actions`,
    FORBIDDEN_ACTIONS.map(a => `- ${a}`).join('\n'),
    `## Verify Commands`,
    verifyCommands.map(c => `- ${c}`).join('\n'),
    `## Done Criteria`,
    doneCriteria.map(c => `- ${c}`).join('\n'),
    `## Rollback Policy`,
    rollbackPolicy,
    `## Safety Rules`,
    '- dryRun: true (no real file edits without human YES)',
    '- humanApprovalRequired: true',
    '- No git add / commit / push / tag without explicit じゅんやさん YES',
    '- No secrets / .env / API key access',
    '- No deploy / docker build / gcloud deploy'
  ].join('\n\n');

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    promptId,
    targetRepo,
    productType,
    taskGoal,
    allowedFiles,
    deniedFiles,
    implementationScope,
    forbiddenActions: FORBIDDEN_ACTIONS,
    verifyCommands,
    doneCriteria,
    reportFormat: REPORT_FORMAT,
    rollbackPolicy,
    claudePrompt,
    noRealRepoEdit: true,
    noRealExecution: true
  };
}

function main() {
  const { buildIntakePacket } = require('./repo-task-intake-console-pack');
  const intakePacket = buildIntakePacket({
    requestedProduct: 'sales_dx',
    taskType: 'feature',
    taskGoal: '営業DXリード管理画面にCSVエクスポート機能を追加する'
  });
  console.log(JSON.stringify(buildPrompt({ intakePacket }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  FORBIDDEN_ACTIONS,
  DEFAULT_VERIFY_COMMANDS,
  REPORT_FORMAT,
  buildPrompt
};
