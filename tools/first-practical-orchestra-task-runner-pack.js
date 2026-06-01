'use strict';

const TOOL_META = {
  version: '11.0.0',
  title: 'First Practical Orchestra Task Runner',
  slug: 'first-practical-orchestra-task-runner-pack'
};

const probePack = require('./full-orchestra-runtime-probe-console-pack');

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const DEFAULT_ALLOWED_FILES = [
  './tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'
];

const DEFAULT_DENIED_FILES = [
  './.env', './.env.*', './*.pem', './*.key',
  './secrets/**', './credentials/**', './**/node_modules/**',
  './.git/**', './Dockerfile', './cloud-run/**', './apps/pm-agent/**'
];

function generateRunnerId() {
  return `runner-${Date.now()}`;
}

function buildProviderPromptPackets(opts) {
  const { taskGoal, productLine, allowedFiles, deniedFiles } = opts;

  const geminiPacket = {
    provider: 'gemini',
    role: '仕様整理 / docs観点 / 構成案',
    canEditRepo: false,
    dryRun: true,
    prompt: [
      'You are a spec and documentation specialist.',
      `Task: ${taskGoal}`,
      `ProductLine: ${productLine}`,
      'Provide: spec clarification, README structure proposal, fixture candidates.',
      'Do NOT edit the repo directly. No customer data.'
    ].join('\n'),
    responsibilities: ['spec clarification', 'docs review', 'structure proposal', 'fixture candidates'],
    note: 'Gemini must not edit repo. Text output only.'
  };

  const grokPacket = {
    provider: 'grok',
    role: '弱点指摘 / YES地獄防止 / 実用性チェック',
    canEditRepo: false,
    dryRun: true,
    prompt: [
      'You are a weakness detector and YES-hell prevention specialist.',
      `Task: ${taskGoal}`,
      `ProductLine: ${productLine}`,
      'Provide: weakness list, YES-hell prevention checks, practical feasibility notes.',
      'No confidential data. Do NOT edit the repo.'
    ].join('\n'),
    responsibilities: ['weakness detection', 'yes-hell prevention', 'practical feasibility check'],
    note: 'Grok must not edit repo. Text output only.'
  };

  const claudePacket = {
    provider: 'claude',
    role: '実装担当。ただしv11.0.0 runnerでは編集せず、指示packet生成まで',
    canEditRepo: true,
    dryRun: true,
    prompt: [
      'You are a precise implementation engineer.',
      `Task: ${taskGoal}`,
      `ProductLine: ${productLine}`,
      'This is a dry-run runner. Do NOT edit files yet.',
      'Generate the implementation instruction packet only.',
      'Do not read secrets, .env, or API key values.'
    ].join('\n'),
    allowedFiles: allowedFiles || DEFAULT_ALLOWED_FILES,
    deniedFiles:  deniedFiles  || DEFAULT_DENIED_FILES,
    verifyCommands: [
      { command: 'node --check {newFiles}',  description: 'Syntax check all new/modified JS files', required: true },
      { command: 'npm run smoke:{packSlug}', description: 'Run specific smoke test',                required: true },
      { command: 'npm run verify',           description: 'Run full verification suite',            required: true },
      { command: 'git diff --stat HEAD',     description: 'Confirm non-empty diff',                required: true },
      { command: 'git status --short',       description: 'Confirm clean working tree',            required: true }
    ],
    doneCriteria: [
      'All new JS files pass node --check',
      'Smoke test for this pack passes',
      'npm run verify passes without errors',
      'git diff --stat HEAD is non-empty',
      `Task goal completed: ${taskGoal}`,
      'No new secrets or .env values exposed'
    ],
    note: 'Claude is the only agent allowed to edit repo. In v11.0.0 runner, do not edit yet — generate instruction packet only.'
  };

  const kosamePacket = {
    provider: 'kosame',
    role: '統合 / 安全ゲート / 最終判断',
    canEditRepo: false,
    dryRun: true,
    prompt: [
      'こさめ副社長として、以下タスクの統合・安全ゲート判断をしてください。',
      `タスク: ${taskGoal}`,
      `ProductLine: ${productLine}`,
      '判断結果をJSON形式で返してください。repoは触らないでください。'
    ].join('\n'),
    responsibilities: ['integration', 'safety gate', 'final judgment', 'adopt/reject'],
    note: 'こさめは統合・安全ゲート。repoを直接編集しない。'
  };

  const humanApprovalPacket = {
    provider: 'human',
    role: 'じゅんやさん final YES only',
    canEditRepo: true,
    dryRun: false,
    commitGate: { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit じゅんやさん YES' },
    pushGate:   { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit じゅんやさん YES' },
    tagGate:    { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit じゅんやさん YES' },
    deployGate: { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit じゅんやさん YES' },
    approver: 'じゅんやさん',
    note: 'じゅんやさんは最終YESのみ。作業員に戻さない。commit / push / tag / deploy はここで止まる。'
  };

  return { geminiPacket, grokPacket, claudePacket, kosamePacket, humanApprovalPacket };
}

function buildVerificationPlan(taskGoal) {
  return {
    steps: [
      { step: 'node --check on new JS files',    required: true, category: 'syntax' },
      { step: 'npm run smoke for new packs',      required: true, category: 'smoke' },
      { step: 'npm run verify (full suite)',       required: true, category: 'verify' },
      { step: 'git diff --stat HEAD (non-empty)', required: true, category: 'git status' },
      { step: 'git status --short (clean)',       required: true, category: 'git status' }
    ],
    humanApprovalRequired: true,
    note: `Verification plan for: ${taskGoal}`
  };
}

function buildRunner(input) {
  const taskRunnerId  = input.taskRunnerId || generateRunnerId();
  const projectName   = String(input.projectName   || '(unnamed)');
  const repoPath      = String(input.repoPath      || '.');
  const taskGoal      = String(input.taskGoal      || '(task goal)').trim();
  const productLine   = String(input.productLine   || 'backoffice');
  const taskType      = String(input.taskType      || 'docs');
  const riskLevel     = String(input.riskLevel     || 'low');
  const dataLevel     = String(input.dataLevel     || 'A');
  const currentStatus = String(input.currentStatus || '');
  const targetFiles   = input.targetFiles   || ['README.md'];
  const allowedFiles  = input.allowedFiles  || DEFAULT_ALLOWED_FILES;
  const deniedFiles   = input.deniedFiles   || DEFAULT_DENIED_FILES;
  const providerStatus = input.providerStatus || {};
  const runMode       = String(input.runMode       || 'dry-run');

  const runtimeProbePacket = probePack.buildProbe({
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, currentStatus,
    geminiResult:  null,
    grokResult:    null,
    claudeResult:  null,
    providerStatus,
    probeMode: 'dry-run'
  });

  const practicalTaskPacket = {
    taskRunnerId,
    projectName,
    repoPath,
    taskGoal,
    productLine,
    taskType,
    riskLevel,
    dataLevel,
    currentStatus,
    targetFiles,
    representativeTask: 'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加するための作業パケットを作る',
    dryRun: true,
    humanApprovalRequired: true,
    noRealFileEdit: true,
    noRealApiExecution: true,
    runMode,
    note: 'dry-run task runner. No real file edits. No real API calls. Generates instruction packets only.'
  };

  const providerPromptPackets = buildProviderPromptPackets({ taskGoal, productLine, taskType, allowedFiles, deniedFiles });

  const verificationPlan = buildVerificationPlan(taskGoal);

  const approvalPacket = {
    requestedBy: 'first-practical-orchestra-task-runner',
    projectName,
    productLine,
    riskLevel,
    dataLevel,
    taskGoal,
    commitGate: { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit human YES' },
    pushGate:   { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit human YES' },
    tagGate:    { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit human YES' },
    deployGate: { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit human YES' },
    approver: 'じゅんやさん (final YES only — does not return to worker)',
    humanApprovalRequired: true,
    generatedAt: new Date().toISOString()
  };

  const rollbackNote = [
    'dry-run runner — no actual file edits were made.',
    'If implementation proceeds and fails: revert with git checkout -- <files>.',
    'git reset --hard HEAD requires explicit human approval.',
    'All rollback actions require じゅんやさん YES.'
  ].join(' ');

  const runnerPassed = runtimeProbePacket.probePassed;

  const recommendedNextAction = runnerPassed
    ? 'Runner passed — present providerPromptPackets to each provider. Await results. Route to kosame for integration.'
    : 'Runner failed — probe console did not pass. Check runtimeProbePacket for details.';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    taskRunnerId,
    runtimeProbePacket,
    practicalTaskPacket,
    providerPromptPackets,
    verificationPlan,
    approvalPacket,
    rollbackNote,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction,
    runnerPassed
  };
}

function main() {
  console.log(JSON.stringify(buildRunner({
    projectName:    process.env.KOSAME_PROJECT_NAME    || 'kosame-dev-orchestra',
    repoPath:       process.env.KOSAME_REPO_PATH       || '.',
    taskGoal:       'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
    productLine:    process.env.KOSAME_PRODUCT_LINE    || 'backoffice',
    taskType:       'docs',
    riskLevel:      'low',
    dataLevel:      'A',
    currentStatus:  'git clean, smoke passing',
    targetFiles:    ['README.md'],
    allowedFiles:   DEFAULT_ALLOWED_FILES,
    deniedFiles:    DEFAULT_DENIED_FILES,
    providerStatus: {},
    runMode:        'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  DEFAULT_ALLOWED_FILES,
  DEFAULT_DENIED_FILES,
  buildRunner
};
