'use strict';

const TOOL_META = {
  version: '34.0.0',
  title: 'Product Repo First Controlled Task Launch Pack',
  slug: 'product-repo-first-controlled-task-launch-pack'
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

const FORBIDDEN_COMMANDS = [
  'git add (without explicit human YES)',
  'git commit (without explicit human YES)',
  'git push',
  'git tag',
  'git reset --hard',
  'git clean -f',
  'rm -rf',
  'gcloud deploy',
  'docker build',
  'npm run deploy',
  'cat .env',
  'cat secrets/**',
  'cat credentials/**'
];

const ALLOWED_COMMANDS = [
  'node --check <file>',
  'npm run verify',
  'git status (read-only)',
  'git log --oneline (read-only)',
  'ls (read-only)',
  'cat <allowed_file> (read-only)',
  'find docs/ -name "*.md" (read-only)'
];

const COMMIT_STOP_RULE = [
  'Do NOT run git add / git commit / git push / git tag',
  'Stop at file edit + node --check + npm run verify',
  'Generate handoff report listing: changed files, verification result, git status output',
  'Wait for human review via v29 Result Review Console before any git operation',
  'Any commit / push / tag requires explicit じゅんやさん YES'
];

const PRE_LAUNCH_CHECKLIST = [
  { item: 'v32 Product Repo Selection decided', required: true },
  { item: 'v33 First Touch Dry Run completed', required: true },
  { item: 'v27 Connection Bridge ready', required: true },
  { item: 'v25 Work Order confirmed', required: true },
  { item: 'Task scope and allowed file zones confirmed by human', required: true },
  { item: 'No secrets / customer data in task scope', required: true },
  { item: 'Human issued YES for this launch', required: true }
];

const POST_LAUNCH_REPORT_FORMAT = {
  requiredFields: [
    'launchTaskTitle',
    'targetProduct',
    'targetRepoCandidate',
    'changedFiles',
    'nodeCheckResult',
    'verificationResult',
    'gitStatusOutput',
    'sensitiveContentFound (must be false)',
    'dangerousOpsPerformed (must be empty)',
    'readyForResultReview'
  ],
  forbiddenFields: [
    'secretValues',
    'envValues',
    'customerPII',
    'insuranceData',
    'commitHash (not yet committed)',
    'pushConfirmation'
  ]
};

function buildClaudePrompt(input) {
  const product    = input.targetProduct || 'email_reply_bot';
  const repo       = REPO_CANDIDATES[product] || `kosame-${product}`;
  const taskTitle  = input.launchTaskTitle || 'docs整備: README.md の目次と概要セクションを追加する';
  const taskGoal   = input.launchTaskGoal  || 'README.md に目次と概要セクションを追加し、開発者が理解しやすくする';
  const allowedFiles = (input.allowedFiles || ['docs/**', 'README.md']).join(', ');
  const forbiddenFiles = (input.forbiddenFiles || ['.env*', 'secrets/**', 'src/auth/**']).join(', ');

  return `# KOSAME Dev Orchestra — Controlled Task Launch

## Target Repo
${repo} (${product})

## Task Title
${taskTitle}

## Task Goal
${taskGoal}

## Allowed File Zones
${allowedFiles}

## Forbidden File Zones (DO NOT TOUCH)
${forbiddenFiles}
.env / secrets/** / credentials/** / production.config.* / .ssh/**

## Allowed Commands
- node --check <file>
- npm run verify
- git status (read-only)
- git log --oneline -5 (read-only)
- ls / find / cat (read-only, within allowed zones only)

## FORBIDDEN Commands (DO NOT EXECUTE)
- git add
- git commit
- git push
- git tag
- git reset --hard / git clean -f
- rm -rf
- gcloud deploy / docker build / npm run deploy
- cat .env / cat secrets/** / cat credentials/**

## Safety Rules
1. Do NOT commit, push, or tag any changes.
2. Do NOT read .env, secrets, credentials, or any customer PII.
3. Do NOT access insurance / health / financial records.
4. Do NOT perform any deploy operation.
5. Stop after: file edits + node --check + npm run verify.
6. Generate a handoff report listing: changedFiles, nodeCheckResult, verificationResult, gitStatusOutput.
7. Flag any out-of-scope findings immediately without acting on them.

## Handoff Report Format (Required at the end)
- launchTaskTitle: ${taskTitle}
- targetProduct: ${product}
- changedFiles: [list all modified/created files]
- nodeCheckResult: [pass/fail per file]
- verificationResult: [npm run verify output summary]
- gitStatusOutput: [git status --short output]
- sensitiveContentFound: false (if true, STOP and report)
- dangerousOpsPerformed: [] (must be empty — if not empty, report immediately)
- readyForResultReview: true/false
`;
}

function buildControlledLaunchPack(input) {
  const launchId      = `controlled-launch-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'email_reply_bot').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const launchTaskTitle = input.launchTaskTitle || 'docs整備: README.md の目次と概要セクションを追加する';
  const launchTaskGoal  = input.launchTaskGoal  || 'README.md に目次と概要セクションを追加し、開発者が理解しやすくする';

  const allowedFiles   = input.allowedFiles   || ['docs/**', 'README.md'];
  const forbiddenFiles = input.forbiddenFiles || ['.env*', 'secrets/**', 'credentials/**', 'src/auth/**'];

  const claudePromptToLaunch = buildClaudePrompt({
    ...input,
    targetProduct,
    launchTaskTitle,
    launchTaskGoal,
    allowedFiles,
    forbiddenFiles
  });

  const missingPreLaunch = PRE_LAUNCH_CHECKLIST.filter(c => c.required && !input.preLaunchConfirmed);
  const blockedReasons  = [];
  if (!isKnown)                  blockedReasons.push(`Unknown product: ${targetProduct}`);
  if (!input.preLaunchConfirmed) blockedReasons.push('Pre-launch checklist not confirmed by human');

  const launchReady = isKnown && !!input.preLaunchConfirmed;

  const rollbackInstruction =
    `git checkout -- <file> for each changed file in ${repoCandidate}. ` +
    'git reset --hard requires explicit じゅんやさん YES.';

  const recommendedNextAction = launchReady
    ? `Launch packet ready. Copy claudePromptToLaunch into Claude Code for ${repoCandidate}. ` +
      'Review implementation plan before any file edits. Collect handoff report for v29 Result Review.'
    : `Launch blocked. Resolve: ${blockedReasons.join('; ')}`;

  return {
    version:                  TOOL_META.version,
    title:                    TOOL_META.title,
    dryRun:                   true,
    humanApprovalRequired:    true,
    controlledLaunchId:       launchId,
    targetProduct,
    targetRepoCandidate:      repoCandidate,
    launchTaskTitle,
    launchTaskGoal,
    allowedFiles,
    forbiddenFiles,
    allowedCommands:          ALLOWED_COMMANDS,
    forbiddenCommands:        FORBIDDEN_COMMANDS,
    claudePromptToLaunch,
    preLaunchChecklist:       PRE_LAUNCH_CHECKLIST,
    postLaunchReportFormat:   POST_LAUNCH_REPORT_FORMAT,
    rollbackInstruction,
    commitStopRule:           COMMIT_STOP_RULE,
    blockedReasons,
    launchReady,
    dangerousActionsDenied:   DANGEROUS_ACTIONS_DENIED,
    recommendedNextAction,
    noRealCommit:             true,
    noRealPush:               true,
    noRealTag:                true,
    noRealDeploy:             true,
    noSecretRead:             true
  };
}

function main() {
  console.log(JSON.stringify(buildControlledLaunchPack({
    targetProduct:      'email_reply_bot',
    launchTaskTitle:    'docs整備: README.md に目次と概要セクションを追加する',
    launchTaskGoal:     'Email Reply BOT の README.md を整備して開発者が理解しやすくする',
    allowedFiles:       ['docs/**', 'README.md', 'smoke/**'],
    forbiddenFiles:     ['.env*', 'secrets/**', 'credentials/**', 'src/auth/**'],
    preLaunchConfirmed: true
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  FORBIDDEN_COMMANDS,
  ALLOWED_COMMANDS,
  COMMIT_STOP_RULE,
  PRE_LAUNCH_CHECKLIST,
  POST_LAUNCH_REPORT_FORMAT,
  buildControlledLaunchPack
};
