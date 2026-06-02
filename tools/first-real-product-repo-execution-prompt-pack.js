'use strict';

const TOOL_META = {
  version: '24.0.0',
  title: 'First Real Product Repo Execution Prompt Pack',
  slug: 'first-real-product-repo-execution-prompt-pack'
};

const SUPPORTED_PRODUCTS = [
  'sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'
];

const CLAUDE_ROLES = {
  sales_dx:          'Implementation Engineer — 営業DX / 実プロダクトrepo作業',
  anesty_board:      'Implementation Engineer — ANESTY Board / 保険・健康データ厳禁',
  backoffice_agent:  'Implementation Engineer — BackOffice Agent / 財務・人事データ厳禁',
  email_reply_bot:   'Implementation Engineer — Email Reply BOT / 実メール認証情報厳禁',
  cloud_run_pm_agent: 'Implementation Engineer — KOSAME Dev Orchestra / Cloud Run PM Agent'
};

const COMMANDS_ALLOWED = [
  'node --check <editedFile>',
  'npm run verify (or equivalent)',
  'npm test (non-destructive)',
  'git status --short',
  'git diff --stat HEAD',
  'git log --oneline -5',
  'cat README.md',
  'ls -la (read-only)'
];

const COMMANDS_FORBIDDEN = [
  'git add (without explicit じゅんやさん YES)',
  'git commit (without explicit じゅんやさん YES)',
  'git push (without explicit じゅんやさん YES)',
  'git tag (without explicit じゅんやさん YES)',
  'git reset --hard (without explicit じゅんやさん YES)',
  'git clean -f (without explicit じゅんやさん YES)',
  'rm -rf <anything>',
  'deploy / gcloud deploy / docker build / docker push',
  'cat .env / cat .env.* / cat secrets/**',
  'node -e (arbitrary eval)',
  'curl / wget to external APIs with real credentials',
  'Any command that writes to production systems'
];

const REPORT_FORMAT = {
  returnAsJsonPacket: true,
  requiredFields: [
    'editedFiles',
    'diffSummary',
    'nodeCheckResult',
    'verifyResult',
    'smokeResult',
    'remainingRisks',
    'rollbackNote',
    'gitStatusOutput'
  ],
  handoffTarget: 'Product Verification & Handoff Collector (v18.5.0)',
  note: 'Stop at commit candidate. Do NOT git add / commit / push without explicit じゅんやさん YES.'
};

function buildExportedExecutionPrompt(params) {
  const {
    targetProduct, targetRepo, claudeRole, taskScope,
    filesAllowedToTouch, filesForbiddenToTouch,
    implementationSteps, verificationCommands,
    dataBoundary, secretBoundary, regulatedDataNote,
    rollbackInstruction
  } = params;

  const lines = [
    `# Claude Code Execution Prompt — Real Product Repo`,
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
    `## Commands Allowed`,
    COMMANDS_ALLOWED.map(c => `- ${c}`).join('\n'),
    ``,
    `## Commands Forbidden`,
    COMMANDS_FORBIDDEN.map(c => `- ${c}`).join('\n'),
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
    `## Regulated Data Boundary`,
    regulatedDataNote || 'No regulated data boundary for this product.',
    ``,
    `## Rollback Instruction`,
    rollbackInstruction,
    ``,
    `## Report Format`,
    `Return a JSON packet with ALL of the following fields:`,
    REPORT_FORMAT.requiredFields.map(f => `- ${f}`).join('\n'),
    ``,
    `## CRITICAL SAFETY RULES — READ BEFORE ANY ACTION`,
    ``,
    `### Git Operations`,
    `- DO NOT run git add / git commit / git push / git tag without explicit じゅんやさん YES`,
    `- DO NOT run git reset --hard / git clean -f without explicit じゅんやさん YES`,
    `- Stop at "commit candidate" state — report result and WAIT for human YES`,
    ``,
    `### Secrets & Credentials`,
    `- DO NOT read .env / .env.* / secrets/** / credentials/**`,
    `- DO NOT echo or log any API keys, passwords, or tokens`,
    `- DO NOT access Secret Manager or any cloud credential store`,
    ``,
    `### Customer & Regulated Data`,
    `- DO NOT include any customer PII in code, prompts, or logs`,
    `- DO NOT access insurance policy data, health/medical records, or patient information`,
    `- DO NOT include real email addresses or personal names in code or templates`,
    `- Use synthetic / anonymized / mock data ONLY`,
    ``,
    `### Deploy & Infrastructure`,
    `- DO NOT deploy to any environment (staging or production)`,
    `- DO NOT run gcloud deploy / docker build / docker push`,
    `- DO NOT modify CI/CD configurations without human review`,
    ``,
    `### General Safety`,
    `- humanApprovalRequired: true — STOP and ask before any destructive or irreversible action`,
    `- If unsure about scope, ask before touching a file`,
    `- Report all unexpected findings immediately`
  ];

  return lines.join('\n');
}

