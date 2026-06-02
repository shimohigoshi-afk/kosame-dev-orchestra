'use strict';

const TOOL_META = {
  version: '14.5.0',
  title: 'Approval Packet Practical Review Runner',
  slug: 'approval-packet-practical-review-runner-pack'
};

const DANGEROUS_ACTION_GATES = [
  'git push', 'git tag', 'git commit', 'git add',
  'deploy', 'gcloud deploy', 'docker build',
  'secret', '.env', 'api key', 'customer data',
  'rm -rf', 'git reset --hard', 'git clean'
];

const FINAL_DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

function checkDangerousActions(packet) {
  const text = JSON.stringify(packet).toLowerCase();
  return DANGEROUS_ACTION_GATES.filter(gate => text.includes(gate.toLowerCase()));
}

function collectMissingApprovalItems(packet) {
  const missing = [];
  if (!packet.taskGoal && !packet.approvalSummary?.taskGoal) missing.push('taskGoal');
  if (!packet.targetFiles && !packet.approvalSummary?.targetFiles) missing.push('targetFiles');
  if (!packet.rollbackNote) missing.push('rollbackNote');
  if (!packet.verificationPlan && !packet.executionReadiness?.verificationPlanReady) missing.push('verificationPlan');
  if (!packet.claudePrompt && !packet.executionReadiness?.claudePromptReady) missing.push('claudePrompt');
  return missing;
}

function determineFinalDecision(reviewResult) {
  const { dangerousActionsFound, missingApprovalItems, checklistPassed, riskLevel } = reviewResult;
  if (dangerousActionsFound.length > 3) return 'reject';
  if (missingApprovalItems.length > 2)  return 'revise';
  if (!checklistPassed)                 return 'revise';
  if (riskLevel === 'high')             return 'hold';
  return 'approve';
}

function buildReviewChecklist(packet) {
  const summary = packet.approvalSummary || {};
  const exec    = packet.executionReadiness || {};
  return {
    'dryRun is true':              packet.dryRun === true,
    'humanApprovalRequired':       packet.humanApprovalRequired === true,
    'taskGoal present':            !!(summary.taskGoal || packet.taskGoal),
    'targetFiles present':         !!(summary.targetFiles && summary.targetFiles.length > 0),
    'rollbackNote present':        typeof packet.rollbackNote === 'string' && packet.rollbackNote.length > 0,
    'verificationPlan ready':      exec.verificationPlanReady === true,
    'claudePrompt ready':          exec.claudePromptReady === true,
    'approveToDeploy is false':    packet.yesNoDecisionPacket?.approveToDeploy === false,
    'approveToReadSecrets is false': packet.yesNoDecisionPacket?.approveToReadSecrets === false,
    'approveToUseRealApi is false':  packet.yesNoDecisionPacket?.approveToUseRealApi === false,
    'noRealApiExecution':          packet.noRealApiExecution === true,
    'noRealFileEdit':              packet.noRealFileEdit === true
  };
}

function buildReviewRunner(input) {
  const approvalPacket = input.approvalPacket || {};
  const riskLevel      = String(input.riskLevel || approvalPacket.approvalSummary?.riskLevel || 'low');
  const reviewerId     = `review-${Date.now()}`;

  const checklist            = buildReviewChecklist(approvalPacket);
  const checklistPassed      = Object.values(checklist).every(Boolean);
  const dangerousActionsFound = checkDangerousActions(approvalPacket);
  const missingApprovalItems = collectMissingApprovalItems(approvalPacket);

  const reviewResult = { dangerousActionsFound, missingApprovalItems, checklistPassed, riskLevel };
  const finalDecision = determineFinalDecision(reviewResult);

  const safeNextAction = (() => {
    if (finalDecision === 'approve') {
      return 'Approval packet passed review. Present to じゅんやさん for explicit final YES before any execution.';
    }
    if (finalDecision === 'revise') {
      return `Revise approval packet. Missing: ${missingApprovalItems.join(', ') || 'checklist items'}.`;
    }
    if (finalDecision === 'reject') {
      return 'Reject: dangerous actions detected in packet. Do not proceed until packet is rebuilt.';
    }
    return 'Hold: escalate to こさめ/GPT PM for review before proceeding.';
  })();

  return {
    version:              TOOL_META.version,
    title:                TOOL_META.title,
    dryRun:               true,
    humanApprovalRequired: true,
    reviewerId,
    riskLevel,
    checklist,
    checklistPassed,
    dangerousActionsFound,
    missingApprovalItems,
    finalDecision,
    finalDecisionOptions: FINAL_DECISION_OPTIONS,
    dangerousActionGates: DANGEROUS_ACTION_GATES,
    safeNextAction,
    noRealApiExecution:   true,
    noRealExecution:      true
  };
}

function main() {
  const approvalPacket = {
    dryRun: true,
    humanApprovalRequired: true,
    taskGoal: 'README.mdにv14.5.0 Approval Packet Practical Review Runnerの説明を追加する',
    approvalSummary: {
      taskGoal: 'README.mdにv14.5.0 Approval Packet Practical Review Runnerの説明を追加する',
      riskLevel: 'low',
      targetFiles: ['README.md']
    },
    yesNoDecisionPacket: {
      approveToDeploy:       false,
      approveToReadSecrets:  false,
      approveToUseRealApi:   false
    },
    executionReadiness: {
      claudePromptReady:     true,
      verificationPlanReady: true,
      rollbackNoteReady:     true,
      readyToProceed:        false
    },
    rollbackNote: 'git checkout -- README.md if needed.',
    noRealApiExecution: true,
    noRealFileEdit:     true
  };

  console.log(JSON.stringify(buildReviewRunner({ approvalPacket, riskLevel: 'low' }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTION_GATES,
  FINAL_DECISION_OPTIONS,
  buildReviewRunner
};
