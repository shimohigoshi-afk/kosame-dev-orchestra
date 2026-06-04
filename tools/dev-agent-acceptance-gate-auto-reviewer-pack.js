'use strict';

const TOOL_META = {
  version: '88.0.0',
  title: 'KOSAME Dev Orchestra Acceptance Gate Auto Reviewer Pack',
  slug: 'dev-agent-acceptance-gate-auto-reviewer-pack'
};

const DECISIONS = ['YES', 'REVISE', 'HOLD', 'BLOCKED', 'COMMIT_CANDIDATE'];

const DANGEROUS_ACTIONS_DENIED = [
  'secret read',
  '.env read',
  'api key read',
  'customer data read',
  'insurance data read',
  'deploy',
  'git add/commit/push/tag',
  'destructive delete',
  'external repo mutation'
];

function reviewReport(input = {}) {
  const reportText = JSON.stringify(input).toLowerCase();
  const detectedIssues = [];

  if (reportText.includes('node -e') && reportText.includes('verify')) detectedIssues.push('verify node-e replacement');
  if (reportText.includes('simulated') || reportText.includes('シミュレート')) detectedIssues.push('simulated verification');
  if (reportText.includes('git add -a')) detectedIssues.push('git add -A used');
  if (reportText.includes('secret read') || reportText.includes('cat .env') || reportText.includes('printenv')) detectedIssues.push('secret/env read risk');
  if (reportText.includes('gcloud run deploy') || reportText.includes('deploy executed')) detectedIssues.push('deploy executed');
  if (reportText.includes('./package.json') || reportText.includes('./fixtures/')) detectedIssues.push('relative path mismatch');
  if (input.docsExpected && input.docsActual !== input.docsExpected) detectedIssues.push('docs count mismatch');
  if (input.verifyExitCode && input.verifyExitCode !== 0) detectedIssues.push('verify failed');
  if (input.smokePassed === false) detectedIssues.push('smoke failed');

  let decision = 'COMMIT_CANDIDATE';
  if (detectedIssues.some((issue) => issue.includes('secret') || issue.includes('deploy'))) decision = 'BLOCKED';
  else if (detectedIssues.length > 0) decision = 'REVISE';

  return { decision, detectedIssues };
}

function buildAcceptanceGateAutoReviewer(input = {}) {
  const review = reviewReport(input.inputReport || { verifyExitCode: 0, smokePassed: true, docsExpected: 5, docsActual: 5 });

  return {
    acceptanceGateAutoReviewerId: input.acceptanceGateAutoReviewerId || 'acceptance-gate-auto-reviewer-v88',
    requiredChecks: [
      'verify preserved',
      'real node --check logs',
      'real smoke logs',
      'npm run verify exit_code 0',
      'no dangerous actions',
      'intended files only'
    ],
    detectedIssues: review.detectedIssues,
    decision: review.decision,
    decisionOptions: DECISIONS,
    decisionReason: review.detectedIssues.length ? 'Detected revision/blocker issues' : 'All required evidence present',
    nextAction: review.decision === 'COMMIT_CANDIDATE' ? 'Prepare release candidate packet' : 'Revise before commit',
    humanApprovalPacket: {
      required: true,
      approver: 'Junya',
      allowedDecisions: ['YES', 'NO', 'HOLD', 'REVISE']
    },
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildAcceptanceGateAutoReviewer(), null, 2));
}

module.exports = {
  TOOL_META,
  DECISIONS,
  DANGEROUS_ACTIONS_DENIED,
  reviewReport,
  buildAcceptanceGateAutoReviewer
};
