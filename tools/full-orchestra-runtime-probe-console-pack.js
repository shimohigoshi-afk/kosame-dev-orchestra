'use strict';

const TOOL_META = {
  version: '10.5.0',
  title: 'Full Orchestra Runtime Probe / Usage Console',
  slug: 'full-orchestra-runtime-probe-console-pack'
};

let runtimePack = null;
try {
  runtimePack = require('./full-orchestra-agent-runtime-pack');
} catch (_e) {
  runtimePack = null;
}

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const REQUIRED_PACKET_KEYS = [
  'orchestraId', 'planningPacket', 'parallelWorkPacket',
  'mergedReviewPacket', 'repairRetryPacket', 'finalRuntimePacket', 'finalApprovalPacket'
];

function generateProbeId(projectName) {
  const ts   = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `probe-${slug}-${ts}`;
}

function buildPacketPresence(rtp) {
  const presence = {};
  for (const key of REQUIRED_PACKET_KEYS) {
    presence[key] = rtp != null && rtp[key] != null && rtp[key] !== false;
  }
  return presence;
}

function buildProbe(input) {
  const projectName    = String(input.projectName    || '(unnamed)');
  const repoPath       = String(input.repoPath       || '.');
  const taskGoal       = String(input.taskGoal       || '(task goal)').trim();
  const productLine    = String(input.productLine    || 'backoffice');
  const taskType       = String(input.taskType       || 'implementation');
  const riskLevel      = String(input.riskLevel      || 'low');
  const dataLevel      = String(input.dataLevel      || 'A');
  const currentStatus  = String(input.currentStatus  || '');
  const geminiResult   = input.geminiResult  != null ? input.geminiResult  : null;
  const grokResult     = input.grokResult    != null ? input.grokResult    : null;
  const claudeResult   = input.claudeResult  != null ? input.claudeResult  : null;
  const providerStatus = input.providerStatus || {};
  const probeMode      = String(input.probeMode      || 'dry-run');

  const probeId = generateProbeId(projectName);

  let runtimePacket        = null;
  let buildPacketAvailable = false;
  let buildError           = null;

  if (runtimePack && typeof runtimePack.buildPacket === 'function') {
    buildPacketAvailable = true;
    try {
      runtimePacket = runtimePack.buildPacket({
        projectName, repoPath, taskGoal, productLine, taskType,
        riskLevel, dataLevel, currentStatus,
        geminiResult, grokResult, claudeResult, providerStatus
      });
    } catch (e) {
      buildError = String(e.message || e);
    }
  }

  const packetPresence = buildPacketPresence(runtimePacket);
  const allPresent     = Object.values(packetPresence).every(Boolean);

  const inputSummary = {
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, currentStatus, probeMode,
    geminiResultProvided: geminiResult !== null,
    grokResultProvided:   grokResult   !== null,
    claudeResultProvided: claudeResult !== null
  };

  const safetySummary = {
    dryRun: true,
    humanApprovalRequired: true,
    noRealApiExecution: true,
    noRealFileEdit: true,
    buildPacketAvailable,
    buildError: buildError || null,
    probeMode
  };

  const approvalGateSummary = {
    commitGate: { required: true, note: 'git commit requires explicit human YES' },
    pushGate:   { required: true, note: 'git push requires explicit human YES' },
    tagGate:    { required: true, note: 'git tag requires explicit human YES' },
    deployGate: { required: true, note: 'deploy requires explicit human YES' }
  };

  const probePassed = buildPacketAvailable && buildError === null && allPresent;

  const recommendedNextAction = !buildPacketAvailable
    ? 'buildPacket not available — check tools/full-orchestra-agent-runtime-pack.js'
    : buildError
      ? `buildPacket threw error: ${buildError}`
      : !allPresent
        ? 'packetPresence incomplete — missing required packets in runtimePacket'
        : 'Probe passed — route runtimePacket to v11.0.0 First Practical Orchestra Task Runner';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    probeId,
    runtimeFunctionUsed: 'buildPacket',
    inputSummary,
    packetPresence,
    safetySummary,
    approvalGateSummary,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction,
    probePassed,
    runtimePacket
  };
}

function main() {
  console.log(JSON.stringify(buildProbe({
    projectName:    process.env.KOSAME_PROJECT_NAME    || 'kosame-dev-orchestra',
    repoPath:       process.env.KOSAME_REPO_PATH       || '.',
    taskGoal:       process.env.KOSAME_TASK_GOAL       || 'probe full orchestra runtime',
    productLine:    process.env.KOSAME_PRODUCT_LINE    || 'backoffice',
    taskType:       process.env.KOSAME_TASK_TYPE       || 'implementation',
    riskLevel:      process.env.KOSAME_RISK_LEVEL      || 'low',
    dataLevel:      process.env.KOSAME_DATA_LEVEL      || 'A',
    currentStatus:  process.env.KOSAME_CURRENT_STATUS  || 'git clean, smoke passing',
    geminiResult:   'Spec clarification complete. Fixtures generated.',
    grokResult:     'Weakness analysis complete. No critical issues.',
    claudeResult:   'Implementation complete. All smoke tests pass. npm run verify: OK.',
    providerStatus: {},
    probeMode:      'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  REQUIRED_PACKET_KEYS,
  generateProbeId,
  buildPacketPresence,
  buildProbe
};
