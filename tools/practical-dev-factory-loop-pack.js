'use strict';

const TOOL_META = {
  version: '7.5.0',
  title: 'Practical Dev Factory Loop',
  slug: 'practical-dev-factory-loop-pack'
};

const runtimePack   = require('./practical-dev-factory-runtime-pack');
const routerPack    = require('./provider-prompt-router-real-use-pack');
const executionPack = require('./task-execution-packet-generator-pack');
const reviewPack    = require('./result-import-review-pack');
const repairPack    = require('./repair-loop-controller-pack');

const PRODUCT_LINES = runtimePack.PRODUCT_LINES;
const TASK_TYPES    = runtimePack.TASK_TYPES;
const RISK_LEVELS   = runtimePack.RISK_LEVELS;
const DATA_LEVELS   = runtimePack.DATA_LEVELS;

const BLOCKED_DANGEROUS_ACTIONS = [
  'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard', 'git clean',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance policy sharing',
  'health check info sharing', 'personal name in minutes sharing'
];

function generateLoopId(projectName, taskType) {
  const ts = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `loop-${slug}-${taskType}-${ts}`;
}

function buildFinalApprovalPacket(input, reviewDecision) {
  const approved = reviewDecision && reviewDecision.approved;
  return {
    requestedBy: 'practical-dev-factory-loop',
    projectName:  input.projectName || '(unnamed)',
    productLine:  input.productLine || 'backoffice',
    riskLevel:    input.riskLevel   || 'low',
    dataLevel:    input.dataLevel   || 'A',
    reviewStatus: reviewDecision ? reviewDecision.status : 'pending',
    approved,
    commitGate:   { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit human YES' },
    pushGate:     { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit human YES' },
    tagGate:      { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit human YES' },
    deployGate:   { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit human YES' },
    approver:     'じゅんやさん (final YES only — does not return to worker)',
    note:         'じゅんやさんは最終YESのみ。作業員に戻さない。',
    humanApprovalRequired: true,
    generatedAt:  new Date().toISOString()
  };
}

function isLevelCBlocked(dataLevel, selectedProvider) {
  if (dataLevel !== 'C') return false;
  const externalProviders = ['claude', 'gemini', 'grok', 'deepseek', 'kimi'];
  return externalProviders.includes(selectedProvider);
}

function buildLoopPacket(input) {
  const projectName       = String(input.projectName       || '(unnamed)');
  const repoPath          = String(input.repoPath          || '.');
  const taskGoal          = String(input.taskGoal          || '(task goal)').trim();
  const productLine       = PRODUCT_LINES.includes(input.productLine) ? input.productLine : 'backoffice';
  const taskType          = TASK_TYPES.includes(input.taskType)       ? input.taskType    : 'implementation';
  const riskLevel         = RISK_LEVELS.includes(input.riskLevel)     ? input.riskLevel   : 'low';
  const dataLevel         = DATA_LEVELS.includes(input.dataLevel)     ? input.dataLevel   : 'A';
  const preferredProvider = input.preferredProvider || null;
  const currentStatus     = String(input.currentStatus || '');
  const providerResult    = input.providerResult !== undefined ? input.providerResult : null;

  const loopId = generateLoopId(projectName, taskType);

  // Step 1: Runtime normalization
  const runtimePacket = runtimePack.buildPacket({
    projectName, repoPath, taskGoal, productLine, taskType,
    riskLevel, dataLevel, preferredProvider, currentStatus
  });

  // Step 2: Provider routing
  const providerRoutePacket = routerPack.buildPacket({
    taskType, productLine, riskLevel, dataLevel, preferredProvider, taskGoal
  });
  const providerRoute = providerRoutePacket.providerRoute;

  // Step 3: Level C safety gate
  const levelCBlocked = isLevelCBlocked(dataLevel, providerRoute.selectedProvider);
  if (levelCBlocked) {
    providerRoute.selectedProvider = 'kosame';
    providerRoute.reason = 'Level C data — overridden to kosame';
    providerRoute.fallbacks = ['human'];
  }

  // Step 4: Execution packet
  const executionPacket = executionPack.buildPacket({
    taskGoal, taskType, productLine, riskLevel, dataLevel,
    provider: providerRoute.selectedProvider, repoPath
  });

  // Step 5: Result import & review
  const importedResult = reviewPack.buildPacket({
    providerResult: providerResult !== null ? providerResult : '(awaiting provider result)',
    provider:       providerRoute.selectedProvider,
    taskGoal, taskType, productLine
  });

  const reviewDecision = importedResult.reviewDecision;

  // Step 6: Repair loop (if failure)
  let repairLoop = null;
  if (reviewDecision.requiresRepair || (reviewDecision.issues && reviewDecision.issues.length > 0)) {
    const primaryIssue = reviewDecision.issues && reviewDecision.issues.length > 0
      ? reviewDecision.issues[0].type
      : 'unknown_failure';
    const errorText = providerResult !== null ? String(providerResult).slice(0, 500) : '(no result yet)';
    repairLoop = repairPack.buildPacket({
      failureType:   primaryIssue,
      errorOutput:   errorText,
      taskGoal, taskType, productLine,
      provider:      providerRoute.selectedProvider,
      attempt:       1
    });
  }

  // Step 7: Final approval packet
  const finalApprovalPacket = buildFinalApprovalPacket(
    { projectName, productLine, riskLevel, dataLevel },
    reviewDecision
  );

  // Determine recommended next action
  let recommendedNextAction;
  if (levelCBlocked) {
    recommendedNextAction = 'Level C data blocked external provider — route to kosame or human';
  } else if (reviewDecision.requiresRepair && repairLoop) {
    recommendedNextAction = repairLoop.recommendedNextAction;
  } else if (reviewDecision.status === 'success' && !reviewDecision.requiresRepair) {
    recommendedNextAction = 'Task succeeded — route to kosame for final approval packet review';
  } else if (reviewDecision.status === 'pending_approval') {
    recommendedNextAction = 'Pending human approval — route to じゅんやさん for final YES/NO';
  } else if (providerResult === null) {
    recommendedNextAction = `Dispatch to ${providerRoute.selectedProvider} using executionPacket — report result in JSON format`;
  } else {
    recommendedNextAction = importedResult.recommendedNextAction || 'Route to kosame for triage';
  }

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    loopId,
    projectName,
    repoPath,
    taskGoal,
    productLine,
    taskType,
    riskLevel,
    dataLevel,
    levelCBlocked,
    runtimePacket,
    providerRoute,
    executionPacket,
    importedResult,
    reviewDecision,
    repairLoop,
    finalApprovalPacket,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction
  };
}

function main() {
  console.log(JSON.stringify(buildLoopPacket({
    projectName:       process.env.KOSAME_PROJECT_NAME        || 'sample-project',
    repoPath:          process.env.KOSAME_REPO_PATH           || '.',
    taskGoal:          process.env.KOSAME_TASK_GOAL           || 'implement release note generator',
    productLine:       process.env.KOSAME_PRODUCT_LINE        || 'backoffice',
    taskType:          process.env.KOSAME_TASK_TYPE           || 'implementation',
    riskLevel:         process.env.KOSAME_RISK_LEVEL          || 'low',
    dataLevel:         process.env.KOSAME_DATA_LEVEL          || 'A',
    preferredProvider: process.env.KOSAME_PREFERRED_PROVIDER  || null,
    currentStatus:     process.env.KOSAME_CURRENT_STATUS      || 'git clean, smoke passing',
    providerResult:    process.env.KOSAME_PROVIDER_RESULT     || null
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
  generateLoopId,
  buildFinalApprovalPacket,
  isLevelCBlocked,
  buildLoopPacket
};
