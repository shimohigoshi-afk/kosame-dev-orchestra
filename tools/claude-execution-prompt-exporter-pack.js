'use strict';

const TOOL_META = {
  version: '12.5.0',
  title: 'Claude Execution Prompt Exporter',
  slug: 'claude-execution-prompt-exporter-pack'
};

const DEFAULT_ALLOWED_FILES = [
  './tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'
];

const DEFAULT_DENIED_FILES = [
  './.env', './.env.*', './*.pem', './*.key',
  './secrets/**', './credentials/**', './**/node_modules/**',
  './.git/**', './Dockerfile', './cloud-run/**', './apps/pm-agent/**'
];

const DEFAULT_VERIFY_COMMANDS = [
  'node --check {newFiles}',
  'npm run smoke:{packSlug}',
  'npm run verify',
  'git diff --stat HEAD',
  'git status --short'
];

const DEFAULT_DONE_CRITERIA = [
  'All new JS files pass node --check',
  'Smoke test passes',
  'npm run verify passes',
  'git diff --stat HEAD is non-empty',
  'No new secrets or .env values exposed'
];

const DEFAULT_FORBIDDEN_ACTIONS = [
  'git add', 'git commit', 'git push', 'git tag',
  'deploy', 'docker build', 'gcloud run deploy',
  'rm -rf', 'git reset --hard',
  'Secret value read', '.env value read', 'API key value read',
  'customer data sharing', 'insurance data sharing'
];

function generateExporterId() {
  return `exporter-${Date.now()}`;
}

function buildClaudePromptText(opts) {
  const { taskGoal, allowedFiles, deniedFiles, verifyCommands, doneCriteria, forbiddenActions } = opts;

  return [
    '# Claude Implementation Prompt',
    '',
    '## Task',
    taskGoal,
    '',
    '## allowedFiles',
    '触ってよいファイル (these files may be edited after human approval):',
    allowedFiles.map(f => `- ${f}`).join('\n'),
    '',
    '## deniedFiles',
    '触ってはいけないファイル (NEVER edit these):',
    deniedFiles.map(f => `- ${f}`).join('\n'),
    '',
    '## Implementation Scope',
    '実装範囲: allowedFiles の範囲内での編集のみ。',
    '',
    '## verifyCommands',
    '検証コマンド (run in order after implementation):',
    verifyCommands.map(c => `- ${c}`).join('\n'),
    '',
    '## doneCriteria',
    '完了条件:',
    doneCriteria.map(c => `- ${c}`).join('\n'),
    '',
    '## forbiddenActions',
    '禁止事項:',
    forbiddenActions.map(a => `- ${a}`).join('\n'),
    '',
    '## Report Format',
    '報告形式: JSON',
    '{ "status": "success|failure", "filesChanged": [...], "verifyResult": "...", "issues": [] }',
    '',
    '## Safety Rules',
    '- git add / git commit / git push / git tag はしない',
    '- Secret / .env / API key は読まない',
    '- 実API呼び出し禁止',
    '- deploy / docker build / gcloud deploy 禁止',
    '- 顧客情報 / 保険証券 / 健診情報 / 個人名入り議事録は扱わない'
  ].join('\n');
}

function buildExporter(input) {
  const docsTaskPacket     = input.docsTaskPacket     || {};
  const repoStatus         = String(input.repoStatus         || 'git clean');
  const implementationMode = String(input.implementationMode || 'dry-run');
  const allowedFiles       = input.allowedFiles       || DEFAULT_ALLOWED_FILES;
  const deniedFiles        = input.deniedFiles        || DEFAULT_DENIED_FILES;
  const verifyCommands     = input.verifyCommands     || DEFAULT_VERIFY_COMMANDS;
  const doneCriteria       = input.doneCriteria       || DEFAULT_DONE_CRITERIA;
  const forbiddenActions   = input.forbiddenActions   || DEFAULT_FORBIDDEN_ACTIONS;

  const taskGoal = docsTaskPacket.normalizedDocsTask
    ? String(docsTaskPacket.normalizedDocsTask.taskGoal || '(docs task goal)')
    : String(input.taskGoal || '(docs task goal)');

  const exporterId = generateExporterId();

  const claudePrompt = buildClaudePromptText({
    taskGoal, allowedFiles, deniedFiles, verifyCommands, doneCriteria, forbiddenActions
  });

  const approvalGates = {
    commitGate: { allowed: false, requiresHumanApproval: true, note: 'git commit requires explicit human YES' },
    pushGate:   { allowed: false, requiresHumanApproval: true, note: 'git push requires explicit human YES' },
    tagGate:    { allowed: false, requiresHumanApproval: true, note: 'git tag requires explicit human YES' },
    deployGate: { allowed: false, requiresHumanApproval: true, note: 'deploy requires explicit human YES' }
  };

  const safetyNotes = [
    'git add / commit / push / tag はしない',
    'Secret / .env / API key は読まない',
    '実API呼び出し禁止',
    'Gemini / Grok は repo 編集不可',
    'Claude のみ repo 編集候補 (このpackでは編集しない)',
    'じゅんやさんは final YES のみ'
  ];

  const exportPassed = typeof claudePrompt === 'string' && claudePrompt.length > 100;

  const recommendedNextAction = exportPassed
    ? 'Export passed — paste claudePrompt into Claude Code session. Await result. Route to kosame for review.'
    : 'Export failed — check claudePrompt generation';

  return {
    version: TOOL_META.version,
    title:   TOOL_META.title,
    dryRun:  true,
    humanApprovalRequired: true,
    exporterId,
    claudePrompt,
    allowedFiles,
    deniedFiles,
    verifyCommands,
    doneCriteria,
    forbiddenActions,
    approvalGates,
    safetyNotes,
    noRealApiExecution: true,
    noRealFileEdit:     true,
    exportPassed,
    recommendedNextAction
  };
}

function main() {
  const sampleDocsTask = {
    normalizedDocsTask: {
      taskGoal: 'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtime / v11.0.0 First Practical Orchestra Task Runnerの説明を追加する'
    }
  };
  console.log(JSON.stringify(buildExporter({
    docsTaskPacket:     sampleDocsTask,
    repoStatus:         'git clean, smoke passing',
    implementationMode: 'dry-run'
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  DEFAULT_ALLOWED_FILES,
  DEFAULT_DENIED_FILES,
  DEFAULT_VERIFY_COMMANDS,
  DEFAULT_DONE_CRITERIA,
  DEFAULT_FORBIDDEN_ACTIONS,
  buildClaudePromptText,
  buildExporter
};
