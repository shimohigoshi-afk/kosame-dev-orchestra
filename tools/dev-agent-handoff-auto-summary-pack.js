'use strict';

const TOOL_META = {
  version: '84.0.0',
  title: 'KOSAME Dev Orchestra Handoff Auto Summary Pack',
  slug: 'dev-agent-handoff-auto-summary-pack'
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

const TARGET_AUDIENCE = ['next_kosame', 'claude_code', 'external_se', 'human_owner'];

function buildHandoffAutoSummary(input = {}) {
  return {
    handoffSummaryId: input.handoffSummaryId || 'handoff-auto-summary-v84',
    targetAudience: input.targetAudience || TARGET_AUDIENCE,
    milestoneSummary: input.milestoneSummary || [
      { version: 'v44.0.0', summary: 'ANESTY Board controlled task trial packs connected to real repo workflow' },
      { version: 'v60.0.0', summary: 'Multi-product operation line completed' },
      { version: 'v65.0.0', summary: 'Product validation line completed' },
      { version: 'v75.0.0', summary: 'Guardian Class and Revenue Launch Line completed' },
      { version: 'v80.0.0', summary: 'Command Center Line completed' }
    ],
    currentState: input.currentState || {
      latestStableVersion: 'v80.0.0',
      currentLine: 'v81-v85 Operation Memory Line',
      repo: '/home/shimohigoshi/kosame-dev-orchestra',
      status: 'BUILDING_MEMORY_LAYER'
    },
    latestStableVersion: input.latestStableVersion || 'v80.0.0',
    activeRisks: input.activeRisks || [
      'context limit may interrupt large multi-version tasks',
      'partial files must not be committed without smoke and verify',
      'untracked kosame-dev-orchestra@14.0.0 and node must remain untracked'
    ],
    nextRecommendedActions: input.nextRecommendedActions || [
      'Finish v81-v85 only',
      'Run real node --check, five smoke scripts, and npm run verify',
      'Acceptance Gate before commit',
      'Then continue v86-v90 as a separate chunk'
    ],
    doNotForget: input.doNotForget || [
      'Preserve verify chain',
      'Never use git add -A',
      'Do not read secrets or customer data',
      'Junya is final YES, not manual worker'
    ],
    dryRun: true,
    humanApprovalRequired: true,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED
  };
}

if (require.main === module) {
  console.log(JSON.stringify(buildHandoffAutoSummary(), null, 2));
}

module.exports = {
  TOOL_META,
  TARGET_AUDIENCE,
  DANGEROUS_ACTIONS_DENIED,
  buildHandoffAutoSummary
};
