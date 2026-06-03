'use strict';

const TOOL_META = {
  version: '31.0.0',
  title: 'GitHub Actions Node24 Readiness Pack',
  slug: 'github-actions-node24-readiness-pack'
};

const DANGEROUS_ACTIONS_DENIED = [
  'deploy (any form)',
  'docker build',
  'gcloud deploy',
  'git push (automated)',
  'git tag (automated)',
  'git commit (automated)',
  'git add (automated)',
  'secret read',
  'env read',
  'customer data read',
  'destructive delete (rm -rf, git clean -f, git reset --hard)',
  '.github/workflows real edit (automated)'
];

const AFFECTED_ACTIONS_KNOWN = [
  {
    action: 'actions/checkout',
    currentVersion: 'v4',
    node24Compatible: true,
    note: 'v4 uses Node.js 20 internally but is compatible with Node24 runners'
  },
  {
    action: 'actions/setup-node',
    currentVersion: 'v4',
    node24Compatible: true,
    note: 'v4 supports node-version: 24 directly'
  }
];

const WORKFLOW_FILES_CANDIDATE = [
  '.github/workflows/verify.yml',
  '.github/workflows/pm-agent-launch-readiness.yml'
];

const READINESS_CHECKLIST = [
  { item: 'Identify all .github/workflows/*.yml files', status: 'pending_human_check' },
  { item: 'Check node-version setting in each workflow', status: 'pending_human_check' },
  { item: 'Check actions versions (checkout, setup-node, etc.)', status: 'pending_human_check' },
  { item: 'Verify local node --check passes with Node 24', status: 'pending_human_check' },
  { item: 'Run npm run verify locally under Node 24', status: 'pending_human_check' },
  { item: 'Confirm no deprecated Node.js 20 action warnings in CI', status: 'pending_human_check' },
  { item: 'Confirm package.json engines field (if present) allows Node 24', status: 'pending_human_check' },
  { item: 'Human reviews workflow diff before push', status: 'required_human_action' }
];

const SAFE_INSPECTION_COMMANDS = [
  'cat .github/workflows/verify.yml',
  'cat .github/workflows/pm-agent-launch-readiness.yml',
  'node --version',
  'node --check tools/*.js',
  'node --check smoke/*.js',
  'npm run verify'
];

const FORBIDDEN_ACTIONS = [
  'Edit .github/workflows files without explicit human YES',
  'git push after workflow edit without human review',
  'git tag after workflow edit without human review',
  'Upgrade Node version in CI without running local verify first',
  'Auto-merge workflow changes',
  'Run gcloud / docker commands'
];

const MIGRATION_PLAN = [
  {
    step: 1,
    action: 'Read current .github/workflows/*.yml (safe inspection)',
    actor: 'Human or Claude (read-only)',
    risk: 'none'
  },
  {
    step: 2,
    action: 'Confirm all tools pass node --check under Node 24 locally',
    actor: 'Human',
    risk: 'none'
  },
  {
    step: 3,
    action: 'Run npm run verify under Node 24 locally',
    actor: 'Human',
    risk: 'low'
  },
  {
    step: 4,
    action: 'Propose workflow diff: change node-version from "20" to "24"',
    actor: 'Claude (draft only, no edit)',
    risk: 'low'
  },
  {
    step: 5,
    action: 'こさめ/GPT PM reviews proposed diff',
    actor: 'Kosame/GPT',
    risk: 'review'
  },
  {
    step: 6,
    action: 'じゅんやさん issues YES, then edit .github/workflows/*.yml',
    actor: 'Human',
    risk: 'medium — CI pipeline change'
  },
  {
    step: 7,
    action: 'git add / commit / push workflow change after explicit YES',
    actor: 'Human',
    risk: 'medium'
  },
  {
    step: 8,
    action: 'Verify GitHub Actions CI passes with Node 24',
    actor: 'Human',
    risk: 'medium — CI validation'
  }
];

const ROLLBACK_PLAN = {
  beforeEdit: 'No changes made — nothing to roll back if dry-run only',
  afterEdit: 'Revert workflow file: git checkout -- .github/workflows/verify.yml',
  afterPush: 'git revert <commit> requires explicit じゅんやさん YES',
  note: 'Workflow changes only affect CI; existing local tools remain unaffected'
};

function buildNode24ReadinessPack(input) {
  const readinessId    = `node24-readiness-${Date.now()}`;
  const currentVersion = input.currentNodeVersion || '20';
  const targetVersion  = input.targetNodeVersion  || '24';

  const currentWarningSummary = input.currentWarningSummary ||
    `Node.js ${currentVersion} is being deprecated in GitHub Actions. ` +
    `actions/setup-node@v4 with node-version: "${currentVersion}" will trigger deprecation warnings. ` +
    `Migration to Node.js ${targetVersion} is recommended.`;

  const affectedActions = input.affectedActions || AFFECTED_ACTIONS_KNOWN;
  const workflowFilesCandidate = input.workflowFilesCandidate || WORKFLOW_FILES_CANDIDATE;

  const blockerItems = [];
  if (input.localVerifyFailed) blockerItems.push('Local npm run verify failed under Node 24');
  if (input.nodeCheckFailed)   blockerItems.push('node --check failed under Node 24');
  if (input.humanReviewPending) blockerItems.push('Workflow diff not yet reviewed by human');

  const node24ReadinessPassed = blockerItems.length === 0;

  const recommendedNextAction = node24ReadinessPassed
    ? 'Node24 readiness checks passed. Proceed to step 4: draft workflow diff for human review. Do NOT edit .github/workflows without explicit じゅんやさん YES.'
    : `Resolve blockers before proceeding: ${blockerItems.join('; ')}`;

  return {
    version:                TOOL_META.version,
    title:                  TOOL_META.title,
    dryRun:                 true,
    humanApprovalRequired:  true,
    node24ReadinessId:      readinessId,
    currentWarningSummary,
    affectedActions,
    currentNodeVersion:     currentVersion,
    targetNodeVersion:      targetVersion,
    workflowFilesCandidate,
    readinessChecklist:     READINESS_CHECKLIST,
    safeInspectionCommands: SAFE_INSPECTION_COMMANDS,
    forbiddenActions:       FORBIDDEN_ACTIONS,
    migrationPlan:          MIGRATION_PLAN,
    rollbackPlan:           ROLLBACK_PLAN,
    blockerItems,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    node24ReadinessPassed,
    recommendedNextAction,
    noWorkflowEdit:         true,
    noRealPush:             true,
    noRealTag:              true,
    noRealDeploy:           true
  };
}

function main() {
  console.log(JSON.stringify(buildNode24ReadinessPack({
    currentNodeVersion:    '20',
    targetNodeVersion:     '24',
    currentWarningSummary: 'Node.js 20 deprecation warning detected in GitHub Actions. Migration to Node.js 24 required.'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DANGEROUS_ACTIONS_DENIED,
  AFFECTED_ACTIONS_KNOWN,
  WORKFLOW_FILES_CANDIDATE,
  READINESS_CHECKLIST,
  SAFE_INSPECTION_COMMANDS,
  FORBIDDEN_ACTIONS,
  MIGRATION_PLAN,
  buildNode24ReadinessPack
};
