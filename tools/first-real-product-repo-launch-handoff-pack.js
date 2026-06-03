'use strict';

const TOOL_META = {
  version: '37.0.0',
  title: 'First Real Product Repo Launch Handoff',
  slug: 'first-real-product-repo-launch-handoff'
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

const STOP_CONDITIONS = [
  'Sensitive content (Secret / .env / API key / 顧客情報 / 保険証券) found in any file → STOP immediately',
  'Forbidden file zone touched → STOP immediately',
  'Dangerous operation attempted (git push / deploy / rm -rf) → STOP immediately',
  'Verification suite (npm run verify) fails → STOP and report, do not commit',
  'node --check fails on any changed file → STOP and report'
];

const COMMIT_CANDIDATE_STOP_RULE = [
  'Do NOT run git add / git commit / git push / git tag',
  'Stop at: file edit + node --check + npm run verify',
  'Generate handoff report: changedFiles / nodeCheckResult / verificationResult / gitStatusOutput',
  'Wait for human review via v38 Result Acceptance Gate',
  'git add / commit / push / tag require explicit じゅんやさん YES after こさめ/GPT PM review'
];

function buildImplementationPrompt(input) {
  const product      = input.targetProduct || 'email_reply_bot';
  const repo         = REPO_CANDIDATES[product] || `kosame-${product}`;
  const objective    = input.launchObjective || 'docs整備: README.md に目次・概要セクションを追加する';
  const allowed      = (input.allowedFiles || ['docs/**', 'README.md', 'smoke/**']).join('\n- ');
  const forbidden    = (input.forbiddenFiles || ['.env*', 'secrets/**', 'credentials/**', 'src/auth/**']).join('\n- ');

  return `# KOSAME Dev Orchestra — Final Launch Handoff Prompt

## Target Repo
${repo} (${product})

## Objective
${objective}

## Your Role (Claude)
- Implement the objective within allowed file zones only
- Run node --check on all changed files
- Run npm run verify (or equivalent) after edits
- Generate a structured handoff report — do NOT commit or push

## Allowed Files
- ${allowed}

## Forbidden Files (DO NOT READ OR MODIFY)
- ${forbidden}
- .env / .env.* / secrets/** / credentials/** / production.config.*
- src/auth/** / src/payment/** / insurance/** / health/**
- .ssh/** / private/**

## Allowed Commands
- node --check <file>
- npm run verify
- git status (read-only)
- git log --oneline -5 (read-only)
- ls / find / cat within allowed zones only

## ABSOLUTELY FORBIDDEN Commands
- git add
- git commit
- git push
- git tag
- git reset --hard
- git clean -f
- rm -rf
- gcloud deploy
- docker build
- npm run deploy
- cat .env / cat secrets/** / cat credentials/**

## Safety Rules
1. Do NOT commit, push, or tag any changes.
2. Do NOT read .env, secrets/**, credentials/**, or any API key files.
3. Do NOT access insurance, health, or financial records.
4. Do NOT access customer PII.
5. Do NOT perform any deploy operation.
6. Stop immediately if you encounter sensitive content and report it.
7. Stop after: file edits + node --check + npm run verify.

## Handoff Report (Required at completion)
Provide a JSON report with:
- objective: (task title)
- targetProduct: ${product}
- changedFiles: [list all modified/created files]
- nodeCheckResult: { passed: true/false, details: "..." }
- verificationResult: { passed: true/false, summary: "..." }
- gitStatusOutput: (git status --short output)
- sensitiveContentFound: false  ← must be false
- dangerousOpsPerformed: []     ← must be empty
- readyForResultReview: true/false
- notes: (any observations within scope)
`;
}

function buildLaunchHandoff(input) {
  const handoffId     = `launch-handoff-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'email_reply_bot').toLowerCase();
  const isKnown       = SUPPORTED_PRODUCTS.includes(targetProduct);
  const repoCandidate = REPO_CANDIDATES[targetProduct] || `kosame-${targetProduct}`;

  const launchObjective = input.launchObjective || 'docs整備: README.md に目次・概要セクションを追加する';
  const allowedFiles    = input.allowedFiles    || ['docs/**', 'README.md', 'smoke/**'];
  const forbiddenFiles  = input.forbiddenFiles  || ['.env*', 'secrets/**', 'credentials/**', 'src/auth/**'];

  const implementationPrompt = buildImplementationPrompt({ ...input, targetProduct, launchObjective, allowedFiles, forbiddenFiles });

  const preflightCommands = [
    `git -C /path/to/${repoCandidate} status`,
    `git -C /path/to/${repoCandidate} log --oneline -3`,
    `node --version`,
    `cat /path/to/${repoCandidate}/package.json`
  ];

  const verificationCommands = [
    `node --check <changed_file>`,
    `npm run verify`
  ];

  const blockerItems = [];
  if (!isKnown)               blockerItems.push(`Unknown product: ${targetProduct}`);
  if (!input.finalGatePassed) blockerItems.push('v36 Final Gate not passed yet');

  const launchHandoffReady = isKnown && !!input.finalGatePassed;

  const recommendedNextAction = launchHandoffReady
    ? `Launch handoff ready. Copy implementationPrompt into Claude Code for ${repoCandidate}. ` +
      'After Claude returns handoff report, review via v38 Result Acceptance Gate.'
    : `Handoff not ready. Resolve: ${blockerItems.join('; ')}`;

  return {
    version:                TOOL_META.version,
    title:                  TOOL_META.title,
    dryRun:                 true,
    humanApprovalRequired:  true,
    launchHandoffId:        handoffId,
    targetProduct,
    targetRepoCandidate:    repoCandidate,
    launchObjective,
    claudeRole:             'Implement objective within allowed zones, run verification, generate handoff report. No git operations.',
    kosameRole:             'PM gate: review each stage output. Approve or hold before じゅんやさん YES.',
    humanRole:              'じゅんやさん: final YES for any git add/commit/push/tag/deploy.',
    allowedFiles,
    forbiddenFiles,
    allowedCommands:        ['node --check', 'npm run verify', 'git status (read-only)', 'git log (read-only)', 'ls/find/cat in allowed zones'],
    forbiddenCommands:      ['git add', 'git commit', 'git push', 'git tag', 'git reset --hard', 'git clean -f', 'rm -rf', 'gcloud deploy', 'docker build', 'cat .env'],
    preflightCommands,
    implementationPrompt,
    verificationCommands,
    reportFormat: {
      requiredFields: ['objective', 'targetProduct', 'changedFiles', 'nodeCheckResult', 'verificationResult', 'gitStatusOutput', 'sensitiveContentFound', 'dangerousOpsPerformed', 'readyForResultReview'],
      sensitiveContentFound: 'must be false',
      dangerousOpsPerformed: 'must be empty array'
    },
    stopConditions:          STOP_CONDITIONS,
    rollbackInstruction:     `git checkout -- <file> for each changed file in ${repoCandidate}. git reset --hard requires じゅんやさん YES.`,
    commitCandidateStopRule: COMMIT_CANDIDATE_STOP_RULE,
    blockerItems,
    launchHandoffReady,
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
  console.log(JSON.stringify(buildLaunchHandoff({
    targetProduct:    'email_reply_bot',
    launchObjective:  'docs整備: README.md に目次・概要セクションを追加する',
    allowedFiles:     ['docs/**', 'README.md', 'smoke/**'],
    forbiddenFiles:   ['.env*', 'secrets/**', 'credentials/**'],
    finalGatePassed:  true
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  REPO_CANDIDATES,
  DANGEROUS_ACTIONS_DENIED,
  STOP_CONDITIONS,
  COMMIT_CANDIDATE_STOP_RULE,
  buildLaunchHandoff
};
