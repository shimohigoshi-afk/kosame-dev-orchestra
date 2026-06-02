'use strict';

const TOOL_META = {
  version: '25.5.0',
  title: 'External Repo Preflight Command Pack',
  slug: 'external-repo-preflight-command-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const REPO_CANDIDATES = {
  sales_dx:          'kosame-sales-dx',
  anesty_board:      'kosame-anesty-board',
  backoffice_agent:  'kosame-backoffice-agent',
  email_reply_bot:   'kosame-email-reply-bot',
  cloud_run_pm_agent: 'kosame-dev-orchestra'
};

const SHELL_TYPES = ['bash', 'powershell', 'cloud_shell'];

const FORBIDDEN_COMMANDS = [
  'rm -rf <anything>',
  'git reset --hard (without explicit YES)',
  'git clean -f (without explicit YES)',
  'git push (without explicit YES)',
  'git tag (without explicit YES)',
  'git add (without explicit YES)',
  'git commit (without explicit YES)',
  'deploy / gcloud deploy / docker build / docker push',
  'cat .env / cat .env.* / cat secrets/**',
  'echo $SECRET / printenv <SECRET_KEY>',
  'gcloud secrets versions access (without explicit YES)',
  'Any command that modifies production systems'
];

const BACKUP_RECOMMENDATION = {
  step1: 'Cloud Shell / PowerShell: save current terminal session log',
  step2: 'git stash (if any local changes) before starting',
  step3: 'Note current git log --oneline -3 output as baseline',
  step4: 'Keep rollback note ready: git checkout -- <file> for each changed file',
  note:  'No automated backup. Human confirmation required before any destructive action.'
};

function buildSafeReadCommands(productType, repoPath, shellType) {
  const base = shellType === 'powershell'
    ? [
        `Get-ChildItem ${repoPath}`,
        `Set-Location ${repoPath}; git status --short`,
        `Set-Location ${repoPath}; git log --oneline -5`,
        `Set-Location ${repoPath}; git branch`,
        `Set-Location ${repoPath}; git diff --stat HEAD`,
        `node --version`,
        `npm --version`,
        `Set-Location ${repoPath}; cat README.md`
      ]
    : [
        `ls -la ${repoPath}`,
        `cd ${repoPath} && git status --short`,
        `cd ${repoPath} && git log --oneline -5`,
        `cd ${repoPath} && git branch`,
        `cd ${repoPath} && git diff --stat HEAD`,
        `node --version`,
        `npm --version`,
        `cd ${repoPath} && cat README.md`
      ];
  return base;
}

function buildRepoCleanCheck(repoPath, shellType) {
  const cmds = shellType === 'powershell'
    ? [`Set-Location ${repoPath}; git status --short`, `Set-Location ${repoPath}; git stash list`]
    : [`cd ${repoPath} && git status --short`, `cd ${repoPath} && git stash list`];
  return {
    commands: cmds,
    expectedResult: 'Nothing unexpected in git status. Stash list should be empty or known.',
    note: 'dry-run only — confirm before executing'
  };
}

function buildBranchCheck(repoPath, shellType) {
  const cmds = shellType === 'powershell'
    ? [`Set-Location ${repoPath}; git branch`, `Set-Location ${repoPath}; git log --oneline -3`]
    : [`cd ${repoPath} && git branch`, `cd ${repoPath} && git log --oneline -3`];
  return {
    commands: cmds,
    expectedResult: 'Confirm you are on the correct work branch (not main directly).',
    note: 'dry-run only — confirm before executing'
  };
}

function buildPackageVersionCheck(repoPath, shellType) {
  const cmd = shellType === 'powershell'
    ? `Set-Location ${repoPath}; node -e "console.log(require('./package.json').version)"`
    : `cd ${repoPath} && node -e "console.log(require('./package.json').version)"`;
  return {
    commands: [cmd],
    note: 'Verify package.json version matches expected before starting work'
  };
}

function buildDependencyCheck(repoPath, shellType) {
  const cmd = shellType === 'powershell'
    ? `Set-Location ${repoPath}; npm ls --depth=0 2>&1 | head -20`
    : `cd ${repoPath} && npm ls --depth=0 2>&1 | head -20`;
  return {
    commands: [cmd, `${shellType === 'powershell' ? 'Set-Location ' + repoPath + '; ' : 'cd ' + repoPath + ' && '}node --version`, `npm --version`],
    note: 'dry-run only — check dependency state before editing'
  };
}

