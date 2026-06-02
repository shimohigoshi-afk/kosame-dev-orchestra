'use strict';

const TOOL_META = {
  version: '13.5.0',
  title: 'Dry Run Result Review Console',
  slug: 'dry-run-result-review-console-pack'
};

const BLOCKED_DANGEROUS_ACTIONS = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const REVIEWER_DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const DANGEROUS_FILE_PATTERNS = /\.env|secret|credential|\.pem|\.key|api.?key/i;

function generateReviewConsoleId(projectName) {
  const ts   = Date.now();
  const slug = String(projectName || '').toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20);
  return `review-${slug}-${ts}`;
}

function buildGeneratedPacketSummary(dcp) {
  if (!dcp) {
    return {
      available: false,
      note: 'No dryRunConsolePacket provided — using input fields directly'
    };
  }
  return {
    available: true,
    dryRunConsoleId:             dcp.dryRunConsoleId        || null,
    usageConsolePacket:          !!(dcp.usageConsolePacket),
    docsTaskPacket:              !!(dcp.docsTaskPacket),
    claudeExecutionPromptPacket: !!(dcp.claudeExecutionPromptPacket),
    finalApprovalPacket:         !!(dcp.finalApprovalPacket),
    claudePromptPresent:         !!(dcp.claudeExecutionPromptPacket && dcp.claudeExecutionPromptPacket.claudePrompt),
    providerPromptPackets:       !!(dcp.providerPromptPackets),
    endToEndPassed:              dcp.endToEndPassed === true
  };
}

function buildProviderRoleSummary(ppp) {
  if (!ppp) return { available: false };
  return {
    available: true,
    gemini: ppp.geminiPacket
      ? { role: ppp.geminiPacket.role || 'spec/docs', canEditRepo: ppp.geminiPacket.canEditRepo === true }
      : null,
    grok: ppp.grokPacket
      ? { role: ppp.grokPacket.role || 'weakness check', canEditRepo: ppp.grokPacket.canEditRepo === true }
      : null,
    claude: ppp.claudePacket
      ? { role: ppp.claudePacket.role || 'implementation candidate', canEditRepo: ppp.claudePacket.canEditRepo === true }
      : null,
    kosame: ppp.kosamePacket
      ? { role: ppp.kosamePacket.role || 'integration/safety gate', canEditRepo: ppp.kosamePacket.canEditRepo === true }
      : null,
    humanApproval: ppp.humanApprovalPacket
      ? { role: ppp.humanApprovalPacket.role || 'final YES only', canEditRepo: ppp.humanApprovalPacket.canEditRepo === true }
      : null,
    note: 'Gemini/Grok must not edit repo. Claude is the only candidate. Human/じゅんやさんは final YES only.'
  };
}

function buildFileTouchSummary(targetFiles, allowedFiles, deniedFiles) {
  const targets = targetFiles || [];
  const allowed = allowedFiles || [];
  const denied  = deniedFiles  || [];

  const dangerousTargets = targets.filter(f => DANGEROUS_FILE_PATTERNS.test(f));
  const allAllowed = targets.every(f =>
    allowed.some(a => a.endsWith('**') || a.includes(f.replace('./', ''))) || allowed.includes(f)
  );
  const deniedProtected = denied.length > 0;

  return {
    targetFiles,
    targetCount:        targets.length,
    dangerousTargets,
    hasDangerousTarget: dangerousTargets.length > 0,
    allTargetsAllowed:  allAllowed,
    deniedFilesSet:     deniedProtected,
    deniedCount:        denied.length,
    note: dangerousTargets.length > 0
      ? 'DANGER: dangerous file detected in targetFiles'
      : 'OK: no dangerous files in targetFiles'
  };
}

function buildSafetyReview(riskLevel, dataLevel, fileTouchSummary) {
  const isLowRisk      = riskLevel === 'low';
  const isLevelC       = dataLevel === 'C';
  const hasDangerFile  = fileTouchSummary.hasDangerousTarget;

  const issues = [];
  if (!isLowRisk)     issues.push(`riskLevel is not low: ${riskLevel}`);
  if (isLevelC)       issues.push('dataLevel C: external provider blocked');
  if (hasDangerFile)  issues.push(`dangerous files in targetFiles: ${fileTouchSummary.dangerousTargets.join(', ')}`);

  return {
    riskLevel,
    dataLevel,
    isLowRisk,
    isLevelCBlocked: isLevelC,
    hasDangerousFile: hasDangerFile,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    secretsBlocked:     true,
    customerDataBlocked: true,
    issueCount: issues.length,
    issues,
    safetyPassed: issues.length === 0
  };
}

