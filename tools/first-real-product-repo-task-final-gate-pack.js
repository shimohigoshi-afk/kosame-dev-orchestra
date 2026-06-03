'use strict';

const TOOL_META = {
  version: '36.0.0',
  title: 'First Real Product Repo Task Final Gate',
  slug: 'first-real-product-repo-task-final-gate'
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

const HIGH_RISK_PRODUCTS = ['anesty_board'];
const MEDIUM_RISK_PRODUCTS = ['backoffice_agent'];

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

const DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const FINAL_SAFETY_CHECKLIST = [
  { item: 'v35 Readiness Complete passed',                   key: 'readinessCompletePassed',   required: true },
  { item: 'v34 Controlled Launch Packet generated',          key: 'launchPacketReady',          required: true },
  { item: 'v33 First Touch Dry Run completed',               key: 'firstTouchDone',             required: true },
  { item: 'v32 Product Repo Selection decided',              key: 'selectionDecided',           required: true },
  { item: 'v27 Connection Bridge ready',                     key: 'bridgeReady',                required: true },
  { item: 'Task scope limited to docs/smoke/runbook/README', key: 'lowRiskScopeConfirmed',      required: true },
  { item: 'No Secret / .env / API key in task scope',        key: 'noSecretInScope',            required: true },
  { item: 'No customer PII in task scope',                   key: 'noCustomerDataInScope',      required: true },
  { item: 'No deploy in task scope',                         key: 'noDeployInScope',            required: true },
  { item: 'こさめ/GPT PM approval obtained',                 key: 'kosameApproval',             required: true },
  { item: 'じゅんやさん final YES issued',                   key: 'junyaYes',                   required: true }
];

function evaluateChecklist(checks) {
  return FINAL_SAFETY_CHECKLIST.map(item => ({
    ...item,
    status: checks[item.key] ? 'passed' : 'pending'
  }));
}

function buildFinalGate(input) {
  const gateId        = `final-gate-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'email_reply_bot').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const isHighRisk    = HIGH_RISK_PRODUCTS.includes(targetProduct);
  const isMediumRisk  = MEDIUM_RISK_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const checks         = input.checks || {};
  const checklist      = evaluateChecklist(checks);
  const failedRequired = checklist.filter(c => c.required && c.status !== 'passed');

  const allowedScope   = input.allowedScope   || ['docs/**', 'README.md', 'smoke/**', 'runbook/**'];
  const forbiddenScope = input.forbiddenScope || ['.env*', 'secrets/**', 'credentials/**', 'src/auth/**', 'production.config.*'];

  const blockerItems = [];
  if (!isKnown)     blockerItems.push(`Unknown product: ${targetProduct}`);
  if (isHighRisk)   blockerItems.push(`${targetProduct} is high-risk (regulated data). Hold until safe scope confirmed.`);
  if (failedRequired.length > 0) {
    failedRequired.forEach(c => blockerItems.push(`Checklist item pending: ${c.item}`));
  }

  let finalGateDecision;
  if (!isKnown || blockerItems.some(b => b.includes('Unknown'))) {
    finalGateDecision = 'reject';
  } else if (isHighRisk) {
    finalGateDecision = 'hold';
  } else if (isMediumRisk && !checks.lowRiskScopeConfirmed) {
    finalGateDecision = 'hold';
  } else if (failedRequired.length > 0) {
    finalGateDecision = 'revise';
  } else {
    finalGateDecision = 'approve';
  }

  const readyForLaunchHandoff = finalGateDecision === 'approve' && blockerItems.length === 0;

  const recommendedNextAction = readyForLaunchHandoff
    ? `Final gate approved for ${repoCandidate}. Proceed to v37 Launch Handoff packet. ` +
      'Do NOT launch Claude Code until launch handoff packet is reviewed and human YES issued.'
    : finalGateDecision === 'hold'
      ? `HOLD: ${blockerItems[0] || 'High-risk scope'}. Define safe scope before proceeding.`
      : `Resolve blockers: ${blockerItems.slice(0, 2).join('; ')}`;

  return {
    version:                TOOL_META.version,
    title:                  TOOL_META.title,
    dryRun:                 true,
    humanApprovalRequired:  true,
    finalGateId:            gateId,
    targetProduct,
    targetRepoCandidate:    repoCandidate,
    firstTaskCandidate:     input.firstTaskCandidate || 'docs整備: README.md に目次・概要セクションを追加する',
    finalSafetyChecklist:   checklist,
    repoSelectionReview:    input.repoSelectionReview   || { status: checks.selectionDecided ? 'passed' : 'pending' },
    firstTouchReview:       input.firstTouchReview      || { status: checks.firstTouchDone   ? 'passed' : 'pending' },
    controlledLaunchReview: input.controlledLaunchReview || { status: checks.launchPacketReady ? 'passed' : 'pending' },
    readinessReview:        input.readinessReview       || { status: checks.readinessCompletePassed ? 'passed' : 'pending' },
    humanApprovalContract: {
      requiredFor: ['Any file edit in target repo', 'Claude Code launch', 'Any git operation', 'Any deploy'],
      approvalChain: ['Step 1: こさめ/GPT PM approves', 'Step 2: じゅんやさん issues final YES']
    },
    allowedScope,
    forbiddenScope,
    blockerItems,
    finalGateDecision,
    decisionOptions:         DECISION_OPTIONS,
    readyForLaunchHandoff,
    dangerousActionsDenied:  DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealRepoEdit:          true,
    noRealGitCommit:         true,
    noRealGitPush:           true,
    noRealDeploy:            true,
    noSecretRead:            true
  };
}

function main() {
  console.log(JSON.stringify(buildFinalGate({
    targetProduct:    'email_reply_bot',
    firstTaskCandidate: 'docs整備: README.md に目次・概要セクションを追加する',
    checks: {
      readinessCompletePassed: true, launchPacketReady: true, firstTouchDone: true,
      selectionDecided: true, bridgeReady: true, lowRiskScopeConfirmed: true,
      noSecretInScope: true, noCustomerDataInScope: true, noDeployInScope: true,
      kosameApproval: true, junyaYes: true
    },
    allowedScope:   ['docs/**', 'README.md', 'smoke/**'],
    forbiddenScope: ['.env*', 'secrets/**', 'credentials/**']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  FINAL_SAFETY_CHECKLIST,
  DECISION_OPTIONS,
  HIGH_RISK_PRODUCTS,
  buildFinalGate
};
