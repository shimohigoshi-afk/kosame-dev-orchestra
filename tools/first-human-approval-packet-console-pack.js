'use strict';

const TOOL_META = {
  version: '14.0.0',
  title: 'First Human Approval Packet Console',
  slug: 'first-human-approval-packet-console-pack'
};

const reviewPack = require('./dry-run-result-review-console-pack');

const DANGEROUS_ACTION_GATES = [
  'git push', 'git tag', 'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data', 'destructive action', 'rm -rf'
];

const FINAL_DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

function generateApprovalConsoleId() {
  return `approval-${Date.now()}`;
}

function buildYesNoDecisionPacket(input) {
  const { riskLevel, targetFiles, allowedFiles, claudePrompt, verificationPlan, rollbackNote } = input;

  const isLowRisk  = riskLevel === 'low';
  const hasPrompt  = typeof claudePrompt === 'string' && claudePrompt.length > 0;
  const hasVP      = !!(verificationPlan && verificationPlan.steps);
  const hasRollback = typeof rollbackNote === 'string' && rollbackNote.length > 0;

  return {
    approveToSendClaudePrompt:       hasPrompt && isLowRisk,
    approveToAllowFileEditCandidate: isLowRisk && (targetFiles || []).every(f =>
      (allowedFiles || []).some(a => a.endsWith('**') || a.includes(f.replace('./', ''))) ||
      (allowedFiles || []).includes(f)
    ),
    approveToRunVerifyAfterEdit:     hasVP,
    approveToCommitAfterHumanReview: false,
    approveToPushAfterHumanReview:   false,
    approveToTagAfterHumanReview:    false,
    approveToDeploy:                 false,
    approveToReadSecrets:            false,
    approveToUseRealApi:             false,
    note: 'approveToDeploy / approveToReadSecrets / approveToUseRealApi は常に false。git commit/push/tag も Human final YES 必須。'
  };
}

function buildApprovalChecklist(input) {
  const { taskGoal, targetFiles, allowedFiles, deniedFiles, claudePrompt, verificationPlan, rollbackNote, riskLevel } = input;

  const isLowRisk    = riskLevel === 'low';
  const noSecretFile = !(targetFiles || []).some(f => /secret|\.env|api.?key/i.test(f));

  return {
    'task goal is low risk':           isLowRisk,
    'target files are allowed':        (targetFiles || []).every(f =>
      (allowedFiles || []).some(a => a.endsWith('**') || a.includes(f.replace('./', ''))) ||
      (allowedFiles || []).includes(f)
    ),
    'denied files are protected':      (deniedFiles || []).length > 0,
    'no Secret / .env / API key':      noSecretFile,
    'no customer data':                true,
    'no real API execution':           true,
    'no deploy':                       true,
    'rollback note present':           typeof rollbackNote === 'string' && rollbackNote.length > 0,
    'verification plan present':       !!(verificationPlan && verificationPlan.steps),
    'Claude prompt present':           typeof claudePrompt === 'string' && claudePrompt.length > 0,
    'final YES only preserved':        true
  };
}