function buildApprovalReadiness(safetyReview, generatedPacketSummary, verificationPlan, finalApprovalPacket) {
  const vpReady  = !!(verificationPlan && verificationPlan.steps && verificationPlan.steps.length > 0);
  const fapReady = !!(finalApprovalPacket && finalApprovalPacket.commitGate);

  return {
    safetyPassed:          safetyReview.safetyPassed,
    verificationPlanReady: vpReady,
    approvalPacketReady:   fapReady,
    humanApprovalRequired: true,
    readyForHumanReview:   safetyReview.safetyPassed && vpReady,
    note: safetyReview.safetyPassed
      ? 'Review passed safety checks — ready for じゅんやさん review'
      : 'Review has safety issues — resolve before human review'
  };
}

function buildReviewConsole(input) {
  const dryRunConsolePacket  = input.dryRunConsolePacket || null;
  const projectName          = String(input.projectName  || '(unnamed)');
  const taskGoal             = String(input.taskGoal     || '(task goal)').trim();
  const targetFiles          = input.targetFiles   || ['README.md'];
  const allowedFiles         = input.allowedFiles  || ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'];
  const deniedFiles          = input.deniedFiles   || ['./.env', './.env.*', './secrets/**', './credentials/**'];
  const providerPromptPackets = input.providerPromptPackets
    || (dryRunConsolePacket && dryRunConsolePacket.providerPromptPackets)
    || null;
  const verificationPlan     = input.verificationPlan
    || (dryRunConsolePacket && dryRunConsolePacket.verificationPlan)
    || null;
  const finalApprovalPacket  = input.finalApprovalPacket
    || (dryRunConsolePacket && dryRunConsolePacket.finalApprovalPacket)
    || null;
  const riskLevel            = String(input.riskLevel   || 'low');
  const dataLevel            = String(input.dataLevel   || 'A');
  const reviewMode           = String(input.reviewMode  || 'dry-run');

  const reviewConsoleId = generateReviewConsoleId(projectName);

  const inputSummary = {
    projectName, taskGoal, riskLevel, dataLevel, reviewMode,
    targetFilesCount:    targetFiles.length,
    allowedFilesCount:   allowedFiles.length,
    deniedFilesCount:    deniedFiles.length,
    dryRunPacketProvided: dryRunConsolePacket !== null
  };

  const generatedPacketSummary = buildGeneratedPacketSummary(dryRunConsolePacket);
  const providerRoleSummary    = buildProviderRoleSummary(providerPromptPackets);
  const fileTouchSummary       = buildFileTouchSummary(targetFiles, allowedFiles, deniedFiles);
  const safetyReview           = buildSafetyReview(riskLevel, dataLevel, fileTouchSummary);
  const approvalReadiness      = buildApprovalReadiness(safetyReview, generatedPacketSummary, verificationPlan, finalApprovalPacket);

  const unresolvedItems = safetyReview.issues.slice();
  if (!approvalReadiness.verificationPlanReady)  unresolvedItems.push('verificationPlan not set');
  if (!approvalReadiness.approvalPacketReady)    unresolvedItems.push('finalApprovalPacket not set');

  const reviewerDecisionOptions = REVIEWER_DECISION_OPTIONS;

  const reviewPassed = safetyReview.safetyPassed;

  const recommendedNextAction = reviewPassed
    ? 'Review passed — route to v14.0.0 First Human Approval Packet Console for じゅんやさん YES/NO'
    : `Review has ${unresolvedItems.length} unresolved item(s) — resolve before approval`;

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    reviewConsoleId,
    inputSummary,
    generatedPacketSummary,
    providerRoleSummary,
    fileTouchSummary,
    safetyReview,
    approvalReadiness,
    unresolvedItems,
    reviewerDecisionOptions,
    blockedDangerousActions: BLOCKED_DANGEROUS_ACTIONS,
    recommendedNextAction,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    reviewPassed
  };
}

function main() {
  const { buildEndToEndConsole } = require('./first-end-to-end-dry-run-console-pack');
  const dryRunConsolePacket = buildEndToEndConsole({
    projectName:   'kosame-dev-orchestra',
    repoPath:      '.',
    taskGoal:      'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
    productLine:   'backoffice',
    taskType:      'docs',
    riskLevel:     'low',
    dataLevel:     'A',
    targetFiles:   ['README.md'],
    providerStatus: {},
    currentStatus: 'git clean, smoke passing',
    endToEndMode:  'dry-run'
  });

  console.log(JSON.stringify(buildReviewConsole({
    dryRunConsolePacket,
    projectName:  'kosame-dev-orchestra',
    taskGoal:     'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
    targetFiles:  ['README.md'],
    riskLevel:    'low',
    dataLevel:    'A',
    reviewMode:   'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  BLOCKED_DANGEROUS_ACTIONS,
  REVIEWER_DECISION_OPTIONS,
  generateReviewConsoleId,
  buildReviewConsole
};
