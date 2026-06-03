'use strict';

const TOOL_META = {
  version: '33.0.0',
  title: 'Product Repo First Touch Dry Run Pack',
  slug: 'product-repo-first-touch-dry-run-pack'
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

const COMMANDS_FORBIDDEN = [
  'git add',
  'git commit',
  'git push',
  'git tag',
  'git reset --hard',
  'git clean -f',
  'rm -rf',
  'npm run deploy',
  'gcloud deploy',
  'docker build',
  'cat .env',
  'cat secrets/**',
  'cat credentials/**'
];

function buildSafeReadOnlyPlan(targetProduct, repoCandidate) {
  return [
    { cmd: `ls -la /path/to/${repoCandidate}/`,         purpose: 'top-level directory structure確認' },
    { cmd: `cat /path/to/${repoCandidate}/package.json`, purpose: 'scripts / dependencies確認' },
    { cmd: `cat /path/to/${repoCandidate}/README.md`,    purpose: 'README内容確認' },
    { cmd: `git -C /path/to/${repoCandidate} log --oneline -5`, purpose: '最新5コミット確認 (read-only)' },
    { cmd: `git -C /path/to/${repoCandidate} status`,    purpose: 'working tree状態確認 (read-only)' },
    { cmd: `find /path/to/${repoCandidate}/docs -name "*.md" 2>/dev/null | head -10`, purpose: 'docs構造確認' },
    { cmd: `node --version`,                             purpose: 'ランタイムバージョン確認' }
  ];
}

function buildAllowedFirstTouchAreas(targetProduct) {
  const base = ['docs/**', 'README.md', 'smoke/**', 'runbook/**', 'package.json (read-only)'];
  if (targetProduct === 'cloud_run_pm_agent') {
    base.push('tools/** (read-only)');
  }
  return base;
}

const FORBIDDEN_FIRST_TOUCH_AREAS = [
  '.env',
  '.env.*',
  'secrets/**',
  'credentials/**',
  'config/secrets/**',
  'src/auth/**',
  'src/payment/**',
  'insurance/**',
  'health/**',
  'production.config.*',
  '.ssh/**',
  'private/**'
];

function buildExpectedObservations(targetProduct, repoCandidate) {
  return [
    `${repoCandidate} repo structure が確認できる`,
    'package.json の scripts セクションが読める',
    'README.md があれば内容が確認できる',
    'git log で最近のコミット履歴が読める',
    'docs/ ディレクトリ構造が分かる',
    'No .env or secrets files are accessed',
    '本番影響なし、Secret読取なし の状態でfirst touch完了'
  ];
}

function buildFirstTouchDryRunPack(input) {
  const dryRunId      = `first-touch-dry-run-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const firstTouchPurpose = input.firstTouchPurpose ||
    `${repoCandidate} への初回接触前確認。実ファイル編集・commit・push なし。` +
    'repo構造・README・docs を read-only で確認し、初回作業スコープを確定する。';

  const safeReadOnlyPlan       = buildSafeReadOnlyPlan(targetProduct, repoCandidate);
  const allowedFirstTouchAreas = input.allowedFirstTouchAreas || buildAllowedFirstTouchAreas(targetProduct);
  const expectedObservations   = buildExpectedObservations(targetProduct, repoCandidate);

  const backupBeforeTouchRequired = input.backupBeforeTouchRequired !== undefined
    ? input.backupBeforeTouchRequired
    : false;

  const notReadyReasons = [];
  if (!isKnown) notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (input.missingSelectionDecision) notReadyReasons.push('v32 Product Selection decision not completed');

  const dryRunReady = isKnown && notReadyReasons.length === 0;

  const recommendedNextAction = dryRunReady
    ? `First touch dry-run ready for ${repoCandidate}. ` +
      'Human performs safe read-only inspection. No edits until v34 Controlled Task Launch.'
    : `Dry-run not ready. Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    firstTouchDryRunId:       dryRunId,
    targetProduct,
    targetRepoCandidate:      repoCandidate,
    firstTouchPurpose,
    safeReadOnlyPlan,
    allowedFirstTouchAreas,
    forbiddenFirstTouchAreas: FORBIDDEN_FIRST_TOUCH_AREAS,
    commandsToPreview:        safeReadOnlyPlan.map(s => s.cmd),
    commandsForbidden:        COMMANDS_FORBIDDEN,
    expectedObservations,
    backupBeforeTouchRequired,
    notReadyReasons,
    dryRunReady,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealFileEdit:           true,
    noRealGitCommit:          true,
    noRealGitPush:            true,
    noRealDeploy:             true,
    noSecretRead:             true
  };
}

function main() {
  console.log(JSON.stringify(buildFirstTouchDryRunPack({
    targetProduct:   'email_reply_bot',
    firstTouchPurpose: 'Email Reply BOT repoへの初回接触前確認。docs/smoke/README を read-only 確認し、初回docs整備タスクのスコープを確定する。'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  COMMANDS_FORBIDDEN,
  FORBIDDEN_FIRST_TOUCH_AREAS,
  buildFirstTouchDryRunPack
};
