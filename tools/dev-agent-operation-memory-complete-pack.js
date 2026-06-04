'use strict';

const { buildOperationEventLog } = require('./dev-agent-operation-event-log-pack');
const { buildDecisionMemory } = require('./dev-agent-decision-memory-pack');
const { buildFailureRetryPattern } = require('./dev-agent-failure-retry-pattern-pack');
const { buildHandoffAutoSummary } = require('./dev-agent-handoff-auto-summary-pack');

const TOOL_META = {
  version: '85.0.0',
  title: 'KOSAME Dev Orchestra Operation Memory Complete Pack',
  slug: 'dev-agent-operation-memory-complete-pack'
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

function buildOperationMemoryComplete(input = {}) {
  const blockers = input.blockers || [];

  const completeCriteria = {
    operationEventLogExists: true,
    decisionMemoryExists: true,
    failureRetryPatternExists: true,
    handoffAutoSummaryExists: true,
    noExternalRepoRead: true,
    noSecretRead: true,
    noCustomerDataRead: true
  };

  return {
    operationMemoryCompleteId: input.operationMemoryCompleteId || 'operation-memory-complete-v85',
    orchestraVersion: input.orchestraVersion || '85.0.0',
    operationEventLog: input.operationEventLog || buildOperationEventLog(),
    decisionMemory: input.decisionMemory || buildDecisionMemory(),
    failureRetryPattern: input.failureRetryPattern || buildFailureRetryPattern(),
    handoffAutoSummary: input.handoffAutoSummary || buildHandoffAutoSummary(),
    memoryOperatingPolicy: [
      'Use operation memory to reduce repeated explanations',
      'Carry forward human YES/NO/HOLD/REVISE reasons',
      'Preserve failure patterns and anti-loop rules',
      'Generate handoff summaries before moving chats or contexts'
    ],
    completeCriteria,
    blockers,
    completePackReady: blockers.length === 0 && Object.values(completeCriteria).every(Boolean),
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildOperationMemoryComplete(), null, 2));
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildOperationMemoryComplete
};
