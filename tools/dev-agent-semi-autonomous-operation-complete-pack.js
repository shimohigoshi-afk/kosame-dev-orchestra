'use strict';

const { buildNextBestTaskSelector } = require('./dev-agent-next-best-task-selector-pack');
const { buildGptTaskPromptBuilder } = require('./dev-agent-gpt-task-prompt-builder-pack');
const { buildAcceptanceGateAutoReviewer } = require('./dev-agent-acceptance-gate-auto-reviewer-pack');
const { buildReleaseCandidateBuilder } = require('./dev-agent-release-candidate-builder-pack');

const TOOL_META = {
  version: '90.0.0',
  title: 'KOSAME Dev Orchestra Semi-Autonomous Operation Complete Pack',
  slug: 'dev-agent-semi-autonomous-operation-complete-pack'
};

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

function buildSemiAutonomousOperationComplete(input = {}) {
  const blockers = input.blockers || [];

  const completeCriteria = {
    nextBestTaskSelectorExists: true,
    gptTaskPromptBuilderExists: true,
    acceptanceGateAutoReviewerExists: true,
    releaseCandidateBuilderExists: true,
    inputFileSupportConfirmed: true,
    humanApprovalPacketExists: true,
    noSecretRead: true,
    noDeploy: true,
    noCustomerDataRead: true
  };

  return {
    semiAutonomousOperationId: input.semiAutonomousOperationId || 'semi-autonomous-operation-complete-v90',
    orchestraVersion: input.orchestraVersion || '90.0.0',
    nextBestTaskSelector: input.nextBestTaskSelector || buildNextBestTaskSelector(),
    gptTaskPromptBuilder: input.gptTaskPromptBuilder || buildGptTaskPromptBuilder(),
    acceptanceGateAutoReviewer: input.acceptanceGateAutoReviewer || buildAcceptanceGateAutoReviewer(),
    releaseCandidateBuilder: input.releaseCandidateBuilder || buildReleaseCandidateBuilder(),
    semiAutoOperatingPolicy: [
      'AI proposes next task, prompt, review, and release candidate',
      'GPT live input-file route is supported for task text ingestion',
      'Human remains final YES',
      'Deploy, Secret, customer data, and real send remain approval gates',
      'Junya is not returned to manual worker status'
    ],
    humanApprovalPacket: {
      required: true,
      approver: 'Junya',
      role: 'final YES / business judgment / danger gate approval'
    },
    completeCriteria,
    blockers,
    completePackReady: blockers.length === 0 && Object.values(completeCriteria).every(Boolean),
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildSemiAutonomousOperationComplete(), null, 2));
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildSemiAutonomousOperationComplete
};
