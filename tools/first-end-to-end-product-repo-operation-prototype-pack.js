'use strict';

const TOOL_META = {
  version: '30.0.0',
  title: 'First End-to-End Product Repo Operation Prototype',
  slug: 'first-end-to-end-product-repo-operation-prototype'
};

const SUPPORTED_PRODUCT_TYPES = [
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

const BLOCKED_OPERATION_MODES = [
  'direct_deploy',
  'auto_push',
  'auto_tag',
  'secret_inspection',
  'customer_data_scan',
  'destructive_cleanup'
];

const ALLOWED_OPERATION_MODES = [
  'dry_run_only',
  'dry_run_dispatch',
  'dry_run_review',
  'human_approved_edit',
  'readonly_bridge',
  'packet_generation'
];

const E2E_FLOW_STAGES = [
  {
    stage: 1,
    name: 'Intake',
    description: 'Receive task request from じゅんやさん / こさめ/GPT PM',
    outputKey: 'intakeOutput',
    actor: 'Human + Kosame/GPT',
    tool: 'repo-task-intake-console-pack'
  },
  {
    stage: 2,
    name: 'Product Repo Task Packet',
    description: 'Generate task packet with scope, goals, allowed file zones',
    outputKey: 'taskPacketOutput',
    actor: 'Claude',
    tool: 'first-product-repo-task-packet-pack'
  },
  {
    stage: 3,
    name: 'Connection Bridge',
    description: 'Build dry-run connection bridge to target repo (v27)',
    outputKey: 'connectionBridgeOutput',
    actor: 'Claude',
    tool: 'first-real-product-repo-connection-bridge-pack'
  },
  {
    stage: 4,
    name: 'Work Order',
    description: 'Generate detailed work order with file zones and rollback plan (v25)',
    outputKey: 'workOrderOutput',
    actor: 'Claude',
    tool: 'first-product-repo-work-order-console-pack'
  },
  {
    stage: 5,
    name: 'External Repo Preflight',
    description: 'Safety preflight checks before any edits (v25.5)',
    outputKey: 'preflightOutput',
    actor: 'Claude',
    tool: 'external-repo-preflight-command-pack'
  },
  {
    stage: 6,
    name: 'Execution Prompt Pack',
    description: 'Generate Claude execution prompt for target repo (v24)',
    outputKey: 'executionPromptOutput',
    actor: 'Claude',
    tool: 'first-real-product-repo-execution-prompt-pack'
  },
  {
    stage: 7,
    name: 'Dry Run Dispatch',
    description: 'Dispatch console dry-run — describe what Claude will do, no real execution (v28)',
    outputKey: 'dryRunDispatchOutput',
    actor: 'Claude + Human approval',
    tool: 'first-product-repo-dry-run-dispatch-console-pack'
  },
  {
    stage: 8,
    name: 'Handoff & Result Import',
    description: 'Import Claude result report; scan for safety issues (v26)',
    outputKey: 'handoffImportOutput',
    actor: 'Claude + Human review',
    tool: 'first-product-repo-handoff-result-import-pack'
  },
  {
    stage: 9,
    name: 'Result Review',
    description: 'Review imported results: approve / revise / reject / hold (v29)',
    outputKey: 'resultReviewOutput',
    actor: 'Kosame/GPT PM + Claude',
    tool: 'first-product-repo-result-review-console-pack'
  },
  {
    stage: 10,
    name: 'Commit Candidate Decision',
    description: 'Final commit/push/tag decision — じゅんやさん YES required',
    outputKey: 'commitCandidateOutput',
    actor: 'Human (じゅんやさん)',
    tool: 'commit-candidate-packet-builder-pack'
  }
];

const PROVIDER_ROLE_MAP = {
  'Kosame/GPT': [
    'PM: intake review and task scoping',
    'Safety gate: approve/hold/reject at each stage',
    'Integration judge: cross-stage consistency check',
    'Final review before presenting to じゅんやさん'
  ],
  'Claude': [
    'Implementation: generate task packets, work orders, execution prompts',
    'Dry-run execution: edit files within approved zones only',
    'Verification: run node --check and test suite',
    'Handoff: generate result report for review'
  ],
  'Gemini': [
    'Bulk work intake support',
    'Draft expansion for large refactors',
    'Fallback provider when Claude unavailable'
  ],
  'Grok': [
    'Research and analysis support',
    'External information lookup (read-only)',
    'Secondary review layer'
  ],
  'DeepSeek': [
    'Code analysis and review support',
    'Alternative implementation suggestions',
    'Read-only research tasks'
  ],
  'Kimi': [
    'Document review and summarization',
    'Long-context analysis tasks',
    'Multi-file consistency review'
  ],
  'Cloud Shell': [
    'CLI execution environment (gcloud, node, npm)',
    'git status / git log (read-only)',
    'node --check and smoke runs'
  ],
  'Human': [
    'じゅんやさん: final YES for all commit/push/tag/deploy',
    'こさめ/GPT PM: safety gate and approval delegation',
    'Task intake and scope confirmation',
    'Review and hold/reject authority at any stage'
  ]
};

const HUMAN_APPROVAL_CONTRACT = {
  requiredFor: [
    'Any git add / commit / push / tag',
    'Any deploy operation',
    'Any file edit beyond dry-run packet generation',
    'Any Secret / .env / credential access attempt',
    'Any customer data access attempt',
    'Any operation outside allowed file zones'
  ],
  approvalChain: [
    'Step 1: こさめ/GPT PM reviews and approves stage output',
    'Step 2: じゅんやさん issues final YES before git or deploy operations'
  ],
  blockedWithoutApproval: [
    'git commit', 'git push', 'git tag', 'deploy', 'docker build', 'gcloud deploy'
  ]
};

const SAFETY_BOUNDARY = {
  noRealRepoEdit:    'Target repo files are not modified during dry-run phases',
  noRealGitOps:      'No git add/commit/push/tag executed without explicit human YES',
  noRealDeploy:      'No deploy executed in any phase of this prototype',
  noSecretRead:      'No .env, secrets/**, or credentials/** read at any stage',
  noCustomerData:    'No PII, insurance, health, or financial data accessed',
  dryRunOnly:        'All stage outputs are packets/plans — no external side effects'
};

function buildStageOutputs(input) {
  const stageInputs = input.stageInputs || {};
  return E2E_FLOW_STAGES.map(s => ({
    stage:       s.stage,
    name:        s.name,
    status:      stageInputs[s.outputKey] ? 'provided' : 'dry_run_placeholder',
    outputSummary: stageInputs[s.outputKey] || `[dry-run] ${s.description}`,
    tool:        s.tool,
    actor:       s.actor
  }));
}

function buildStageBlockers(input) {
  const blockers = [];
  const stageInputs = input.stageInputs || {};
  if (stageInputs.secretFound)        blockers.push({ stage: 'any', blocker: 'Secret content detected — HOLD immediately' });
  if (stageInputs.customerDataFound)  blockers.push({ stage: 'any', blocker: 'Customer data leak detected — HOLD immediately' });
  if (stageInputs.forbiddenFileFound) blockers.push({ stage: 8, blocker: 'Forbidden files in Claude report — REJECT' });
  if (stageInputs.verificationFailed) blockers.push({ stage: 8, blocker: 'Verification suite failed — REVISE before commit candidate' });
  if (stageInputs.bridgeNotReady)     blockers.push({ stage: 3, blocker: 'Connection bridge not ready — human inputs required' });
  return blockers;
}

function buildCommitCandidateDecision(input, stageBlockers) {
  const hasBlocker = stageBlockers.length > 0;
  if (hasBlocker) {
    return {
      decision: 'blocked',
      reason:   stageBlockers.map(b => b.blocker).join('; '),
      readyForCommit: false,
      humanApprovalRequired: true
    };
  }
  return {
    decision: 'pending_human_yes',
    reason:   'All dry-run stages passed. Awaiting こさめ/GPT PM review, then じゅんやさん final YES.',
    readyForCommit: false,
    humanApprovalRequired: true,
    note: 'readyForCommit will become true only after explicit じゅんやさん YES'
  };
}

function buildE2EPrototype(input) {
  const prototypeId   = `e2e-prototype-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCT_TYPES.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const stageOutputs         = buildStageOutputs(input);
  const stageBlockers        = buildStageBlockers(input);
  const commitCandidateDecision = buildCommitCandidateDecision(input, stageBlockers);

  const allStagesDryRunSafe =
    isKnown &&
    stageBlockers.length === 0 &&
    stageOutputs.every(s => s.status === 'provided' || s.status === 'dry_run_placeholder');

  const productRepoOperationPrototypePassed =
    allStagesDryRunSafe &&
    commitCandidateDecision.decision !== 'blocked';

  const nextVersionCandidates = productRepoOperationPrototypePassed
    ? [
        { version: 'v31.0.0', suggestion: 'First Real Repo Edit with Human Gate — execute one approved edit in real target repo with full safety checks' },
        { version: 'v32.0.0', suggestion: 'First Commit Candidate Execution — execute git add/commit with じゅんやさん YES' }
      ]
    : [
        { version: 'v30.1.0', suggestion: 'Resolve stage blockers and re-run E2E prototype with all stages passing' }
      ];

  return {
    version:                         TOOL_META.version,
    title:                           TOOL_META.title,
    dryRun:                          true,
    humanApprovalRequired:           true,
    operationPrototypeId:            prototypeId,
    targetProduct,
    targetRepoCandidate:             repoCandidate,
    supportedProductTypes:           SUPPORTED_PRODUCT_TYPES,
    endToEndFlow:                    E2E_FLOW_STAGES.map(s => ({
      stage: s.stage, name: s.name, actor: s.actor, tool: s.tool, description: s.description
    })),
    providerRoleMap:                 PROVIDER_ROLE_MAP,
    humanApprovalContract:           HUMAN_APPROVAL_CONTRACT,
    safetyBoundary:                  SAFETY_BOUNDARY,
    secretBoundary: {
      rule: 'No .env / secrets / credentials read at any stage',
      status: 'enforced'
    },
    customerDataBoundary: {
      rule: 'No PII / insurance / health / financial data accessed at any stage',
      status: 'enforced'
    },
    allowedOperationModes:           ALLOWED_OPERATION_MODES,
    blockedOperationModes:           BLOCKED_OPERATION_MODES,
    stageOutputs,
    stageBlockers,
    commitCandidateDecision,
    nextVersionCandidates,
    productRepoOperationPrototypePassed,
    dangerousActionsDenied:          DANGEROUS_ACTIONS_DENIED,
    noRealRepoEdit:                  true,
    noRealGitCommit:                 true,
    noRealGitPush:                   true,
    noRealDeploy:                    true,
    noRealSecretRead:                true
  };
}

function main() {
  console.log(JSON.stringify(buildE2EPrototype({
    targetProduct: 'sales_dx',
    stageInputs: {
      intakeOutput:           '営業DXリード向け一括返信機能 — intake confirmed',
      taskPacketOutput:       'task packet generated — scope: src/leads/**',
      connectionBridgeOutput: 'bridge-123: kosame-sales-dx, dry_run_readonly',
      workOrderOutput:        'work order generated — allowed: src/leads/**, tests/**',
      preflightOutput:        'preflight passed — no secrets, no forbidden files',
      executionPromptOutput:  'execution prompt generated for Claude',
      dryRunDispatchOutput:   'dry-run dispatch console ready',
      handoffImportOutput:    'handoff import: 2 files, verification passed',
      resultReviewOutput:     'result review: approve, commitCandidateReady=true',
      commitCandidateOutput:  'pending じゅんやさん YES'
    }
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCT_TYPES,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  BLOCKED_OPERATION_MODES,
  ALLOWED_OPERATION_MODES,
  E2E_FLOW_STAGES,
  PROVIDER_ROLE_MAP,
  buildE2EPrototype
};
