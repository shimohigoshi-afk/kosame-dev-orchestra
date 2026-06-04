'use strict';

const TOOL_META = {
  version: '81.0.0',
  title: 'KOSAME Dev Orchestra Operation Event Log Pack',
  slug: 'dev-agent-operation-event-log-pack'
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

function buildOperationEventLog(input = {}) {
  const events = input.events || [
    {
      eventId: 'evt-v80-command-center-complete',
      timestamp: 'dry-run',
      product: 'kosame_dev_orchestra',
      version: 'v80.0.0',
      actor: 'KOSAME / GPT',
      action: 'Command Center Line accepted and prepared for next memory phase',
      result: 'READY',
      riskLevel: 'LOW',
      verificationResult: 'PASSED',
      nextAction: 'Build v81-v85 Operation Memory Line'
    },
    {
      eventId: 'evt-v81-memory-start',
      timestamp: 'dry-run',
      product: 'kosame_dev_orchestra',
      version: 'v81.0.0',
      actor: 'Cloud Shell',
      action: 'Generate operation event log pack',
      result: 'DRY_RUN_READY',
      riskLevel: 'LOW',
      verificationResult: 'PENDING_SMOKE',
      nextAction: 'Run smoke:operation-event-log'
    }
  ];

  return {
    operationEventLogId: input.operationEventLogId || 'operation-event-log-v81',
    orchestraVersion: input.orchestraVersion || '81.0.0',
    events,
    eventSummary: {
      totalEvents: events.length,
      latestResult: events[events.length - 1] && events[events.length - 1].result,
      nextAction: input.nextAction || 'Use memory line to avoid restarting context from zero'
    },
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildOperationEventLog(), null, 2));
}

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  buildOperationEventLog
};
