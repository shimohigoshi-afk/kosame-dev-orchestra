'use strict';

const TOOL_META = {
  version: '87.0.0',
  title: 'KOSAME Dev Orchestra GPT Task Prompt Builder Pack',
  slug: 'dev-agent-gpt-task-prompt-builder-pack'
};

const FORBIDDEN_COMMANDS = [
  'git add',
  'git commit',
  'git push',
  'git tag',
  'gcloud deploy',
  'gcloud run deploy',
  'docker build',
  'rm -rf',
  'cat .env',
  'printenv',
  'secret read'
];

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

function buildGptTaskPromptBuilder(input = {}) {
  const selectedTask = input.selectedTask || {
    taskId: 'task-v86-v90-safe-pack',
    title: 'Build semi-autonomous operation line',
    product: 'kosame_dev_orchestra',
    riskLevel: 'LOW'
  };

  const promptText = [
    `Task: ${selectedTask.title}`,
    'You are GPT Agent inside KOSAME Dev Orchestra.',
    'Prepare implementation guidance or safe shell-ready code only when requested.',
    'Preserve package.json verify chain; append only.',
    'Do not use simulated verification.',
    'Do not touch secrets, .env, customer data, external repos, node, or kosame-dev-orchestra@14.0.0.',
    'Do not run git add/commit/push/tag.',
    'Require real node --check, target smoke, and npm run verify logs.'
  ].join('\n');

  return {
    gptTaskPromptBuilderId: input.gptTaskPromptBuilderId || 'gpt-task-prompt-builder-v87',
    selectedTask,
    promptText,
    inputFileSupported: true,
    inputFileRunnerTargets: [
      'tools/agent-runner-local.js',
      'tools/agent-live-call-one-shot.js'
    ],
    allowedFiles: ['package.json', 'tools/', 'smoke/', 'fixtures/', 'docs/ai-dev-team/'],
    forbiddenFiles: ['.env', 'node', 'kosame-dev-orchestra@14.0.0', '/home/shimohigoshi/anesty-board'],
    allowedCommands: ['node --check', 'npm run smoke:<target>', 'npm run verify', 'git status --short'],
    forbiddenCommands: FORBIDDEN_COMMANDS,
    verificationCommands: ['node --check <new files>', 'npm run smoke:<new smoke>', 'npm run verify'],
    doneCriteria: ['real logs provided', 'verify passed', 'no dangerous actions', 'git status reported'],
    commitStopRule: 'git add / commit / push / tag are forbidden; wait for KOSAME Acceptance Gate and Junya final YES.',
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildGptTaskPromptBuilder(), null, 2));
}

module.exports = {
  TOOL_META,
  FORBIDDEN_COMMANDS,
  DANGEROUS_ACTIONS_DENIED,
  buildGptTaskPromptBuilder
};
