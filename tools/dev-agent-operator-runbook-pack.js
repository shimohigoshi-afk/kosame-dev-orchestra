'use strict';

const TOOL_META = {
  version: '101.0.0',
  title: 'KOSAME Dev Orchestra Operator Runbook Pack',
  slug: 'dev-agent-operator-runbook-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'secret read', '.env read', 'deploy without approval',
  'git push/tag without approval', 'real billing', 'destructive delete'
];

const RUNBOOK_SECTIONS = [
  'restart_check',
  'task_selection',
  'agent_assignment',
  'verification',
  'approval',
  'backup',
  'handoff'
];

function buildOperatorRunbook(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `operator-runbook-${now}`;

  const orchestraVersion = opts.orchestraVersion || '100.0.0';

  const runbook = {
    restart_check: {
      title: 'Restart Check',
      steps: [
        '1. Run: node tools/dev-agent-first-pilot-operation-complete-gate-pack.js',
        '2. Confirm dryRun: true, humanApprovalRequired: true in output',
        '3. Check npm run verify passes',
        '4. Review last git log for current state',
        '5. Confirm no untracked sensitive files present'
      ],
      automatedBy: 'ClaudeCode',
      humanRequired: false
    },
    task_selection: {
      title: 'Task Selection',
      steps: [
        '1. Review current product status (anesty_board = safest pilot candidate)',
        '2. Select task from approved pilot scope only',
        '3. Confirm task is in allowedFiles boundary',
        '4. Confirm task does NOT require forbidden files or real data'
      ],
      automatedBy: 'ClaudeCode + GPTAgent',
      humanRequired: false
    },
    agent_assignment: {
      title: 'Agent Assignment',
      steps: [
        '1. ClaudeCode: implementation, file edits, verification',
        '2. GPTAgent: planning, PM decisions, design review',
        '3. Gemini: bulk reading, summarization',
        '4. Grok: adversarial/weakness review',
        '5. Human (Junya): final YES for irreversible actions only'
      ],
      automatedBy: 'GPTAgent routing',
      humanRequired: false
    },
    verification: {
      title: 'Verification',
      steps: [
        '1. Run: node --check on all modified JS files',
        '2. Run: npm run verify',
        '3. Confirm all smoke tests PASS',
        '4. Confirm dryRun outputs show no real actions executed'
      ],
      automatedBy: 'ClaudeCode',
      humanRequired: false
    },
    approval: {
      title: 'Approval Gate',
      steps: [
        '1. AI presents humanApprovalPacket to Junya',
        '2. Junya reviews: deploy/push/tag/billing/secret/real send',
        '3. Junya gives YES/NO',
        '4. If NO: AI re-plans without the irreversible action',
        '5. No self-authorization of irreversible actions by AI'
      ],
      automatedBy: 'none — human only',
      humanRequired: true
    },
    backup: {
      title: 'Backup',
      steps: [
        '1. Confirm last commit hash is recorded in session notes',
        '2. Confirm fixture/fixture outputs are saved',
        '3. No uncommitted destructive changes',
        '4. If session interrupted: restart from restart_check step'
      ],
      automatedBy: 'ClaudeCode',
      humanRequired: false
    },
    handoff: {
      title: 'Handoff',
      steps: [
        '1. Generate session handoff summary',
        '2. Record: what was done, what is next, any open blockers',
        '3. Commit humanApprovalPacket for next session',
        '4. Confirm: no real actions executed this session'
      ],
      automatedBy: 'ClaudeCode',
      humanRequired: false
    }
  };

  return {
    operatorRunbookId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    orchestraVersion,
    runbookSections: RUNBOOK_SECTIONS,
    runbook,

    quickReference: {
      safeAITasks: ['task_selection', 'agent_assignment', 'verification', 'backup', 'handoff', 'restart_check'],
      humanOnlyTasks: ['approval'],
      note: 'Human approval required only for irreversible gates'
    },

    humanApprovalPacket: {
      junyaApprovalRequired: true,
      approvalActions: ['deploy', 'push', 'tag', 'billing', 'secret access', 'real send'],
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'Runbook is operational guide. AI executes safe steps autonomously.'
    },

    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = { TOOL_META, DANGEROUS_ACTIONS_DENIED, RUNBOOK_SECTIONS, buildOperatorRunbook };

if (require.main === module) {
  const r = buildOperatorRunbook({});
  console.log(JSON.stringify({ sections: r.runbookSections, humanOnly: r.quickReference.humanOnlyTasks }, null, 2));
}
