'use strict';

const TOOL_META = {
  version: '13.0.0',
  title: 'First End-to-End Dry Run Console',
  slug: 'first-end-to-end-dry-run-console-pack'
};

const usageConsolePack = require('./task-runner-usage-console-pack');
const docsTaskPack     = require('./first-real-docs-task-packet-pack');
const exporterPack     = require('./claude-execution-prompt-exporter-pack');

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

function generateDryRunConsoleId(projectName) {
  const ts   = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `e2e-${slug}-${ts}`;
}

function buildEndToEndConsole(input) {
  const projectName    = String(input.projectName    || '(unnamed)');
  const repoPath       = String(input.repoPath       || '.');
  const taskGoal       = String(input.taskGoal       || '(task goal)').trim();
  const productLine    = String(input.productLine    || 'backoffice');
  const taskType       = String(input.taskType       || 'docs');
  const riskLevel      = String(input.riskLevel      || 'low');
  const dataLevel      = String(input.dataLevel      || 'A');
  const targetFiles    = input.targetFiles   || ['README.md'];
  const allowedFiles   = input.allowedFiles  || docsTaskPack.DEFAULT_ALLOWED_FILES;
  const deniedFiles    = input.deniedFiles   || docsTaskPack.DEFAULT_DENIED_FILES;
  const providerStatus = input.providerStatus || {};
  const currentStatus  = String(input.currentStatus  || '');
  const endToEndMode   = String(input.endToEndMode   || 'dry-run');

  const dryRunConsoleId = generateDryRunConsoleId(projectName);

  // Step 1: v11.5.0 Task Runner Usage Console
  const usageConsolePacket = usageConsolePack.buildUsageConsole({
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, targetFiles, allowedFiles, deniedFiles,
    providerStatus, usageMode: 'dry-run'
  });

  // Step 2: v12.0.0 First Real Docs Task Packet
  const docsTaskPacket = docsTaskPack.buildDocsTaskPacket({
    taskId: 'e2e-docs-001',
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, targetFiles, allowedFiles, deniedFiles,
    currentStatus, expectedDocSections: []
  });

  // Step 3: v12.5.0 Claude Execution Prompt Exporter
  const claudeExecutionPromptPacket = exporterPack.buildExporter({
    docsTaskPacket,
    repoStatus: currentStatus || 'git clean',
    implementationMode: 'dry-run',
    allowedFiles, deniedFiles
  });

  const providerPromptPackets = docsTaskPacket.providerPromptPackets;

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

  const finalApprovalPacket = {
    requestedBy: 'first-end-to-end-dry-run-console',
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
    'End-to-end dry-run console. No actual file edits were made.',
    'If implementation proceeds and fails: git checkout -- <files>.',
    'All rollback actions require じゅんやさん YES.'
  ].join(' ');

  const readmeDocsTaskIncluded = targetFiles.includes('README.md');

  const endToEndSummary = {
    usageConsolePassed:      usageConsolePacket.usagePassed,
    docsTaskPacketGenerated: !!docsTaskPacket.docsTaskPacketId,
    claudePromptExported:    claudeExecutionPromptPacket.exportPassed,
    readmeDocsTaskIncluded,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    endToEndMode
  };

  const endToEndPassed = endToEndSummary.usageConsolePassed
    && endToEndSummary.docsTaskPacketGenerated
    && endToEndSummary.claudePromptExported;

  const recommendedNextAction = endToEndPassed
    ? 'End-to-end dry run passed — paste claudeExecutionPromptPacket.claudePrompt into Claude Code. Await result. Route to kosame.'
    : 'End-to-end dry run failed — check individual packet statuses in endToEndSummary';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    dryRunConsoleId,
    usageConsolePacket,
    docsTaskPacket,
    claudeExecutionPromptPacket,
    endToEndSummary,
    providerPromptPackets,
    verificationPlan,
    finalApprovalPacket,
    rollbackNote,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction,
    endToEndPassed
  };
}

function main() {
  console.log(JSON.stringify(buildEndToEndConsole({
    projectName:   'kosame-dev-orchestra',
    repoPath:      '.',
    taskGoal:      'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtime / v11.0.0 First Practical Orchestra Task Runnerの説明を追加する',
    productLine:   'backoffice',
    taskType:      'docs',
    riskLevel:     'low',
    dataLevel:     'A',
    targetFiles:   ['README.md'],
    providerStatus: {},
    currentStatus: 'git clean, smoke passing',
    endToEndMode:  'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  generateDryRunConsoleId,
  buildEndToEndConsole
};
