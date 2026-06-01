'use strict';

const TOOL_META = {
  version: '11.5.0',
  title: 'Task Runner Usage Console',
  slug: 'task-runner-usage-console-pack'
};

const runnerPack = require('./first-practical-orchestra-task-runner-pack');

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

function generateUsageConsoleId(projectName) {
  const ts   = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `usage-${slug}-${ts}`;
}

function buildRunnerPacketPresence(rp) {
  return {
    taskRunnerId:          !!(rp && rp.taskRunnerId),
    runtimeProbePacket:    !!(rp && rp.runtimeProbePacket),
    practicalTaskPacket:   !!(rp && rp.practicalTaskPacket),
    providerPromptPackets: !!(rp && rp.providerPromptPackets),
    verificationPlan:      !!(rp && rp.verificationPlan),
    approvalPacket:        !!(rp && rp.approvalPacket),
    rollbackNote:          !!(rp && rp.rollbackNote)
  };
}

function buildProviderPacketSummary(rp) {
  const ppp = rp && rp.providerPromptPackets;
  if (!ppp) return { available: false };
  return {
    available:     true,
    gemini:        !!(ppp.geminiPacket),
    grok:          !!(ppp.grokPacket),
    claude:        !!(ppp.claudePacket),
    kosame:        !!(ppp.kosamePacket),
    humanApproval: !!(ppp.humanApprovalPacket)
  };
}

function buildUsageConsole(input) {
  const projectName    = String(input.projectName    || '(unnamed)');
  const repoPath       = String(input.repoPath       || '.');
  const taskGoal       = String(input.taskGoal       || '(task goal)').trim();
  const productLine    = String(input.productLine    || 'backoffice');
  const taskType       = String(input.taskType       || 'docs');
  const riskLevel      = String(input.riskLevel      || 'low');
  const dataLevel      = String(input.dataLevel      || 'A');
  const targetFiles    = input.targetFiles   || ['README.md'];
  const allowedFiles   = input.allowedFiles  || runnerPack.DEFAULT_ALLOWED_FILES;
  const deniedFiles    = input.deniedFiles   || runnerPack.DEFAULT_DENIED_FILES;
  const providerStatus = input.providerStatus || {};
  const usageMode      = String(input.usageMode      || 'dry-run');

  const usageConsoleId = generateUsageConsoleId(projectName);

  let runnerPacket = null;
  let runnerError  = null;

  try {
    runnerPacket = runnerPack.buildRunner({
      projectName, repoPath, taskGoal, productLine, taskType,
      riskLevel, dataLevel, currentStatus: '',
      targetFiles, allowedFiles, deniedFiles, providerStatus,
      runMode: 'dry-run'
    });
  } catch (e) {
    runnerError = String(e.message || e);
  }

  const runnerPacketPresence  = buildRunnerPacketPresence(runnerPacket);
  const providerPacketSummary = buildProviderPacketSummary(runnerPacket);

  const verificationSummary = runnerPacket && runnerPacket.verificationPlan
    ? { present: true, stepCount: runnerPacket.verificationPlan.steps.length, humanApprovalRequired: true }
    : { present: false, humanApprovalRequired: true };

  const approvalGateSummary = {
    commitGate: { required: true, note: 'git commit requires explicit human YES' },
    pushGate:   { required: true, note: 'git push requires explicit human YES' },
    tagGate:    { required: true, note: 'git tag requires explicit human YES' },
    deployGate: { required: true, note: 'deploy requires explicit human YES' }
  };

  const inputSummary = {
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, usageMode,
    targetFilesCount: targetFiles.length
  };

  const usagePassed = runnerPacket !== null && runnerError === null && runnerPacket.runnerPassed === true;

  const recommendedNextAction = runnerError
    ? `Runner threw error: ${runnerError}`
    : !usagePassed
      ? 'Usage console failed — check runnerPacket for details'
      : 'Usage console passed — route runnerPacket to v12.0.0 First Real Docs Task Packet';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    usageConsoleId,
    runnerFunctionUsed: 'buildRunner',
    inputSummary,
    runnerPacketPresence,
    providerPacketSummary,
    verificationSummary,
    approvalGateSummary,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    usagePassed,
    runnerPacket
  };
}

function main() {
  console.log(JSON.stringify(buildUsageConsole({
    projectName:    process.env.KOSAME_PROJECT_NAME || 'kosame-dev-orchestra',
    repoPath:       process.env.KOSAME_REPO_PATH    || '.',
    taskGoal:       'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
    productLine:    'backoffice',
    taskType:       'docs',
    riskLevel:      'low',
    dataLevel:      'A',
    targetFiles:    ['README.md'],
    providerStatus: {},
    usageMode:      'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  generateUsageConsoleId,
  buildUsageConsole
};
