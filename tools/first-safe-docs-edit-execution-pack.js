'use strict';

const TOOL_META = {
  version: '15.0.0',
  title: 'First Safe Docs Edit Execution Pack',
  slug: 'first-safe-docs-edit-execution-pack'
};

const DEFAULT_ALLOWED_FILES = [
  './docs/ai-dev-team/**',
  './README.md'
];

const DEFAULT_DENIED_FILES = [
  './.env',
  './.env.*',
  './secrets/**',
  './credentials/**',
  './tools/**',
  './smoke/**',
  './fixtures/**',
  './package.json'
];

const DEFAULT_VERIFY_COMMANDS = [
  'node --check <editedFile>',
  'npm run verify',
  'git status --short'
];

const DANGEROUS_ACTIONS_DENIED = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'gcloud deploy', 'docker build',
  'rm -rf', 'git reset --hard', 'git clean',
  'secret', '.env', 'api key'
];

function validateEditScope(targetFile, allowedFiles, deniedFiles) {
  const isDenied  = deniedFiles.some(d => {
    if (d.endsWith('**')) return targetFile.startsWith(d.slice(0, -2));
    return targetFile === d || targetFile.includes(d.replace('./', ''));
  });
  const isAllowed = allowedFiles.some(a => {
    if (a.endsWith('**')) return targetFile.startsWith(a.slice(0, -2));
    return targetFile === a || targetFile.includes(a.replace('./', ''));
  });
  return { isAllowed: !isDenied && isAllowed, isDenied };
}

function buildEditScope(targetFiles, allowedFiles, deniedFiles) {
  return targetFiles.map(f => ({
    file:      f,
    ...validateEditScope(f, allowedFiles, deniedFiles)
  }));
}

function buildSafeDocsEditPack(input) {
  const taskGoal       = String(input.taskGoal || '(task goal)').trim();
  const targetFiles    = input.targetFiles    || ['README.md'];
  const allowedFiles   = input.allowedFiles   || DEFAULT_ALLOWED_FILES;
  const deniedFiles    = input.deniedFiles    || DEFAULT_DENIED_FILES;
  const editScopeDesc  = String(input.editScopeDesc || 'Add version notes to docs').trim();
  const verifyCommands = input.verifyCommands || DEFAULT_VERIFY_COMMANDS;
  const doneCriteria   = input.doneCriteria   || [
    'Target docs file updated with specified content',
    'node --check passes',
    'npm run verify passes',
    'git status shows only intended files changed'
  ];
  const rollbackHint   = input.rollbackHint || 'git checkout -- <file> to revert individual docs file.';
  const packId         = `safe-docs-edit-${Date.now()}`;

  const editScope = buildEditScope(targetFiles, allowedFiles, deniedFiles);
  const allAllowed = editScope.every(s => s.isAllowed);
  const anyDenied  = editScope.some(s => s.isDenied);

  const readyToPresent = allAllowed && !anyDenied;

  return {
    version:              TOOL_META.version,
    title:                TOOL_META.title,
    dryRun:               true,
    humanApprovalRequired: true,
    packId,
    taskGoal,
    allowedFiles,
    deniedFiles,
    editScope,
    editScopeDesc,
    verifyCommands,
    doneCriteria,
    rollbackHint,
    dangerousActionsDenied: DANGEROUS_ACTIONS_DENIED,
    allAllowed,
    anyDenied,
    readyToPresent,
    noRealFileEdit:       true,
    noRealCommit:         true,
    noRealPush:           true,
    noRealTag:            true,
    note: 'このpacket自体は実ファイル編集・commit・push・tagを自動実行しない。じゅんやさんのYESが必要。'
  };
}

function main() {
  console.log(JSON.stringify(buildSafeDocsEditPack({
    taskGoal:    'README.mdにv15.0.0 First Safe Docs Edit Execution Packの説明を追加する',
    targetFiles: ['README.md'],
    editScopeDesc: 'Add v15.0.0 section to README.md'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DEFAULT_ALLOWED_FILES,
  DEFAULT_DENIED_FILES,
  DEFAULT_VERIFY_COMMANDS,
  DANGEROUS_ACTIONS_DENIED,
  buildSafeDocsEditPack
};
