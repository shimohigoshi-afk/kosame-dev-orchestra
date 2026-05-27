/**
 * Safe Tag Command Generator v3.4.0
 *
 * Generates safe git tag + push commands.
 * Only for use when GitHub Actions status is 'success'.
 * Requires じゅんやさんYES before any execution.
 */

const { guardCommandList } = require('./deny-command-guard');

function generateSafeTagCommands(tagInput = {}) {
  const {
    targetVersion = '',
    actionsStatus = 'unknown',
    verifyStatus = 'not_run',
    workingTreeClean = true,
    isAhead = false,
    junyaApproved = false,
    session_id = ''
  } = tagInput;

  const actionsOk = actionsStatus === 'success';
  const verifyOk = verifyStatus === 'passed';
  const canProceed = actionsOk && verifyOk && workingTreeClean && !isAhead && !!targetVersion;

  const blockers = [];
  if (!actionsOk) blockers.push(`GitHub Actions: ${actionsStatus} (must be success)`);
  if (!verifyOk) blockers.push(`verify: ${verifyStatus} (must be passed)`);
  if (!workingTreeClean) blockers.push('working tree dirty');
  if (isAhead) blockers.push('unpushed commits exist — push first');
  if (!targetVersion) blockers.push('targetVersion not specified');
  if (!junyaApproved) blockers.push('じゅんやさんのYES必要');

  const confirmCommands = [
    '# 1. 事前確認 (必須)',
    'git status -sb',
    'git log --oneline -3',
    ''
  ];

  const tagCommands = canProceed && junyaApproved ? [
    `# 2. tag作成 (じゅんやさんYES確認済み)`,
    `git tag v${targetVersion}`,
    `git push origin v${targetVersion}`
  ] : [
    `# 2. tag作成 (じゅんやさんYESが必要 — まだ実行しないでください)`,
    `# git tag v${targetVersion}  ← じゅんやさんYES後に実行`,
    `# git push origin v${targetVersion}  ← じゅんやさんYES後に実行`
  ];

  const allCommands = [...confirmCommands, ...tagCommands];
  const executableCommands = allCommands.filter(c => c && !c.startsWith('#'));
  const guardResult = guardCommandList(executableCommands);

  return {
    generator: 'safe-tag-command-generator',
    session_id,
    targetVersion,
    canProceed,
    junyaApproved,
    commands: allCommands,
    blockers,
    actionsStatus,
    verifyStatus,
    guardResult,
    humanApprovalRequired: true,
    gate_required: true,
    gate_reason: 'git tag / push は必ずじゅんやさんの最終YES後のみ実行。',
    version: '3.4.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateSafeTagCommands };

if (require.main === module) {
  const result = generateSafeTagCommands({
    targetVersion: '3.4.0',
    actionsStatus: 'success',
    verifyStatus: 'passed',
    workingTreeClean: true,
    isAhead: false,
    junyaApproved: false
  });
  console.log(JSON.stringify(result, null, 2));
}
