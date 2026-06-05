'use strict';

const TOOL_META = {
  version: '104.0.0',
  title: 'KOSAME Dev Orchestra Revision Sprint Planner Pack',
  slug: 'dev-agent-revision-sprint-planner-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'real customer data read', 'Gmail data read', 'insurance data read',
  'real send', 'real billing', 'deploy without approval',
  'git push/tag without approval', 'secret read', '.env read', 'destructive delete'
];

const PRIORITY_LEVELS = ['P0_critical', 'P1_high', 'P2_medium', 'P3_low'];

const OWNER_ROUTES = {
  CLAUDE_CODE: 'ClaudeCode',
  GPT_AGENT: 'GPTAgent',
  GEMINI: 'Gemini',
  GROK: 'Grok',
  HUMAN: 'Human'
};

function buildRevisionSprintPlanner(opts) {
  opts = opts || {};
  const now = opts.timestamp || Date.now();
  const id = `revision-sprint-planner-${now}`;

  const feedbackItems = opts.feedbackItems || [
    {
      product: 'anesty_board',
      category: 'usability',
      severity: 'medium',
      description: 'Task board display needs clearer status labels',
      revisionSuggestion: 'Add status badge component with color coding'
    }
  ];

  const sprints = feedbackItems.map((item, idx) => ({
    sprintId: `sprint-${idx + 1}-${item.product}`,
    product: item.product,
    priority: item.severity === 'critical' ? 'P0_critical'
      : item.severity === 'high' ? 'P1_high'
      : item.severity === 'medium' ? 'P2_medium' : 'P3_low',
    description: item.revisionSuggestion || item.description,
    allowedFiles: opts.defaultAllowedFiles || ['tools/**', 'smoke/**', 'fixtures/**', 'docs/**'],
    forbiddenFiles: opts.defaultForbiddenFiles || ['.env', '**/*.key', 'customer_data/**'],
    verificationCommands: ['node --check tools/*.js', 'npm run verify'],
    doneCriteria: [
      'smoke test passes',
      'dryRun: true confirmed in output',
      'humanApprovalRequired: true where irreversible actions implied'
    ],
    rollbackNotes: 'Revert last commit if smoke fails after change',
    ownerRoute: item.severity === 'critical' ? OWNER_ROUTES.HUMAN : OWNER_ROUTES.CLAUDE_CODE,
    humanApprovalRequired: item.severity === 'critical'
  }));

  const summary = {
    totalSprints: sprints.length,
    byPriority: PRIORITY_LEVELS.reduce((acc, p) => {
      acc[p] = sprints.filter(s => s.priority === p).length;
      return acc;
    }, {}),
    humanApprovalRequired: sprints.filter(s => s.humanApprovalRequired).length
  };

  return {
    revisionSprintPlannerId: id,
    version: TOOL_META.version,
    title: TOOL_META.title,
    dryRun: true,
    humanApprovalRequired: summary.humanApprovalRequired > 0,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,

    sprints,
    summary,
    priorityLevels: PRIORITY_LEVELS,
    ownerRoutes: OWNER_ROUTES,

    humanApprovalPacket: {
      junyaApprovalRequired: summary.humanApprovalRequired > 0,
      criticalSprints: sprints.filter(s => s.priority === 'P0_critical').map(s => s.sprintId),
      deniedActionsForAI: DANGEROUS_ACTIONS_DENIED,
      note: 'P0 critical sprints require Junya YES before execution'
    },

    blockers: opts.blockers || [],
    realProductActionsExecuted: false,
    generatedAt: new Date(now).toISOString()
  };
}

module.exports = {
  TOOL_META, DANGEROUS_ACTIONS_DENIED,
  PRIORITY_LEVELS, OWNER_ROUTES,
  buildRevisionSprintPlanner
};

if (require.main === module) {
  const r = buildRevisionSprintPlanner({});
  console.log(JSON.stringify({ totalSprints: r.summary.totalSprints, byPriority: r.summary.byPriority }, null, 2));
}