function buildExecutionPromptPack(input) {
  const packId        = `exec-prompt-pack-${Date.now()}`;
  const targetProduct = String(input.targetProduct || 'unknown').toLowerCase();
  const dispatchPlan  = input.dispatchPlan  || {};
  const safetyReview  = input.safetyReview  || {};

  const targetRepo   = input.targetRepo   || dispatchPlan.targetRepoCandidate || `kosame-${targetProduct}`;
  const claudeRole   = input.claudeRole   || CLAUDE_ROLES[targetProduct] || 'Implementation Engineer';
  const taskScope    = String(input.taskScope || dispatchPlan.taskGoal || '(task scope)').trim();

  const filesAllowedToTouch   = input.filesAllowedToTouch   || dispatchPlan.allowedFileZones   || [];
  const filesForbiddenToTouch = input.filesForbiddenToTouch || dispatchPlan.deniedFileZones    || [];
  const implementationSteps   = input.implementationSteps   || [
    'Review task scope and confirm you are in the correct repo',
    'Confirm you are on the correct branch (never work directly on main)',
    'Edit ONLY files within the allowed file zones',
    'Run node --check on every edited JS file',
    'Run npm run verify (or product equivalent)',
    'Run git status --short — confirm only intended files changed',
    'Run git diff --stat HEAD — record change scope',
    'Collect all verification results into a JSON report',
    'STOP — do NOT git add / commit / push. Return report and wait for human YES.'
  ];
  const verificationCommands  = input.verificationCommands  || ['node --check <editedFile>', 'npm run verify', 'git status --short', 'git diff --stat HEAD'];

  const secretSpec    = safetyReview.secretBoundaryReview   || dispatchPlan.secretBoundary    || {};
  const custSpec      = safetyReview.customerDataBoundaryReview || dispatchPlan.dataBoundary  || {};
  const regSpec       = safetyReview.regulatedDataBoundaryReview || {};
  const rollbackSpec  = dispatchPlan.rollbackPlan           || {};

  const dataBoundary       = input.dataBoundary    || custSpec.rule    || 'No customer data of any kind';
  const secretBoundary     = input.secretBoundary  || secretSpec.rule  || 'No secrets of any kind';
  const regulatedDataNote  = regSpec.applicable ? regSpec.note : (input.regulatedDataNote || null);
  const rollbackInstruction = input.rollbackInstruction || rollbackSpec.fileLevel ||
    `git checkout -- <file> for each changed file. git reset --hard requires じゅんやさん YES.`;

  const isKnownProduct  = SUPPORTED_PRODUCTS.includes(targetProduct);
  const hasTaskScope    = taskScope.length > 0 && taskScope !== '(task scope)';
  const hasAllowedFiles = filesAllowedToTouch.length > 0;
  const safetyCleared   = input.safetyGatePassed !== false && (safetyReview.safetyGatePassed !== false);

  const promptBlockedReasons = [];
  if (!isKnownProduct)  promptBlockedReasons.push(`Unknown product: ${targetProduct}`);
  if (!hasTaskScope)    promptBlockedReasons.push('taskScope is empty');
  if (!hasAllowedFiles) promptBlockedReasons.push('filesAllowedToTouch is empty');
  if (!safetyCleared)   promptBlockedReasons.push('Safety gate review not passed — resolve blockers first');

  const promptReady = promptBlockedReasons.length === 0;

  const exportedExecutionPrompt = promptReady
    ? buildExportedExecutionPrompt({
        targetProduct, targetRepo, claudeRole, taskScope,
        filesAllowedToTouch, filesForbiddenToTouch,
        implementationSteps, verificationCommands,
        dataBoundary, secretBoundary, regulatedDataNote, rollbackInstruction
      })
    : `# EXECUTION PROMPT BLOCKED\n\nReasons:\n${promptBlockedReasons.map(r => `- ${r}`).join('\n')}`;

  const handoffToKosame = {
    target:         'Kosame/GPT PM',
    status:         promptReady ? 'PROMPT_READY' : 'BLOCKED',
    taskScope,
    targetProduct,
    targetRepo,
    actionRequired: promptReady
      ? 'Review exportedExecutionPrompt. Present to じゅんやさん for final YES before sending to Claude.'
      : `Resolve blocked reasons: ${promptBlockedReasons.join('; ')}`
  };

  return {
    version:             TOOL_META.version,
    title:               TOOL_META.title,
    dryRun:              true,
    humanApprovalRequired: true,
    executionPromptPackId: packId,
    targetProduct,
    targetRepo,
    claudeRole,
    taskScope,
    implementationSteps,
    filesAllowedToTouch,
    filesForbiddenToTouch,
    commandsAllowed:     COMMANDS_ALLOWED,
    commandsForbidden:   COMMANDS_FORBIDDEN,
    verificationCommands,
    reportFormat:        REPORT_FORMAT,
    rollbackInstruction,
    promptReady,
    promptBlockedReasons,
    exportedExecutionPrompt,
    handoffToKosame,
    noRealRepoEdit:      true,
    noRealExecution:     true,
    note: 'exportedExecutionPromptは実プロダクトrepoへ投げる直前の確認用。じゅんやさんのYES後のみ実行。'
  };
}

function main() {
  const { buildDispatchPlan } = require('./first-real-product-repo-dispatch-plan-pack');
  const { buildSafetyGateReview } = require('./product-repo-safety-gate-review-pack');

  const dispatchPlan = buildDispatchPlan({
    targetProduct:   'sales_dx',
    taskTitle:       'メール一括返信機能の追加',
    taskGoal:        '営業DXにリード向けメール一括返信機能を追加する',
    businessContext: '営業担当者が複数リードへ一括フォローアップメールを送れるようにする'
  });

  const safetyReview = buildSafetyGateReview({ targetProduct: 'sales_dx', dispatchPlan });

  console.log(JSON.stringify(buildExecutionPromptPack({
    targetProduct: 'sales_dx',
    dispatchPlan,
    safetyReview,
    safetyGatePassed: safetyReview.safetyGatePassed
  }), null, 2));
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  SUPPORTED_PRODUCTS,
  COMMANDS_ALLOWED,
  COMMANDS_FORBIDDEN,
  REPORT_FORMAT,
  buildExecutionPromptPack
};
