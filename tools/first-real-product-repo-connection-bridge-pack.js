'use strict';

const TOOL_META = {
  version: '27.0.0',
  title: 'First Real Product Repo Connection Bridge',
  slug: 'first-real-product-repo-connection-bridge'
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

const REPO_PATH_CANDIDATES = {
  sales_dx:           '/home/shimohigoshi/kosame-sales-dx',
  anesty_board:       '/home/shimohigoshi/kosame-anesty-board',
  backoffice_agent:   '/home/shimohigoshi/kosame-backoffice-agent',
  email_reply_bot:    '/home/shimohigoshi/kosame-email-reply-bot',
  cloud_run_pm_agent: '/home/shimohigoshi/kosame-dev-orchestra'
};

const REPO_KINDS = {
  sales_dx:           'nodejs_webapp',
  anesty_board:       'nodejs_nextjs',
  backoffice_agent:   'nodejs_api',
  email_reply_bot:    'nodejs_cloud_function',
  cloud_run_pm_agent: 'nodejs_orchestrator'
};

const BRANCH_POLICIES = {
  sales_dx:           { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)', 'release/*'] },
  anesty_board:       { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)'] },
  backoffice_agent:   { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)', 'prod'] },
  email_reply_bot:    { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)'] },
  cloud_run_pm_agent: { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)'] }
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

const BLOCKED_CONNECTION_MODES = [
  'direct_deploy',
  'auto_push',
  'auto_tag',
  'secret_inspection',
  'customer_data_scan',
  'destructive_cleanup'
];

const SAFE_READONLY_CHECKS = [
  'read CLAUDE.md if present',
  'list top-level directory structure (ls)',
  'read package.json scripts',
  'read README if present',
  'check node version',
  'check git log (read-only)'
];

const FORBIDDEN_CHECKS = [
  'read .env or .env.* files',
  'read secrets/** directory',
  'read credentials/**',
  'access customer PII tables',
  'access insurance or health records',
  'execute deploy commands',
  'execute gcloud commands',
  'execute docker commands',
  'execute git push / git tag'
];

function buildConnectionBridge(input) {
  const bridgeId      = `bridge-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);

  const targetRepoCandidate = REPO_CANDIDATES[targetProduct]   || `kosame-${targetProduct}`;
  const repoPathCandidate   = REPO_PATH_CANDIDATES[targetProduct] || `/home/shimohigoshi/${targetRepoCandidate}`;
  const repoKind            = REPO_KINDS[targetProduct]        || 'unknown';
  const branchPolicy        = BRANCH_POLICIES[targetProduct]   || { defaultBranch: 'main', workBranch: 'feature/*', forbidden: ['main (direct push)'] };

  const connectionAssumptions = input.connectionAssumptions || [
    `Target repo ${targetRepoCandidate} exists at ${repoPathCandidate} (not verified in dry-run)`,
    'Repo is git-initialized and has at least one commit',
    'Node.js runtime is available on the host',
    'No secrets are stored in the working tree root',
    'Branch policy follows standard KOSAME convention'
  ];

  const providedHumanInputs = input.providedHumanInputs || [];
  const REQUIRED_HUMAN_INPUTS = [
    'repoExistsConfirmed',
    'branchNameForWork',
    'taskScopeConfirmed',
    'allowedFileZonesConfirmed'
  ];
  const missingHumanInputs = REQUIRED_HUMAN_INPUTS.filter(k => !providedHumanInputs.includes(k));

  const secretBoundary = {
    rule: 'No .env, secrets/**, or credential files may be read by Claude during this connection',
    enforcement: 'dry-run only — Claude must not access these paths',
    status: 'enforced'
  };

  const customerDataBoundary = {
    rule: 'No customer PII, insurance, health, or financial records may be accessed',
    enforcement: 'dry-run only',
    status: 'enforced'
  };

  const regulatedDataBoundary = {
    rule: 'No HIPAA / personal data / insurance policy data may be read or modified',
    enforcement: 'dry-run only',
    applicableProducts: ['anesty_board', 'backoffice_agent'],
    status: 'enforced'
  };

  const notReadyReasons = [];
  if (!isKnown)                       notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (missingHumanInputs.length > 0)  notReadyReasons.push(`Missing human inputs: ${missingHumanInputs.join(', ')}`);

  const connectionBridgeReady = isKnown && missingHumanInputs.length === 0;

  const recommendedNextAction = connectionBridgeReady
    ? 'Connection bridge ready. Proceed to v28 Dry Run Dispatch Console with this bridge as input.'
    : `Bridge not ready. Resolve: ${notReadyReasons.join('; ')}. Obtain human inputs: ${missingHumanInputs.join(', ')}.`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    connectionBridgeId:       bridgeId,
    targetProduct,
    targetRepoCandidate,
    repoPathCandidate,
    repoKind,
    branchPolicy,
    connectionAssumptions,
    safeReadOnlyChecks:       SAFE_READONLY_CHECKS,
    forbiddenChecks:          FORBIDDEN_CHECKS,
    requiredHumanInputs:      REQUIRED_HUMAN_INPUTS,
    missingHumanInputs,
    secretBoundary,
    customerDataBoundary,
    regulatedDataBoundary,
    allowedConnectionMode:    'dry_run_readonly_bridge_only',
    blockedConnectionModes:   BLOCKED_CONNECTION_MODES,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    connectionBridgeReady,
    notReadyReasons,
    recommendedNextAction,
    noRealRepoAccess:         true,
    noRealSecretRead:         true,
    noRealCommit:             true,
    noRealPush:               true,
    noRealDeploy:             true
  };
}

function main() {
  console.log(JSON.stringify(buildConnectionBridge({
    targetProduct:      'sales_dx',
    providedHumanInputs: ['repoExistsConfirmed', 'branchNameForWork', 'taskScopeConfirmed', 'allowedFileZonesConfirmed'],
    connectionAssumptions: [
      'kosame-sales-dx repo exists at /home/shimohigoshi/kosame-sales-dx',
      'Working on feature/lead-bulk-email branch',
      'Scope limited to src/leads/** and tests/**'
    ]
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  REPO_PATH_CANDIDATES,
  REPO_KINDS,
  BRANCH_POLICIES,
  DANGEROUS_ACTIONS_DENIED,
  BLOCKED_CONNECTION_MODES,
  SAFE_READONLY_CHECKS,
  FORBIDDEN_CHECKS,
  buildConnectionBridge
};
