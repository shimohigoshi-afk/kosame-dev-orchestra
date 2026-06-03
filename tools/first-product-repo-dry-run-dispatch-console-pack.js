'use strict';

const TOOL_META = {
  version: '28.0.0',
  title: 'First Product Repo Dry Run Dispatch Console',
  slug: 'first-product-repo-dry-run-dispatch-console'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_CANDIDATES = {
  sales_dx:           'kosame-sales-dx',
  anesty_board:       'kosame-anesty-board',
  backoffice_agent:   'kosame-backoffice-agent',
  email_reply_bot:    'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
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
  'destructive delete (rm -rf, git clean -f, git reset --hard)'
];

const BLOCKED_ACTIONS = [
  'real_repo_edit',
  'real_git_commit',
  'real_git_push',
  'real_git_tag',
  'real_deploy',
  'secret_access',
  'customer_data_access',
  'auto_merge',
  'auto_release'
];

const ALLOWED_ACTIONS = [
  'generate_dry_run_dispatch_packet',
  'describe_expected_claude_steps',
  'describe_expected_human_steps',
  'outline_verification_plan',
  'outline_rollback_plan',
  'summarize_work_order',
  'summarize_connection_bridge',
  'summarize_preflight',
  'summarize_execution_prompt'
];

function buildDryRunSteps(targetProduct, workOrderSummary) {
  return [
    { step: 1, actor: 'Human',   action: `Confirm work order for ${targetProduct}: ${workOrderSummary || '(task goal)'}` },
    { step: 2, actor: 'Human',   action: 'Confirm connection bridge ready (v27 bridge passed)' },
    { step: 3, actor: 'Human',   action: 'Confirm preflight passed (v25.5 preflight passed)' },
    { step: 4, actor: 'Claude',  action: 'Receive execution prompt and task packet (dry-run only — no real execution)' },
    { step: 5, actor: 'Claude',  action: 'Generate implementation plan (no file writes until human YES)' },
    { step: 6, actor: 'Human',   action: 'Review implementation plan; issue YES or revision' },
    { step: 7, actor: 'Claude',  action: 'Execute approved edits within allowed file zones only' },
    { step: 8, actor: 'Claude',  action: 'Run node --check and verification suite (read-only)' },
    { step: 9, actor: 'Claude',  action: 'Generate handoff report (no git commit, no push)' },
    { step: 10, actor: 'Human',  action: 'Review handoff report via v29 Result Review Console' }
  ];
}

function buildVerificationPlan(targetProduct) {
  return {
    nodeCheck:      `node --check on all added/modified JS files in ${REPO_CANDIDATES[targetProduct] || targetProduct}`,
    smokeTest:      'npm run verify (existing test suite, read-only)',
    fileZoneCheck:  'Confirm all changes are within allowedFileZones from work order',
    noSecretCheck:  'Confirm no .env / secrets / credential files were touched',
    gitStatusCheck: 'git status --short (read-only) — no add/commit/push',
    humanReview:    'Final review by こさめ/GPT PM, then じゅんやさん YES before any git operation'
  };
}

function buildRollbackPlan(targetProduct, repoCandidate) {
  return {
    preDispatch:  'No changes made in dry-run dispatch phase — nothing to roll back',
    postDispatch: `git checkout -- <changed_file> for each file in ${repoCandidate || targetProduct}`,
    forbidden:    'git reset --hard / git clean -f require explicit じゅんやさん YES',
    note:         'Dry-run dispatch phase makes zero changes to target repo'
  };
}

function buildDispatchConsole(input) {
  const dispatchId    = `dry-run-dispatch-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const workOrderSummary        = String(input.workOrderSummary        || '(work order not provided)').trim();
  const connectionBridgeSummary = String(input.connectionBridgeSummary || '(bridge not provided)').trim();
  const preflightSummary        = String(input.preflightSummary        || '(preflight not provided)').trim();
  const executionPromptSummary  = String(input.executionPromptSummary  || '(execution prompt not provided)').trim();

  const hasBridgeSummary    = !!input.connectionBridgeSummary;
  const hasPreflightSummary = !!input.preflightSummary;
  const hasWorkOrder        = !!input.workOrderSummary;

  const dryRunSteps     = buildDryRunSteps(targetProduct, workOrderSummary);
  const verificationPlan = buildVerificationPlan(targetProduct);
  const rollbackPlan    = buildRollbackPlan(targetProduct, repoCandidate);

  const expectedClaudeActions = [
    'Receive and parse execution prompt packet',
    'Generate implementation plan (no edits until human YES)',
    'Edit files only within allowed zones after human approval',
    'Run node --check on all changed files',
    'Run verification suite (npm run verify)',
    'Generate handoff result report (no git operations)'
  ];

  const expectedHumanActions = [
    'Confirm work order and scope before dispatch',
    'Review Claude implementation plan and issue YES/revision',
    'Review handoff result report via v29 Result Review Console',
    'Issue final YES for commit candidate (if approved by こさめ/GPT PM first)'
  ];

  const notReadyReasons = [];
  if (!isKnown)            notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (!hasWorkOrder)       notReadyReasons.push('workOrderSummary missing');
  if (!hasBridgeSummary)   notReadyReasons.push('connectionBridgeSummary missing (v27 bridge required)');
  if (!hasPreflightSummary) notReadyReasons.push('preflightSummary missing (v25.5 preflight required)');

  const dispatchDryRunReady = isKnown && hasWorkOrder && hasBridgeSummary && hasPreflightSummary;

  const recommendedNextAction = dispatchDryRunReady
    ? 'Dry-run dispatch console ready. Present to Claude with execution prompt. Await implementation plan before any edits.'
    : `Dispatch not ready. Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    dryRunDispatchId:         dispatchId,
    targetProduct,
    targetRepoCandidate:      repoCandidate,
    workOrderSummary,
    connectionBridgeSummary,
    preflightSummary,
    executionPromptSummary,
    dryRunSteps,
    expectedClaudeActions,
    expectedHumanActions,
    allowedActions:           ALLOWED_ACTIONS,
    blockedActions:           BLOCKED_ACTIONS,
    verificationPlan,
    rollbackPlan,
    dispatchDryRunReady,
    notReadyReasons,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealRepoEdit:           true,
    noRealGitCommit:          true,
    noRealGitPush:            true,
    noRealDeploy:             true,
    noRealSecretRead:         true
  };
}

function main() {
  console.log(JSON.stringify(buildDispatchConsole({
    targetProduct:            'sales_dx',
    workOrderSummary:         '営業DXリード向けメール一括返信機能を src/leads/ に追加する。tests/**も更新する。',
    connectionBridgeSummary:  'bridge-123456: kosame-sales-dx, dry_run_readonly_bridge_only, connectionBridgeReady=true',
    preflightSummary:         'preflight-789: external-repo-preflight passed, no secrets detected, allowed zones confirmed',
    executionPromptSummary:   'Claude execution prompt: add bulkEmailReply() to src/leads/bulk-email-reply.js'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  BLOCKED_ACTIONS,
  ALLOWED_ACTIONS,
  buildDispatchConsole
};
