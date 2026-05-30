'use strict';

const TOOL_META = {
  version: '10.0.0',
  title: 'Full Orchestra Agent Runtime',
  slug: 'full-orchestra-agent-runtime-pack'
};

const planningPack   = require('./full-orchestra-planning-layer-pack');
const parallelPack   = require('./multi-agent-parallel-work-pack');
const mergerPack     = require('./orchestra-result-merger-pack');
const repairPack     = require('./autonomous-repair-retry-board-pack');
const loopPack       = require('./practical-dev-factory-loop-pack');
const runtimePack    = require('./practical-dev-factory-runtime-pack');
const routerPack     = require('./provider-prompt-router-real-use-pack');
const executionPack  = require('./task-execution-packet-generator-pack');
const reviewPack     = require('./result-import-review-pack');
const repairLoopPack = require('./repair-loop-controller-pack');

const PRODUCT_LINES = runtimePack.PRODUCT_LINES;
const TASK_TYPES    = runtimePack.TASK_TYPES;
const RISK_LEVELS   = runtimePack.RISK_LEVELS;
const DATA_LEVELS   = runtimePack.DATA_LEVELS;

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

function generateOrchestraId(projectName, taskType) {
  const ts = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `orchestra-${slug}-${taskType}-${ts}`;
}

function buildFinalRuntimePacket(input, planningPacket, parallelWorkPacket, mergedReviewPacket, repairRetryPacket) {
  return {
    runtimeSummary: 'Full Orchestra dry-run cycle completed',
    projectName:    input.projectName,
    taskGoal:       input.taskGoal,
    productLine:    input.productLine,
    taskType:       input.taskType,
    riskLevel:      input.riskLevel,
    dataLevel:      input.dataLevel,
    cycleSteps: [
      { step: 1, label: 'Planning Layer',          packetId: planningPacket.planningId,       status: 'generated' },
      { step: 2, label: 'Parallel Work Pack',      packetId: parallelWorkPacket.parallelWorkId, status: 'generated' },
      { step: 3, label: 'Orchestra Result Merger', packetId: mergedReviewPacket.mergerId,      status: 'generated' },
      { step: 4, label: 'Repair Retry Board',      packetId: repairRetryPacket.repairBoardId,  status: 'generated' }
    ],
    dryRun: true,
    noRealExecution: true,
    note: 'All packets are dry-run only. No API calls made. No files auto-applied. Human approval required for all destructive actions.',
    generatedAt: new Date().toISOString()
  };
}

