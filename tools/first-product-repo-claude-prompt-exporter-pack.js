'use strict';

const TOOL_META = {
  version: '22.0.0',
  title: 'First Product Repo Claude Prompt Exporter',
  slug: 'first-product-repo-claude-prompt-exporter-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const CLAUDE_ROLES = {
  sales_dx:          'Implementation Engineer — 営業DX機能実装担当',
  anesty_board:      'Implementation Engineer — ANESTY Board機能実装担当（保険・健康データ禁止）',
  backoffice_agent:  'Implementation Engineer — BackOffice Agent機能実装担当',
  email_reply_bot:   'Implementation Engineer — Email Reply BOT機能実装担当',
  cloud_run_pm_agent: 'Implementation Engineer — KOSAME Dev Orchestra pack実装担当'
};

const FORBIDDEN_ACTIONS = [
  'git add (automated)',
  'git commit (automated)',
  'git push (automated)',
  'git tag (automated)',
  'deploy (any form)',
  'gcloud deploy',
  'docker build',
  'rm -rf',
  'git reset --hard',
  'git clean -f',
  'read .env or .env.*',
  'read secrets/** or credentials/**',
  'read or write API keys',
  'access customer PII',
  'access insurance / health / financial records'
];

const REPORT_FORMAT_TEMPLATE = {
  sections: [
    'editedFiles: list of files changed',
    'diffSummary: output of git diff --stat HEAD',
    'nodeCheckResult: output of node --check on each edited file',
    'verifyResult: output of npm run verify (or equivalent)',
    'smokeResult: output of smoke tests if applicable',
    'remainingRisks: any unresolved issues',
    'rollbackNote: how to revert if needed'
  ],
  format: 'JSON packet',
  handoffTarget: 'Product Verification & Handoff Collector (v18.5.0)'
};

const ROLLBACK_INSTRUCTIONS = {
  sales_dx:          'git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん explicit YES.',
  anesty_board:      'git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん explicit YES.',
  backoffice_agent:  'git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん explicit YES.',
  email_reply_bot:   'git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん explicit YES.',
  cloud_run_pm_agent: 'git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん explicit YES.'
};

function buildExportedPrompt(params) {
  const {
    targetProduct, targetRepo, claudeRole, taskScope,
    filesAllowedToTouch, filesForbiddenToTouch,
    implementationSteps, verificationCommands,
    dataBoundary, secretBoundary, rollbackInstruction
  } = params;

  return [
    `# Claude Code Implementation Prompt`,
    ``,
    `## Role`,
    claudeRole,
    ``,
    `## Target Repo`,
    targetRepo,
    ``,
    `## Target Product`,
    targetProduct,
    ``,
    `## Task Scope`,
    taskScope,
    ``,
    `## Files Allowed to Touch`,
    filesAllowedToTouch.map(f => `- ${f}`).join('\n'),
    ``,
    `## Files Forbidden to Touch`,
    filesForbiddenToTouch.map(f => `- ${f}`).join('\n'),
    ``,
    `## Implementation Steps`,
    implementationSteps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ``,
    `## Verification Commands`,
    verificationCommands.map(c => `- ${c}`).join('\n'),
    ``,
    `## Data Boundary`,
    dataBoundary,
    ``,
    `## Secret Boundary`,
    secretBoundary,
    ``,
    `## Forbidden Actions`,
    FORBIDDEN_ACTIONS.map(a => `- ${a}`).join('\n'),
    ``,
    `## Rollback Instruction`,
    rollbackInstruction,
    ``,
    `## Report Format`,
    `Return a JSON packet with: editedFiles, diffSummary, nodeCheckResult, verifyResult, smokeResult, remainingRisks, rollbackNote`,
    ``,
    `## Critical Safety Rules`,
    `- DO NOT run: git add / git commit / git push / git tag without explicit じゅんやさん YES`,
    `- DO NOT read: .env / secrets / API keys / customer PII`,
    `- DO NOT deploy: no deploy / gcloud deploy / docker build`,
    `- DO NOT delete: no rm -rf / git reset --hard / git clean without human YES`,
    `- humanApprovalRequired: true — stop and ask before any destructive or irreversible action`
  ].join('\n');
}

