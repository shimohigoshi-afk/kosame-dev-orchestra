'use strict';

const TOOL_META = {
  version: '12.0.0',
  title: 'First Real Docs Task Packet',
  slug: 'first-real-docs-task-packet-pack'
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const DEFAULT_TARGET_FILES = ['README.md'];

const DEFAULT_ALLOWED_FILES = [
  './tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'
];

const DEFAULT_DENIED_FILES = [
  './.env', './.env.*', './*.pem', './*.key',
  './secrets/**', './credentials/**', './**/node_modules/**',
  './.git/**', './Dockerfile', './cloud-run/**', './apps/pm-agent/**'
];

function generateDocsTaskPacketId(taskId, projectName) {
  const ts   = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 16);
  return `docs-task-${taskId || slug}-${ts}`;
}

function buildProviderPromptPackets(taskGoal, productLine, allowedFiles, deniedFiles) {
  return {
    geminiPacket: {
      provider: 'gemini',
      role: '構成案 / 見出し案 / docs観点',
      canEditRepo: false,
      dryRun: true,
      prompt: [
        'You are a documentation structure specialist.',
        `Task: ${taskGoal}`,
        `ProductLine: ${productLine}`,
        'Provide: README section structure, heading proposals, content outline.',
        'Do NOT edit the repo directly. No customer data.'
      ].join('\n')
    },
    grokPacket: {
      provider: 'grok',
      role: '弱点指摘 / 読み手の詰まり確認',
      canEditRepo: false,
      dryRun: true,
      prompt: [
        'You are a documentation weakness detector.',
        `Task: ${taskGoal}`,
        `ProductLine: ${productLine}`,
        'Provide: clarity issues, reader pain points, missing sections.',
        'No confidential data. Do NOT edit the repo.'
      ].join('\n')
    },
    claudePacket: {
      provider: 'claude',
      role: '実装候補。このpackでは編集しない',
      canEditRepo: true,
      dryRun: true,
      allowedFiles: allowedFiles || DEFAULT_ALLOWED_FILES,
      deniedFiles:  deniedFiles  || DEFAULT_DENIED_FILES,
      prompt: [
        'You are a precise implementation engineer.',
        `Task: ${taskGoal}`,
        `ProductLine: ${productLine}`,
        'This is a docs task packet. Do NOT edit files in this pack.',
        'Generate the implementation plan only.',
        'Do not read secrets, .env, or API key values.'
      ].join('\n'),
      note: 'Claude is the only agent allowed to edit repo. In this pack, do not edit — plan only.'
    },
    kosamePacket: {
      provider: 'kosame',
      role: '統合 / 安全ゲート',
      canEditRepo: false,
      dryRun: true,
      prompt: [
        'こさめ副社長として、以下docsタスクの統合・安全ゲート判断をしてください。',
        `タスク: ${taskGoal}`,
        `ProductLine: ${productLine}`,
        '判断結果をJSON形式で返してください。'
      ].join('\n')
    },
    humanApprovalPacket: {
      provider: 'human',
      role: 'じゅんやさん final YES only',
      canEditRepo: true,
      dryRun: false,
      commitGate: { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit じゅんやさん YES' },
      pushGate:   { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit じゅんやさん YES' },
      tagGate:    { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit じゅんやさん YES' },
      deployGate: { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit じゅんやさん YES' },
      note: 'じゅんやさんは最終YESのみ。作業員に戻さない。'
    }
  };
}

function buildDocsTaskPacket(input) {
  const taskId              = String(input.taskId          || 'docs-001');
  const projectName         = String(input.projectName     || '(unnamed)');
  const repoPath            = String(input.repoPath        || '.');
  const taskGoal            = String(input.taskGoal        || '(docs task goal)').trim();
  const productLine         = String(input.productLine     || 'backoffice');
  const taskType            = String(input.taskType        || 'docs');
  const riskLevel           = String(input.riskLevel       || 'low');
  const dataLevel           = String(input.dataLevel       || 'A');
  const targetFiles         = input.targetFiles   || DEFAULT_TARGET_FILES;
  const allowedFiles        = input.allowedFiles  || DEFAULT_ALLOWED_FILES;
  const deniedFiles         = input.deniedFiles   || DEFAULT_DENIED_FILES;
  const currentStatus       = String(input.currentStatus   || '');
  const expectedDocSections = input.expectedDocSections    || [];

  const docsTaskPacketId = generateDocsTaskPacketId(taskId, projectName);

  const normalizedDocsTask = {
    taskId,
    taskGoal,
    taskType,
    productLine,
    riskLevel,
    dataLevel,
    isDocsTask:         true,
    noRealFileEdit:     true,
    noRealApiExecution: true
  };

  const targetFilePlan = targetFiles.map(f => ({
    file:        f,
    editAllowed: allowedFiles.some(a => a.includes('README') || a.endsWith('**')) || allowedFiles.includes(f),
    note:        'low-risk docs file'
  }));

  const allowedEditPlan = {
    files: allowedFiles,
    note:  'Only these files may be edited after human approval'
  };

  const deniedEditPlan = {
    files:   deniedFiles,
    blocked: true,
    note:    'These files must never be edited'
  };

  const providerPromptPackets = buildProviderPromptPackets(taskGoal, productLine, allowedFiles, deniedFiles);

  const verificationPlan = {
    steps: [
      { step: 'node --check on new JS files',    required: true, category: 'syntax' },
      { step: 'npm run smoke for new packs',      required: true, category: 'smoke' },
      { step: 'npm run verify (full suite)',       required: true, category: 'verify' },
      { step: 'git diff --stat HEAD (non-empty)', required: true, category: 'git status' },
      { step: 'git status --short (clean)',       required: true, category: 'git status' }
    ],
    humanApprovalRequired: true
  };

  const approvalPacket = {
    requestedBy: 'first-real-docs-task-packet',
    projectName,
    productLine,
    riskLevel,
    dataLevel,
    taskGoal,
    commitGate: { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit human YES' },
    pushGate:   { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit human YES' },
    tagGate:    { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit human YES' },
    deployGate: { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit human YES' },
    approver:   'じゅんやさん (final YES only)',
    humanApprovalRequired: true,
    generatedAt: new Date().toISOString()
  };

  const rollbackNote = [
    'This is a docs task packet. No actual file edits were made.',
    'If implementation proceeds and fails: git checkout -- README.md.',
    'git reset --hard HEAD requires explicit human approval.'
  ].join(' ');

  const recommendedNextAction = 'Route providerPromptPackets to each provider. Then send claudePacket to v12.5.0 Claude Execution Prompt Exporter.';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    docsTaskPacketId,
    normalizedDocsTask,
    targetFilePlan,
    allowedEditPlan,
    deniedEditPlan,
    providerPromptPackets,
    verificationPlan,
    approvalPacket,
    rollbackNote,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildDocsTaskPacket({
    taskId:       'docs-001',
    projectName:  'kosame-dev-orchestra',
    repoPath:     '.',
    taskGoal:     'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtime / v11.0.0 First Practical Orchestra Task Runnerの説明を追加する',
    productLine:  'backoffice',
    taskType:     'docs',
    riskLevel:    'low',
    dataLevel:    'A',
    targetFiles:  ['README.md'],
    currentStatus: 'git clean, smoke passing',
    expectedDocSections: [
      '## Overview',
      '## v10.0.0 Full Orchestra Agent Runtime',
      '## v11.0.0 First Practical Orchestra Task Runner'
    ]
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  DEFAULT_TARGET_FILES,
  DEFAULT_ALLOWED_FILES,
  DEFAULT_DENIED_FILES,
  buildDocsTaskPacket
};
