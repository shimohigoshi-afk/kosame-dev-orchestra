/**
 * Safe Commit Command Generator v3.4.0
 *
 * Generates safe git commit commands for Cloud Shell.
 * Avoids `git add -A` / `git add .` — limits scope to intended files.
 */

const { guardCommandList } = require('./deny-command-guard');

function generateSafeCommitCommands(commitInput = {}) {
  const {
    intendedFiles = [],
    commitMessage = '',
    verifyStatus = 'not_run',
    nodeCheckPassed = false,
    session_id = ''
  } = commitInput;

  const canProceed = verifyStatus === 'passed' && intendedFiles.length > 0;
  const message = commitMessage || 'chore: update (message required)';

  let commands = [];
  let warnings = [];

  if (!canProceed) {
    if (verifyStatus !== 'passed') warnings.push('verify未実行/FAIL — commit前にnpm run verifyを実行');
    if (intendedFiles.length === 0) warnings.push('intendedFiles未指定 — 対象ファイルを明示してください');
  }

  if (canProceed) {
    // Step 1: verify confirmation
    commands.push('# 1. verify確認');
    commands.push('npm run verify');
    commands.push('');
    // Step 2: status check
    commands.push('# 2. 差分確認');
    commands.push('git status -sb');
    commands.push('git diff --stat');
    commands.push('');
    // Step 3: targeted add (never -A or .)
    commands.push('# 3. 対象ファイルのみadd (ワイルドカードadd禁止)');
    for (const f of intendedFiles) {
      commands.push(`git add ${f}`);
    }
    commands.push('');
    // Step 4: commit
    commands.push('# 4. commit');
    commands.push(`git commit -m "${message.replace(/"/g, '\\"')}"`);
  }

  const guardResult = canProceed ? guardCommandList(commands.filter(c => c && !c.startsWith('#'))) : null;
  const allSafe = guardResult ? guardResult.allAllowed : false;

  return {
    generator: 'safe-commit-command-generator',
    session_id,
    canProceed,
    commands,
    warnings,
    intendedFiles,
    commitMessage: message,
    guardResult,
    allSafe,
    noteOnAddScope: 'git add -A および git add . は使用禁止。ファイルを個別指定してください。',
    version: '3.4.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateSafeCommitCommands };

if (require.main === module) {
  const result = generateSafeCommitCommands({
    intendedFiles: ['tools/kosame-cli-entry.js', 'package.json'],
    commitMessage: 'feat: add Kosame CLI entry pack (v3.1.0)',
    verifyStatus: 'passed',
    nodeCheckPassed: true
  });
  console.log(JSON.stringify(result, null, 2));
}