function buildPromptExporter(input) {
  const exporterId     = `prompt-export-${Date.now()}`;
  const targetProduct  = String(input.targetProduct || 'unknown').toLowerCase();
  const taskPacket     = input.taskPacket     || {};
  const connectionPrep = input.connectionPrep || {};

  const targetRepo  = input.targetRepo  || connectionPrep.repoPathCandidate || taskPacket.targetRepoCandidate || `kosame-${targetProduct}`;
  const claudeRole  = input.claudeRole  || CLAUDE_ROLES[targetProduct] || 'Implementation Engineer';
  const taskScope   = String(input.taskScope || taskPacket.taskGoal || '(task scope)').trim();

  const filesAllowedToTouch   = input.filesAllowedToTouch   || connectionPrep.safeWriteZones    || taskPacket.allowedFileZones   || ['src/**', 'docs/**'];
  const filesForbiddenToTouch = input.filesForbiddenToTouch || connectionPrep.deniedZones        || taskPacket.deniedFileZones    || ['.env*', 'secrets/**'];
  const implementationSteps   = input.implementationSteps   || [
    'Review task scope and allowed file zones',
    'Create or modify only files within allowed zones',
    'Run node --check on every edited file',
    'Run npm run verify (or equivalent)',
    'Run git status --short to confirm only intended files changed',
    'Collect diff summary and verification results',
    'Return JSON result packet — DO NOT git add / commit / push'
  ];
  const verificationCommands  = input.verificationCommands  || connectionPrep.verificationCommands || ['node --check <editedFile>', 'npm run verify', 'git status --short'];
  const dataBoundary          = input.dataBoundary          || taskPacket.dataBoundary          || 'No customer data';
  const secretBoundary        = input.secretBoundary        || taskPacket.secretBoundary        || 'No secrets of any kind';
  const rollbackInstruction   = input.rollbackInstruction   || connectionPrep.rollbackPolicy    || ROLLBACK_INSTRUCTIONS[targetProduct] || 'git checkout -- <file>';

  const isKnownProduct = SUPPORTED_PRODUCTS.includes(targetProduct);
  const hasTaskScope   = taskScope.length > 0 && taskScope !== '(task scope)';
  const hasAllowedFiles = filesAllowedToTouch.length > 0;

  const promptBlockedReasons = [];
  if (!isKnownProduct)   promptBlockedReasons.push(`Unknown product: ${targetProduct}`);
  if (!hasTaskScope)     promptBlockedReasons.push('taskScope is empty');
  if (!hasAllowedFiles)  promptBlockedReasons.push('filesAllowedToTouch is empty');

  const promptReady = promptBlockedReasons.length === 0;

  const exportedPrompt = promptReady
    ? buildExportedPrompt({
        targetProduct, targetRepo, claudeRole, taskScope,
        filesAllowedToTouch, filesForbiddenToTouch,
        implementationSteps, verificationCommands,
        dataBoundary, secretBoundary, rollbackInstruction
      })
    : `# BLOCKED\nPrompt export blocked. Reasons:\n${promptBlockedReasons.map(r => `- ${r}`).join('\n')}`;

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    promptExporterId:    exporterId,
    targetProduct,
    targetRepo,
    claudeRole,
    taskScope,
    filesAllowedToTouch,
    filesForbiddenToTouch,
    implementationSteps,
    verificationCommands,
    reportFormat:        REPORT_FORMAT_TEMPLATE,
    forbiddenActions:    FORBIDDEN_ACTIONS,
    rollbackInstruction,
    promptReady,
    promptBlockedReasons,
    exportedPrompt,
    noRealRepoEdit:      true,
    noRealExecution:     true,
    note: 'exportedPromptは実プロダクトrepoへの投げる直前に確認する。実行前にじゅんやさんのYESが必要。'
  };
}

function main() {
  const { buildTaskPacket } = require('./first-product-repo-task-packet-pack');
  const { buildConnectionPrepPacket } = require('./product-repo-connection-prep-pack');

  const taskPacket = buildTaskPacket({
    requestedProduct:    'sales_dx',
    taskTitle:           'メール返信機能の追加',
    taskGoal:            '営業DXにリード向けメール一括返信機能を追加する',
    businessContext:     '営業担当者が複数リードへ一括フォローアップメールを送れるようにする',
    implementationIntent: 'src/leads/bulk-email-reply.js を新規作成し、UI コンポーネントに接続する'
  });

  const connectionPrep = buildConnectionPrepPacket({
    productType: 'sales_dx',
    taskId: taskPacket.productRepoTaskId
  });

  console.log(JSON.stringify(buildPromptExporter({
    targetProduct: 'sales_dx',
    taskPacket,
    connectionPrep
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  FORBIDDEN_ACTIONS,
  REPORT_FORMAT_TEMPLATE,
  buildPromptExporter
};