function buildVerifyCommandCandidate(productType, repoPath, shellType) {
  const prefix = shellType === 'powershell' ? `Set-Location ${repoPath};` : `cd ${repoPath} &&`;
  return {
    commands: [
      `${prefix} npm run verify`,
      `${prefix} npm test`,
      `${prefix} node --check src/**/*.js`
    ],
    note: 'Run after editing. dry-run candidate — confirm before executing'
  };
}

function buildGitSafetyCheck(repoPath, shellType) {
  const prefix = shellType === 'powershell' ? `Set-Location ${repoPath};` : `cd ${repoPath} &&`;
  return {
    commands: [
      `${prefix} git status --short`,
      `${prefix} git diff --stat HEAD`,
      `${prefix} git log --oneline -3`
    ],
    safeOps:     ['git status', 'git log', 'git diff (read-only)', 'git branch', 'git stash list'],
    unsafeOps:   ['git add', 'git commit', 'git push', 'git tag', 'git reset --hard', 'git clean -f'],
    note:        'git write operations require explicit じゅんやさん YES'
  };
}

function buildSecretSafetyCheck(productType) {
  const checks = {
    sales_dx:          ['Confirm .env is NOT in git staging', 'Confirm no API keys in edited files', 'Confirm no OAuth tokens in code'],
    anesty_board:      ['Confirm .env / insurance data / health records are NOT staged', 'No patient/policyholder PII in code'],
    backoffice_agent:  ['Confirm .env / financial data are NOT staged', 'No employee PII in code'],
    email_reply_bot:   ['Confirm .env / SMTP credentials are NOT staged', 'No real email addresses in code'],
    cloud_run_pm_agent: ['Confirm .env / GCP service account keys are NOT staged', 'No Secret Manager values in code']
  };
  return {
    checkItems: checks[productType] || ['Confirm no secrets in staged files', 'Confirm no API keys in code'],
    note: 'Manual check required. No automated secret scanning.'
  };
}

function buildPreflightPack(input) {
  const packId        = `preflight-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const shellType     = String(input.shellType || 'bash').toLowerCase();
  const workOrder     = input.workOrder || {};

  const isKnownProduct    = SUPPORTED_PRODUCTS.includes(targetProduct);
  const isKnownShell      = SHELL_TYPES.includes(shellType);
  const targetRepoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;
  const repoPath          = input.repoPath || `/home/shimohigoshi/${targetRepoCandidate}`;

  const safeReadCommands    = buildSafeReadCommands(targetProduct, repoPath, shellType);
  const repoCleanCheck      = buildRepoCleanCheck(repoPath, shellType);
  const branchCheck         = buildBranchCheck(repoPath, shellType);
  const packageVersionCheck = buildPackageVersionCheck(repoPath, shellType);
  const dependencyCheck     = buildDependencyCheck(repoPath, shellType);
  const verifyCommandCandidate = buildVerifyCommandCandidate(targetProduct, repoPath, shellType);
  const gitSafetyCheck      = buildGitSafetyCheck(repoPath, shellType);
  const secretSafetyCheck   = buildSecretSafetyCheck(targetProduct);

  const notReadyReasons = [];
  if (!isKnownProduct) notReadyReasons.push(`Unknown product: ${targetProduct}`);
  if (!isKnownShell)   notReadyReasons.push(`Unknown shell: ${shellType}. Supported: ${SHELL_TYPES.join(', ')}`);

  const preflightReady = notReadyReasons.length === 0;

  const recommendedNextAction = preflightReady
    ? 'Preflight pack ready. Human reviews commands, executes in Cloud Shell / PowerShell, then proceeds to execution prompt.'
    : `Preflight not ready. Resolve: ${notReadyReasons.join('; ')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    preflightPackId:     packId,
    targetProduct,
    targetRepoCandidate,
    repoPath,
    shellType,
    safeReadCommands,
    forbiddenCommands:   FORBIDDEN_COMMANDS,
    repoCleanCheck,
    branchCheck,
    packageVersionCheck,
    dependencyCheck,
    verifyCommandCandidate,
    gitSafetyCheck,
    secretSafetyCheck,
    backupRecommendation: BACKUP_RECOMMENDATION,
    isKnownProduct,
    isKnownShell,
    preflightReady,
    notReadyReasons,
    recommendedNextAction,
    noRealCommandExecution: true,
    noRealRepoAccess:       true,
    note: 'このpacketは実コマンドを実行しない。コマンド候補のみ出力する。実行はじゅんやさんYES後に人間が行う。'
  };
}

function main() {
  console.log(JSON.stringify(buildPreflightPack({
    targetProduct: 'sales_dx',
    shellType:     'bash'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  SHELL_TYPES,
  FORBIDDEN_COMMANDS,
  BACKUP_RECOMMENDATION,
  buildPreflightPack
};
