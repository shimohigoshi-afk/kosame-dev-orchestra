/**
 * Safe Push Command Generator v3.4.0
 *
 * Generates safe git push commands with confirmation steps.
 * Always includes status check + log check before push proposal.
 * Requires じゅんやさんYES before execution.
 */

const { guardCommandList } = require('./deny-command-guard');

function generateSafePushCommands(pushInput = {}) {
  const {
    branch = 'main',
    verifyStatus = 'not_run',
    workingTreeClean = false,
    isAhead = false,
    junyaApproved = false,
    session_id = ''
  } = pushInput;

  const canProceed = verifyStatus === 'passed' && workingTreeClean && isAhead;
  const warnings = [];

  if (!verifyStatus || verifyStatus !== 'passed') warnings.push('verify未実行/FAIL');
  if (!workingTreeClean) warnings.push('uncommitted changes — commit first');
  if (!isAhead) warnings.push('originより進んでいない — pushする内容がない');
  if (!junyaApproved) warnings.push('じゅんやさんのYESが必要 — approval gate通過後に実行');

  const confirmCommands = [
    '# 1. 事前確認 (必須)',
    'git status -sb',
    'git log origin/main..HEAD --oneline',
    'git diff origin/main..HEAD --stat',
    ''
  ];

  const pushCommands = junyaApproved && canProceed ? [
    '# 2. push (じゅんやさんYES確認済み)',
    `git push origin ${branch}`
  ] : [
    '# 2. push (じゅんやさんYESが必要 — まだ実行しないでください)',
    `# git push origin ${branch}  ← じゅんやさんYES後に実行`
  ];

  const allCommands = [...confirmCommands, ...pushCommands];
  const executableCommands = allCommands.filter(c => c && !c.startsWith('#'));
  const guardResult = guardCommandList(executableCommands);

  return {
    generator: 'safe-push-command-generator',
    session_id,
    canProceed,
    junyaApproved,
    commands: allCommands,
    warnings,
    branch,
    guardResult,
    humanApprovalRequired: true,
    gate_required: true,
    gate_reason: 'git push は必ずじゅんやさんの最終YES後のみ実行。',
    version: '3.4.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateSafePushCommands };

if (require.main === module) {
  const result = generateSafePushCommands({
    branch: 'main',
    verifyStatus: 'passed',
    workingTreeClean: true,
    isAhead: true,
    junyaApproved: false
  });
  console.log(JSON.stringify(result, null, 2));
}
