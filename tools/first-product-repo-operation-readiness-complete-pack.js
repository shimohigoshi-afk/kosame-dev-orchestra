'use strict';

const TOOL_META = {
  version: '35.0.0',
  title: 'First Product Repo Operation Readiness Complete',
  slug: 'first-product-repo-operation-readiness-complete'
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

const READINESS_STAGES = [
  { stageId: 'v30_e2e_prototype',       name: 'E2E Operation Prototype (v30)',       required: true },
  { stageId: 'v31_node24_readiness',    name: 'Node24 Readiness (v31)',              required: false },
  { stageId: 'v32_repo_selection',      name: 'Product Repo Selection (v32)',        required: true },
  { stageId: 'v33_first_touch_dry_run', name: 'First Touch Dry Run (v33)',           required: true },
  { stageId: 'v27_connection_bridge',   name: 'Connection Bridge (v27)',             required: true },
  { stageId: 'v25_work_order',          name: 'Work Order (v25)',                    required: true },
  { stageId: 'v28_dry_run_dispatch',    name: 'Dry Run Dispatch (v28)',              required: true },
  { stageId: 'v34_launch_packet',       name: 'Controlled Task Launch Packet (v34)', required: true }
];

const PROVIDER_ROLE_MAP = {
  'Kosame/GPT': [
    'PM: repo selection and task scoping',
    'Safety gate: approve/hold/reject at each stage',
    'Final review before presenting commit candidate to じゅんやさん'
  ],
  'Claude': [
    'Packet generation: connection bridge, work order, launch packet',
    'File edits within approved zones only after human YES',
    'Verification: node --check and test suite',
    'Handoff report generation (no git operations)'
  ],
  'Gemini': [
    'Bulk work intake support',
    'Draft expansion for documentation tasks',
    'Fallback provider when Claude unavailable'
  ],
  'Grok': [
    'Research and analysis support',
    'Secondary review of implementation plans',
    'Read-only external context lookup'
  ],
  'DeepSeek': [
    'Code analysis and review support',
    'Alternative implementation suggestions'
  ],
  'Kimi': [
    'Long-context document review',
    'Multi-file consistency analysis'
  ],
  'Cloud Shell': [
    'CLI execution environment (node, npm, git log/status)',
    'node --check and smoke runs',
    'Safe read-only inspection commands'
  ],
  'Human': [
    'じゅんやさん: final YES for all commit/push/tag/deploy',
    'こさめ/GPT PM: safety gate and approval delegation',
    'Task intake, scope confirmation, and launch approval'
  ]
};

const HUMAN_APPROVAL_CONTRACT = {
  requiredFor: [
    'Any git add / commit / push / tag',
    'Any deploy operation',
    'Any file edit in target product repo',
    'Launching Claude Code on target repo',
    'Any operation outside allowed file zones'
  ],
  approvalChain: [
    'Step 1: こさめ/GPT PM reviews stage outputs and issues approval',
    'Step 2: じゅんやさん issues final YES for any git or deploy operations'
  ]
};

const SAFETY_BOUNDARY = {
  noRealRepoEdit:    'Product repo files not modified until explicit human YES + controlled launch',
  noRealGitOps:      'No git add/commit/push/tag without explicit human YES',
  noRealDeploy:      'No deploy in any readiness stage',
  noSecretRead:      'No .env / secrets / credentials accessed',
  noCustomerData:    'No PII / insurance / health / financial data accessed'
};

const DECISION_OPTIONS = ['approve', 'revise', 'reject', 'hold'];

const HIGH_RISK_PRODUCTS = ['anesty_board'];

function buildReadinessComplete(input) {
  const readinessId   = `readiness-complete-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'email_reply_bot').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;
  const isHighRisk    = HIGH_RISK_PRODUCTS.includes(targetProduct);

  const completedStageIds = input.completedStages || [];
  const completedStages   = READINESS_STAGES.filter(s => completedStageIds.includes(s.stageId));
  const missingStages     = READINESS_STAGES.filter(s => s.required && !completedStageIds.includes(s.stageId));

  const firstTaskCandidate  = input.firstTaskCandidate  || 'docs整備: README.md の目次・概要セクションを追加する';
  const firstTaskRiskLevel  = input.firstTaskRiskLevel  || (isHighRisk ? 'high' : 'low');
  const firstTaskAllowedScope  = input.firstTaskAllowedScope  || ['docs/**', 'README.md', 'smoke/**'];
  const firstTaskForbiddenScope = input.firstTaskForbiddenScope || ['.env*', 'secrets/**', 'src/auth/**', 'production.config.*'];

  let finalReadinessDecision;
  if (!isKnown) {
    finalReadinessDecision = 'reject';
  } else if (isHighRisk) {
    finalReadinessDecision = 'hold';
  } else if (missingStages.length > 0) {
    finalReadinessDecision = 'revise';
  } else {
    finalReadinessDecision = 'approve';
  }

  const readyForFirstRealProductRepoTask =
    finalReadinessDecision === 'approve' &&
    isKnown &&
    !isHighRisk &&
    missingStages.length === 0;

  const nextVersionCandidates = readyForFirstRealProductRepoTask
    ? [
        { version: 'v36.0.0', suggestion: 'First Real Product Repo Task Execution — execute controlled launch packet on target repo with human gate' },
        { version: 'v37.0.0', suggestion: 'First Real Product Repo Commit Candidate — git add/commit with じゅんやさん YES' }
      ]
    : finalReadinessDecision === 'hold'
      ? [{ version: 'v35.1.0', suggestion: `Resolve hold condition for ${targetProduct}: lower risk scope or switch product` }]
      : [{ version: 'v35.0.1', suggestion: `Complete missing stages: ${missingStages.map(s => s.name).join(', ')}` }];

  const notReadyReasons = [];
  if (!isKnown)          notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (isHighRisk)        notReadyReasons.push(`${targetProduct} is high-risk (regulated data). Hold until explicit safe scope defined.`);
  if (missingStages.length > 0) {
    notReadyReasons.push(`Missing required stages: ${missingStages.map(s => s.name).join(', ')}`);
  }

  const recommendedNextAction = readyForFirstRealProductRepoTask
    ? `Readiness complete for ${repoCandidate}. Proceed to v36 First Real Product Repo Task Execution. ` +
      'こさめ/GPT PM approval required, then じゅんやさん final YES before Claude Code launch.'
    : finalReadinessDecision === 'hold'
      ? `HOLD: ${targetProduct} is high-risk. Define a safe, low-risk first task scope before proceeding.`
      : `Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:                       TOOL_META.version,
    title:                         TOOL_META.title,
    dryRun:                        true,
    humanApprovalRequired:         true,
    readinessCompleteId:           readinessId,
    targetProduct,
    targetRepoCandidate:           repoCandidate,
    readinessStages:               READINESS_STAGES,
    completedStages:               completedStages.map(s => s.stageId),
    missingStages:                 missingStages.map(s => ({ stageId: s.stageId, name: s.name })),
    safetyBoundary:                SAFETY_BOUNDARY,
    humanApprovalContract:         HUMAN_APPROVAL_CONTRACT,
    firstTaskCandidate,
    firstTaskRiskLevel,
    firstTaskAllowedScope,
    firstTaskForbiddenScope,
    providerRoleMap:               PROVIDER_ROLE_MAP,
    finalReadinessDecision,
    decisionOptions:               DECISION_OPTIONS,
    nextVersionCandidates,
    notReadyReasons,
    readyForFirstRealProductRepoTask,
    dangerousActionsDenied:        DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealRepoEdit:                true,
    noRealGitCommit:               true,
    noRealGitPush:                 true,
    noRealDeploy:                  true,
    noSecretRead:                  true
  };
}

function main() {
  console.log(JSON.stringify(buildReadinessComplete({
    targetProduct:     'email_reply_bot',
    completedStages:   [
      'v30_e2e_prototype',
      'v31_node24_readiness',
      'v32_repo_selection',
      'v33_first_touch_dry_run',
      'v27_connection_bridge',
      'v25_work_order',
      'v28_dry_run_dispatch',
      'v34_launch_packet'
    ],
    firstTaskCandidate:    'docs整備: README.md の目次・概要セクションを追加する',
    firstTaskRiskLevel:    'low',
    firstTaskAllowedScope: ['docs/**', 'README.md', 'smoke/**'],
    firstTaskForbiddenScope: ['.env*', 'secrets/**', 'src/auth/**']
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  READINESS_STAGES,
  PROVIDER_ROLE_MAP,
  HUMAN_APPROVAL_CONTRACT,
  SAFETY_BOUNDARY,
  DECISION_OPTIONS,
  HIGH_RISK_PRODUCTS,
  buildReadinessComplete
};
