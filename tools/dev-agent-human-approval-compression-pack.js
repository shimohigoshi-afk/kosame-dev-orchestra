'use strict';

const TOOL_META = {
  version: '102.0.0',
  title: 'KOSAME Dev Orchestra Human Approval Compression Pack',
  slug: 'dev-agent-human-approval-compression-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'self-authorizing deploy', 'self-authorizing push/tag', 'self-authorizing billing',
  'self-authorizing secret access', 'self-authorizing real send',
  'self-authorizing contract execution', 'self-authorizing customer data access',
  'bypassing humanApprovalRequired gate'
];

const HUMAN_APPROVAL_GATES = [
  { action: 'deploy', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'git push', risk: 'high', reversible: false, requiresHumanYes: true },
  { action: 'git tag', risk: 'high', reversible: false, requiresHumanYes: true },
  { action: 'secret access', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: '.env read', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'customer data access', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'Gmail/PDF data access', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'real send', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'contract execution', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'billing', risk: 'critical', reversible: false, requiresHumanYes: true },
  { action: 'destructive delete', risk: 'critical', reversible: false, requiresHumanYes: true }
];

const SAFE_AI_TASKS = [
  { task: 'file editing (non-secret)', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'smoke test execution', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'dry-run report generation', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'fixture/mock data creation', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'node --check syntax validation', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'npm run verify', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'planning / task ordering', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'doc generation', risk: 'low', reversible: true, aiExecutable: true },
  { task: 'git status / git diff (read-only)', risk: 'low', reversible: true, aiExecutable: true }
];

function buildHumanApprovalCompression(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `human-approval-compression-${now}`;

  const pendingActions = opts.pendingActions || [];

  const humanGates = pendingActions.filter(a =>
    HUMAN_APPROVAL_GATES.some(g => a.toLowerCase().includes(g.action.toLowerCase()))
  );
  const safeForAI = pendingActions.filter(a =>
    !HUMAN_APPROVAL_GATES.some(g => a.toLowerCase().includes(g.action.toLowerCase()))
  );

  const compressionResult = {
    totalPendingActions: pendingActions.length,
    humanGateCount: humanGates.length,
    safeForAICount: safeForAI.length,
    humanGates,
    safeForAI,
    compressionRatio: pendingActions.length > 0
      ? `${safeForAI.length}/${pendingActions.length} safe for AI (${Math.round(safeForAI.length / pendingActions.length * 100)}%)`
      : 'no pending actions'
  };

  return {
    humanApprovalCompressionId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: humanGates.length > 0,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    humanApprovalGates: HUMAN_APPROVAL_GATES,
    safeAITasks: SAFE_AI_TASKS,
    compressionResult,

    principle: 'Guard only irreversible danger zones; move fast everywhere else.',

    humanApprovalPacket: {
      junyaApprovalRequired: humanGates.length > 0,
      pendingHumanGates: humanGates,
      note: humanGates.length > 0
        ? `${humanGates.length} actions require Junya YES before execution`
        : 'No human approval gates triggered for current pending actions'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  HUMAN_APPROVAL_GATES, SAFE_AI_TASKS,
  buildHumanApprovalCompression
};

if (require.main === module) {
  const r = buildHumanApprovalCompression({ pendingActions: ['run smoke test', 'deploy to cloud run', 'edit docs'] });
  console.log(JSON.stringify(r.compressionResult, null, 2));
}