function buildFinalApprovalPacket(input, reviewDecision) {
  return {
    requestedBy: 'full-orchestra-agent-runtime',
    projectName:  input.projectName || '(unnamed)',
    productLine:  input.productLine || 'backoffice',
    riskLevel:    input.riskLevel   || 'low',
    dataLevel:    input.dataLevel   || 'A',
    reviewDecision,
    commitGate:   { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit human YES' },
    pushGate:     { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit human YES' },
    tagGate:      { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit human YES' },
    deployGate:   { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit human YES' },
    approver:     'じゅんやさん (final YES only — does not return to worker)',
    note:         'じゅんやさんは最終YESのみ。作業員に戻さない。commit / push / tag / deploy はここで止まる。',
    humanApprovalRequired: true,
    generatedAt:  new Date().toISOString()
  };
}

function buildPacket(input) {
  const projectName   = String(input.projectName   || '(unnamed)');
  const repoPath      = String(input.repoPath      || '.');
  const taskGoal      = String(input.taskGoal      || '(task goal)').trim();
  const productLine   = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const taskType      = TASK_TYPES.includes(input.taskType)       ? input.taskType    : 'implementation';
  const riskLevel     = RISK_LEVELS.includes(input.riskLevel)     ? input.riskLevel   : 'low';
  const dataLevel     = DATA_LEVELS.includes(input.dataLevel)     ? input.dataLevel   : 'A';
  const currentStatus = String(input.currentStatus || '');
  const geminiResult  = input.geminiResult  || null;
  const grokResult    = input.grokResult    || null;
  const claudeResult  = input.claudeResult  || null;
  const providerStatus = input.providerStatus || {};

  const orchestraId = generateOrchestraId(projectName, taskType);

  // Step 1: Planning Layer (v8.0.0)
  const planningPacket = planningPack.buildPacket({
    projectName, repoPath, taskGoal, productLine, taskType, riskLevel, dataLevel,
    currentStatus,
    requestedAgents: ['kosame', 'gemini', 'claude', 'grok', 'human']
  });

  // Step 2: Parallel Work Pack (v8.5.0)
  const parallelWorkPacket = parallelPack.buildPacket({
    planningPacket,
    availableAgents: ['kosame', 'gemini', 'claude', 'grok'],
    parallelMode: 'full',
    maxConcurrentAgents: 3,
    dataLevel,
    riskLevel
  });

  // Step 3: Orchestra Result Merger (v9.0.0)
  const verificationSummary = claudeResult
    ? (/pass|ok|success/i.test(String(claudeResult)) ? 'npm run verify PASS' : 'npm run verify FAIL')
    : '(awaiting claude result)';

  const mergedReviewPacket = mergerPack.buildPacket({
    geminiResult,
    grokResult,
    claudeResult,
    originalTask: taskGoal,
    safetyBoundary: planningPacket.safetyBoundary,
    verificationSummary
  });

  // Step 4: Repair Retry Board (v9.5.0)
  const failureDetected = mergedReviewPacket.reviewDecision === 'rejected'
    || mergedReviewPacket.humanReviewRequired;
  const repairRetryPacket = repairPack.buildPacket({
    failureType:      failureDetected ? 'verify_failure' : 'human_approval_required',
    failedStep:       failureDetected ? 'orchestra_result_merger' : 'final_approval',
    errorSummary:     failureDetected ? 'Review decision requires repair or human review' : null,
    providerStatus,
    previousAttempts: 0,
    riskLevel,
    dataLevel
  });

  // Step 5: v7.5 Practical Dev Factory Loop (existing)
  const loopPacket = loopPack.buildLoopPacket({
    projectName, repoPath, taskGoal, productLine, taskType, riskLevel, dataLevel,
    preferredProvider: null, currentStatus,
    providerResult: claudeResult
  });

  // Final packets
  const finalRuntimePacket  = buildFinalRuntimePacket(
    { projectName, taskGoal, productLine, taskType, riskLevel, dataLevel },
    planningPacket, parallelWorkPacket, mergedReviewPacket, repairRetryPacket
  );
  const finalApprovalPacket = buildFinalApprovalPacket(
    { projectName, productLine, riskLevel, dataLevel },
    mergedReviewPacket.reviewDecision
  );

  // Level C check
  const levelCBlocked = dataLevel === 'C';

  const recommendedNextAction = levelCBlocked
    ? 'Level C data — dispatch to kosame internal only. Gemini/Grok/Claude external providers blocked.'
    : mergedReviewPacket.humanReviewRequired
      ? 'Human review required — route mergeDecisionPacket to こさめ/じゅんやさん'
      : `Orchestra cycle complete — route finalApprovalPacket to じゅんやさん for final YES/NO`;

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    orchestraId,
    projectName,
    repoPath,
    taskGoal,
    productLine,
    taskType,
    riskLevel,
    dataLevel,
    levelCBlocked,
    planningPacket,
    parallelWorkPacket,
    mergedReviewPacket,
    repairRetryPacket,
    loopPacket,
    finalRuntimePacket,
    finalApprovalPacket,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildPacket({
    projectName:   process.env.KOSAME_PROJECT_NAME   || 'sample-project',
    repoPath:      process.env.KOSAME_REPO_PATH      || '.',
    taskGoal:      process.env.KOSAME_TASK_GOAL      || 'implement release note generator',
    productLine:   process.env.KOSAME_PRODUCT_LINE   || 'backoffice',
    taskType:      process.env.KOSAME_TASK_TYPE      || 'implementation',
    riskLevel:     process.env.KOSAME_RISK_LEVEL     || 'low',
    dataLevel:     process.env.KOSAME_DATA_LEVEL     || 'A',
    currentStatus: process.env.KOSAME_CURRENT_STATUS || 'git clean, smoke passing',
    geminiResult:  'Spec clarification complete. Fixtures generated.',
    grokResult:    'Weakness analysis complete. No critical issues.',
    claudeResult:  'Implementation complete. All smoke tests pass. npm run verify: OK.',
    providerStatus: {}
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
  generateOrchestraId,
  buildFinalRuntimePacket,
  buildFinalApprovalPacket,
  buildPacket
};