function buildApprovalConsole(input) {
  const taskGoal        = String(input.taskGoal       || '(task goal)').trim();
  const targetFiles     = input.targetFiles   || ['README.md'];
  const allowedFiles    = input.allowedFiles  || ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'];
  const deniedFiles     = input.deniedFiles   || ['./.env', './.env.*', './secrets/**', './credentials/**'];
  const claudePrompt    = input.claudePrompt  || '';
  const verificationPlan = input.verificationPlan || null;
  const rollbackNote    = input.rollbackNote  || '';
  const approvalMode    = String(input.approvalMode   || 'dry-run');
  const riskLevel       = String(input.riskLevel      || 'low');
  const dataLevel       = String(input.dataLevel      || 'A');

  const humanApprovalConsoleId = generateApprovalConsoleId();

  // Call v13.5.0 review console internally
  const reviewResult = input.reviewPacket || reviewPack.buildReviewConsole({
    projectName:  input.projectName || '(unnamed)',
    taskGoal,
    targetFiles,
    allowedFiles,
    deniedFiles,
    riskLevel,
    dataLevel,
    reviewMode: 'dry-run'
  });

  const yesNoDecisionPacket = buildYesNoDecisionPacket({
    riskLevel, targetFiles, allowedFiles, claudePrompt, verificationPlan, rollbackNote
  });

  const approvalChecklist = buildApprovalChecklist({
    taskGoal, targetFiles, allowedFiles, deniedFiles,
    claudePrompt, verificationPlan, rollbackNote, riskLevel
  });

  const allChecksPassed = Object.values(approvalChecklist).every(Boolean);

  const approvalSummary = {
    taskGoal,
    riskLevel,
    dataLevel,
    targetFiles,
    approvalMode,
    reviewPassed:          reviewResult.reviewPassed,
    allChecklistItemsPass: allChecksPassed,
    humanApprovalRequired: true,
    dryRun: true
  };

  const executionReadiness = {
    claudePromptReady:     yesNoDecisionPacket.approveToSendClaudePrompt,
    verificationPlanReady: yesNoDecisionPacket.approveToRunVerifyAfterEdit,
    rollbackNoteReady:     typeof rollbackNote === 'string' && rollbackNote.length > 0,
    humanApprovalRequired: true,
    readyToProceed:        false,
    note: 'readyToProceed is always false until じゅんやさん gives explicit YES'
  };

  const safeToProceedReasons = [];
  if (riskLevel === 'low')     safeToProceedReasons.push('riskLevel is low');
  if (dataLevel !== 'C')       safeToProceedReasons.push(`dataLevel ${dataLevel}: external provider allowed`);
  if (reviewResult.reviewPassed) safeToProceedReasons.push('review console passed');
  if (yesNoDecisionPacket.approveToSendClaudePrompt) safeToProceedReasons.push('claude prompt is ready');

  const stopReasons = [];
  if (!reviewResult.reviewPassed)                     stopReasons.push('review console did not pass');
  if (!allChecksPassed) {
    const failedItems = Object.entries(approvalChecklist)
      .filter(([, v]) => !v).map(([k]) => k);
    failedItems.forEach(item => stopReasons.push(`checklist failed: ${item}`));
  }

  const finalDecisionOptions = FINAL_DECISION_OPTIONS;

  const approvalPacketPassed = reviewResult.reviewPassed && allChecksPassed;

  const recommendedNextAction = approvalPacketPassed
    ? 'Approval packet ready — present to じゅんやさん for final YES/NO. Do not execute until explicit YES received.'
    : `Approval packet has issues (${stopReasons.length}) — resolve before presenting to じゅんやさん`;

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    humanApprovalConsoleId,
    approvalSummary,
    yesNoDecisionPacket,
    executionReadiness,
    approvalChecklist,
    dangerousActionGates: DANGEROUS_ACTION_GATES,
    safeToProceedReasons,
    stopReasons,
    rollbackNote,
    finalDecisionOptions,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    recommendedNextAction,
    approvalPacketPassed
  };
}

function main() {
  const { buildExporter } = require('./claude-execution-prompt-exporter-pack');
  const { buildDocsTaskPacket } = require('./first-real-docs-task-packet-pack');

  const taskGoal = 'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する';
  const docsTask = buildDocsTaskPacket({ taskId: 'main-001', projectName: 'kosame-dev-orchestra', taskGoal });
  const exporter = buildExporter({ docsTaskPacket: docsTask });

  console.log(JSON.stringify(buildApprovalConsole({
    projectName:   'kosame-dev-orchestra',
    taskGoal,
    targetFiles:   ['README.md'],
    claudePrompt:  exporter.claudePrompt,
    verificationPlan: docsTask.verificationPlan,
    rollbackNote:  docsTask.rollbackNote,
    riskLevel:     'low',
    dataLevel:     'A',
    approvalMode:  'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTION_GATES,
  FINAL_DECISION_OPTIONS,
  generateApprovalConsoleId,
  buildApprovalConsole
};
