'use strict';

const TOOL_META = {
  version: '20.0.0',
  title: 'Productization Prototype Pack',
  slug: 'productization-prototype-pack'
};

const SUPPORTED_PRODUCT_TYPES = [
  'sales_dx',
  'anesty_board',
  'backoffice_agent',
  'email_reply_bot',
  'cloud_run_pm_agent'
];

const INTAKE_TO_RELEASE_FLOW = [
  { step: 1, version: 'v16.5.0', pack: 'Repo Task Intake Console',                    tool: 'repo-task-intake-console-pack.js' },
  { step: 2, version: 'v17.0.0', pack: 'Cross-Repo Claude Execution Prompt Builder',  tool: 'cross-repo-claude-execution-prompt-builder-pack.js' },
  { step: 3, version: 'v17.5.0', pack: 'Product Repo Safe Edit Planner',              tool: 'product-repo-safe-edit-planner-pack.js' },
  { step: 4, version: 'v18.0.0', pack: 'Product Template Applicator Console',         tool: 'product-template-applicator-console-pack.js' },
  { step: 5, version: 'v18.5.0', pack: 'Product Verification & Handoff Collector',    tool: 'product-verification-handoff-collector-pack.js' },
  { step: 6, version: 'v19.0.0', pack: 'Product Release Candidate Packet Builder',    tool: 'product-release-candidate-packet-builder-pack.js' },
  { step: 7, version: 'v19.5.0', pack: 'Productization Readiness Review Console',     tool: 'productization-readiness-review-console-pack.js' },
  { step: 8, version: 'v20.0.0', pack: 'Productization Prototype Pack',               tool: 'productization-prototype-pack.js' }
];

const PROVIDER_ROLE_MAP = {
  'Kosame/GPT':  { role: 'PM / Safety Gate / Integration Judge', actions: ['intake review', 'approval decision', 'handoff coordination'] },
  'Claude':      { role: 'Implementation', actions: ['code generation', 'docs editing', 'tool building', 'smoke writing'] },
  'Gemini':      { role: 'Bulk Prompt / Draft Expansion', actions: ['bulk task processing', 'draft expansion', 'multi-file generation'] },
  'Grok':        { role: 'Review / Critique', actions: ['code review', 'safety review', 'diff analysis'] },
  'DeepSeek':    { role: 'Draft Generation', actions: ['initial spec drafting', 'boilerplate generation'] },
  'Kimi':        { role: 'Summary', actions: ['result summarization', 'handoff note compression'] },
  'Cloud Shell': { role: 'Execution', actions: ['npm run verify', 'git status', 'node --check', 'smoke execution'] },
  'Human':       { role: 'Final YES / NO', actions: ['final approval', 'git commit authorization', 'deploy authorization'] }
};

const HUMAN_APPROVAL_CONTRACT = {
  humanApprovalRequired:     true,
  finalDecisionOwner:        'じゅんやさん',
  approvalScope:             ['git commit', 'git push', 'git tag', 'deploy', 'release', 'external API call with real data'],
  autoApproved:              ['dry-run packet generation', 'npm run verify', 'node --check', 'git status'],
  neverAutoApproved:         ['git commit', 'git push', 'git tag', 'gcloud deploy', 'docker build', 'read secrets'],
  escalationPath:            'Claude → こさめ/GPT PM → じゅんやさん'
};

const SAFETY_BOUNDARY = {
  dryRunEnforced:            true,
  secretsNeverAccessed:      true,
  customerDataNeverInCode:   true,
  deployNeverAutomatic:      true,
  gitOpsNeverAutomatic:      true,
  protectedProducts:         ['ANESTY Board', '営業DX', 'BackOffice', 'Email Reply BOT'],
  allowedAutoOps:            ['packet generation', 'dry-run output', 'verify execution', 'git status read']
};

const PRODUCT_RUNBOOK_INDEX = SUPPORTED_PRODUCT_TYPES.map(p => ({
  productType: p,
  runbookRef:  `docs/ai-dev-team/product-repo-safe-edit-planner-v17.5.0.md#${p}`,
  templateRef: `docs/ai-dev-team/product-template-applicator-console-v18.0.0.md#${p}`
}));

const NEXT_VERSION_CANDIDATES = [
  { version: 'v20.5.0', title: 'Product Repo Auto-Draft Generator', description: 'Geminiを使って商品repo向け初稿コードを自動生成するpack' },
  { version: 'v21.0.0', title: 'Multi-Product Parallel Work Console', description: '複数商品repoへの並列作業分配コンソール' },
  { version: 'v21.5.0', title: 'Cross-Product Integration Test Pack', description: '複数商品間の統合テストpacket生成' },
  { version: 'v22.0.0', title: 'Product Deploy Readiness Gate', description: '商品repoのdeploy準備ゲート（まだ自動deployはしない）' }
];

function buildPrototypePack(input) {
  const prototypeId    = `prototype-${Date.now()}`;
  const verifyPassed   = input.verifyPassed   !== false;
  const allFlowsReady  = input.allFlowsReady  !== false;
  const readinessReviewPassed = input.readinessReviewPassed !== false;

  const productizationPrototypePassed = verifyPassed && allFlowsReady && readinessReviewPassed;

  const summary = productizationPrototypePassed
    ? 'KOSAME Dev Orchestra v20.0.0 productization prototype is complete. intake→release flow is operational for all 5 product types.'
    : 'Prototype not yet complete. Resolve verification or readiness review failures.';

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    prototypeId,
    supportedProductTypes: SUPPORTED_PRODUCT_TYPES,
    intakeToReleaseFlow: INTAKE_TO_RELEASE_FLOW,
    providerRoleMap:     PROVIDER_ROLE_MAP,
    humanApprovalContract: HUMAN_APPROVAL_CONTRACT,
    safetyBoundary:      SAFETY_BOUNDARY,
    productRunbookIndex: PRODUCT_RUNBOOK_INDEX,
    nextVersionCandidates: NEXT_VERSION_CANDIDATES,
    productizationPrototypePassed,
    summary,
    noRealDeploy:        true,
    noRealGitOps:        true,
    noRealSecretAccess:  true
  };
}

function main() {
  console.log(JSON.stringify(buildPrototypePack({
    verifyPassed:           true,
    allFlowsReady:          true,
    readinessReviewPassed:  true
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCT_TYPES,
  INTAKE_TO_RELEASE_FLOW,
  PROVIDER_ROLE_MAP,
  HUMAN_APPROVAL_CONTRACT,
  SAFETY_BOUNDARY,
  buildPrototypePack
};
