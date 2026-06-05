'use strict';

const TOOL_META = {
  version: '97.0.0',
  title: 'KOSAME Dev Orchestra Pilot Work Order Builder Pack',
  slug: 'dev-agent-pilot-work-order-builder-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'PDF data read', 'insurance data read',
  'real send', 'real contract execution', 'real billing', 'deploy',
  'git add/commit/push/tag', 'secret read', '.env read', 'destructive delete'
];

const AGENT_ROLES = {
  CLAUDE_CODE: 'ClaudeCode',
  GPT_AGENT: 'GPTAgent',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  HUMAN: 'Human'
};

const DEFAULT_FORBIDDEN_FILES = [
  '.env', '.env.*', '**/*.key', '**/*.pem', '**/secrets/**',
  'customer_data/**', 'gmail_data/**', 'insurance_data/**'
];

const DEFAULT_VERIFICATION_COMMANDS = [
  'node --check tools/*.js',
  'npm run verify'
];

function buildWorkOrder(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `pilot-work-order-${now}`;

  const taskTitle = opts.taskTitle || 'anesty_board dry-run task execution';
  const assignedAgent = opts.assignedAgent || AGENT_ROLES.CLAUDE_CODE;
  const allowedFiles = opts.allowedFiles || [
    'tools/**', 'smoke/**', 'fixtures/**', 'docs/**', 'package.json'
  ];
  const forbiddenFiles = opts.forbiddenFiles || DEFAULT_FORBIDDEN_FILES;
  const verificationCommands = opts.verificationCommands || DEFAULT_VERIFICATION_COMMANDS;
  const doneCriteria = opts.doneCriteria || [
    'node --check passes on all new JS files',
    'smoke test passes',
    'dryRun: true confirmed in output',
    'humanApprovalRequired: true confirmed in output',
    'dangerousActionsDenied present in output'
  ];
  const humanApprovalRequired = opts.humanApprovalRequired !== false;
  const irreversibleActions = opts.irreversibleActions || [
    'deploy', 'git push', 'git tag', 'real send', 'real billing', 'secret access'
  ];

  return {
    pilotWorkOrderId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    workOrder: {
      taskTitle,
      assignedAgent,
      allowedFiles,
      forbiddenFiles,
      verificationCommands,
      doneCriteria,
      humanApprovalRequired,
      dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
      irreversibleActionsRequireHumanGate: irreversibleActions,
      humanRoleNote: 'Human (Junya) role = final YES only for irreversible actions. AI handles all safe-reversible execution.'
    },

    agentRoles: {
      [AGENT_ROLES.CLAUDE_CODE]: 'implementation, file edits, smoke tests, verification',
      [AGENT_ROLES.GPT_AGENT]: 'planning, PM review, design decisions',
      [AGENT_ROLES.GEMINI]: 'bulk reading, summarization, doc review',
      [AGENT_ROLES.GROK]: 'breakthrough review, weakness detection, adversarial check',
      [AGENT_ROLES.HUMAN]: 'final YES only for irreversible actions (deploy, push, tag, real send, billing)'
    },

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalTriggers: irreversibleActions,
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Junya must not be reduced to a copy-paste worker. Human role is final YES only.'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED, AGENT_ROLES,
  DEFAULT_FORBIDDEN_FILES, DEFAULT_VERIFICATION_COMMANDS,
  buildWorkOrder
};

if (require.main === module) {
  const r = buildWorkOrder({});
  console.log(JSON.stringify({ workOrderId: r.pilotWorkOrderId, agent: r.workOrder.assignedAgent }, null, 2));
}
