'use strict';

const TOOL_META = {
  version: '82.0.0',
  title: 'KOSAME Dev Orchestra Decision Memory Pack',
  slug: 'dev-agent-decision-memory-pack'
};

const DECISION_OPTIONS = [
  'YES',
  'NO',
  'HOLD',
  'REVISE',
  'APPROVE_COMMIT',
  'APPROVE_BACKUP',
  'APPROVE_RELEASE_CANDIDATE'
];

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

function buildDecisionMemory(input = {}) {
  const decisions = input.decisions || [
    {
      decisionId: 'decision-v75-guardian-revenue-yes',
      targetVersion: 'v75.0.0',
      decision: 'APPROVE_COMMIT',
      reason: 'Guardian Class and Revenue Launch Line passed real smoke and verify',
      riskAccepted: ['dryRun artifacts only', 'no external repo mutation'],
      riskRejected: ['no secret read', 'no deploy', 'no real send'],
      humanApprover: 'Junya',
      reuseHint: 'If verify is preserved and all targeted smoke pass, commit candidate may proceed',
      futureTrigger: 'Use for Guardian/Revenue-like dryRun packs'
    },
    {
      decisionId: 'decision-revise-on-simulated-verify',
      targetVersion: 'any',
      decision: 'REVISE',
      reason: 'Simulated verification is not acceptable evidence',
      riskAccepted: [],
      riskRejected: ['fake pass', 'verify chain corruption'],
      humanApprover: 'Junya',
      reuseHint: 'Require real node --check, smoke, and npm run verify logs',
      futureTrigger: 'Any report containing simulated verification language'
    }
  ];

  return {
    decisionMemoryId: input.decisionMemoryId || 'decision-memory-v82',
    decisions,
    decisionOptions: DECISION_OPTIONS,
    decisionPatterns: {
      approveWhen: ['real logs exist', 'verify preserved', 'no dangerous actions'],
      reviseWhen: ['verify replaced', 'missing docs', 'simulated verification', 'path mismatch'],
      holdWhen: ['guardian not ready', 'customer data boundary unknown']
    },
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildDecisionMemory(), null, 2));
}

module.exports = {
  TOOL_META,
  DECISION_OPTIONS,
  DANGEROUS_ACTIONS_DENIED,
  buildDecisionMemory
};
