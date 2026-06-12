#!/usr/bin/env node
'use strict';

/**
 * KOSAME Work Order Prompt Exporter v110.71.0
 *
 * v110.69 Agent Work Order Auto Splitter の workOrders を受け取り、
 * 各AIへ貼るための安全な指示文 (prompt pack) を自動生成する。
 *
 * 【制約】
 *   - 実AI送信はしない。プロンプト文面の生成のみ。
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *   - 実 deploy / IAM / Scheduler 変更はしない
 *
 * Usage:
 *   node tools/kosame-work-order-prompt-exporter.js
 *   node tools/kosame-work-order-prompt-exporter.js --json
 */

const path = require('path');

const TOOL_META = {
  version:       '110.71.0',
  feature:       'v110-71-work-order-prompt-exporter',
  slug:          'kosame-work-order-prompt-exporter',
  dryRunOnly:    true,
};

const STATUS = {
  safe:       'safe',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
  gray: '\x1b[90m', bgRed: '\x1b[41m', bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

// ── Prompt templates per agent ───────────────────────────────────────────────

function buildGptPrompt(workOrder) {
  const scope = workOrder.allowedScope || '企画・構成・台本作成・設計整理';
  const files = (workOrder.targetFiles || []).join(', ') || 'tools/**';
  return {
    targetAgent: 'gpt_codex',
    intendedRole: '企画・構成・台本作成・設計整理',
    promptText: [
      `You are GPT / Codex. Your role is: ${workOrder.role || '企画・構成・台本作成・設計整理'}.`,
      '',
      `Allowed scope: ${scope}`,
      `Target files: ${files}`,
      '',
      'Generated from work order:',
      `  Title: ${workOrder.sanitizedTaskPack?.taskTitle || workOrder.agent}`,
      `  Summary: ${workOrder.sanitizedTaskPack?.taskSummary || ''}`,
      '',
      'Forbidden:',
      '  - No commit / tag / push / deploy without human approval',
      '  - No Secret / API key / .env / credentials access',
      '  - No customer data / PII handling',
      '  - No salesDX / transcriber / ANESTY Board access',
      '',
      'Output:',
      '  - Provide implementation plan or design document',
      '  - Include verify commands if applicable',
      `  - Verify: ${(workOrder.expectedSmoke || []).join(', ')}`,
      '',
      'safetyNotes: DryRun only. No real API calls.',
      ...(workOrder.sanitizedTaskPack?.safetyNotes ? [`Additional: ${workOrder.sanitizedTaskPack.safetyNotes}`] : []),
    ].join('\n'),
    allowedScope: scope,
    forbiddenContext: 'Secret/customer/salesDX/ANESTY/commit/push/deploy',
    requiredOutput: 'implementation_plan_or_design',
    safetyNotes: workOrder.sanitizedTaskPack?.safetyNotes || 'DryRun only. No real API calls. No commit/push/deploy.',
  };
}

function buildDeepSeekPrompt(workOrder) {
  const scope = workOrder.allowedScope || 'sanitized_only low-sensitivity template creation';
  const files = (workOrder.targetFiles || []).join(', ') || 'smoke/**';
  return {
    targetAgent: 'deepseek_opencode',
    intendedRole: 'sanitized_only low-sensitivity template creation',
    promptText: [
      `You are DeepSeek / opencode. Your role is: ${workOrder.role || 'sanitized_only low-sensitivity template creation'}.`,
      '',
      'IMPORTANT RESTRICTIONS:',
      '  - SANITIZED_ONLY: You must only handle sanitized, low-sensitivity tasks.',
      '  - NO SECRETS: Do not read or output any API keys, tokens, .env, credentials.',
      '  - NO CUSTOMER DATA: Do not handle customer data, PII, or personal information.',
      '  - NO SALESDX: Do not access salesDX, transcriber, or related systems.',
      '  - NO ANESTY BOARD: Do not access ANESTY Board or its data.',
      '  - NO FULL REPO READ: Only access allowed files listed below.',
      '  - NO COMMIT/PUSH/DEPLOY: Do not commit, tag, push, or deploy.',
      '',
      `Allowed scope: ${scope}`,
      `Allowed files: ${files}`,
      '',
      'Generated from work order:',
      `  Title: ${workOrder.sanitizedTaskPack?.taskTitle || workOrder.agent}`,
      `  Summary: ${workOrder.sanitizedTaskPack?.taskSummary || ''}`,
      '',
      'Output:',
      '  - Create safe, low-sensitivity templates or documentation',
      '  - Do not include any real values for secrets/credentials',
      '  - Use placeholder values (e.g., YOUR_API_KEY) for any examples',
      `  - Verify: ${(workOrder.expectedSmoke || []).join(', ')}`,
      '',
      'safetyNotes: sanitized_only. No real data access.',
    ].join('\n'),
    allowedScope: scope,
    forbiddenContext: 'Secret/customer/salesDX/ANESTY/commit/push/deploy/fullRepo',
    requiredOutput: 'sanitized_template_or_doc',
    safetyNotes: 'sanitized_only. No real data access. No secrets. No customer data. No salesDX/ANESTY.',
  };
}

function buildClaudePrompt(workOrder) {
  const scope = workOrder.allowedScope || '品質チェック・境界監査・最終レビュー';
  const files = (workOrder.targetFiles || []).join(', ') || 'docs/**';
  return {
    targetAgent: 'claude',
    intendedRole: '品質チェック・境界監査・最終レビュー',
    promptText: [
      `You are Claude. Your role is: ${workOrder.role || '品質チェック・境界監査・最終レビュー'}.`,
      '',
      `Scope: ${scope}`,
      `Target files: ${files}`,
      '',
      'Generated from work order:',
      `  Title: ${workOrder.sanitizedTaskPack?.taskTitle || workOrder.agent}`,
      `  Summary: ${workOrder.sanitizedTaskPack?.taskSummary || ''}`,
      '',
      'Your responsibilities:',
      '  - Quality check: Verify implementation meets requirements',
      '  - Boundary audit: Check for security edge cases',
      '  - Final review: Confirm readiness for release',
      '',
      'Forbidden:',
      '  - No commit / tag / push / deploy',
      '  - No Secret / API key / .env / credentials access',
      '',
      `  - Verify: ${(workOrder.expectedSmoke || []).join(', ')}`,
      '',
      'safetyNotes: Review only. No real mutations.',
    ].join('\n'),
    allowedScope: scope,
    forbiddenContext: 'Secret/commit/push/deploy',
    requiredOutput: 'quality_review_or_audit_report',
    safetyNotes: 'Review only. No real mutations. No commit/push/deploy.',
  };
}

function buildGrokPrompt(workOrder) {
  const scope = workOrder.allowedScope || '穴探し・反対意見・リスクレビュー';
  const files = (workOrder.targetFiles || []).join(', ') || 'docs/**';
  return {
    targetAgent: 'grok',
    intendedRole: '穴探し・反対意見・リスクレビュー',
    promptText: [
      `You are Grok. Your role is: ${workOrder.role || '穴探し・反対意見・リスクレビュー'}.`,
      '',
      `Scope: ${scope}`,
      `Target files: ${files}`,
      '',
      'Generated from work order:',
      `  Title: ${workOrder.sanitizedTaskPack?.taskTitle || workOrder.agent}`,
      `  Summary: ${workOrder.sanitizedTaskPack?.taskSummary || ''}`,
      '',
      'Your responsibilities:',
      '  - Find holes and missing edge cases',
      '  - Provide counter-arguments and risk analysis',
      '  - Point out overlooked issues in the current approach',
      '',
      'Forbidden:',
      '  - No commit / tag / push / deploy',
      '  - No Secret / API key / .env / credentials access',
      '',
      'Constraints:',
      '  - Final decision rests with human operator',
      '  - Your role is advisory only',
      '',
      'safetyNotes: Review only. No real mutations.',
    ].join('\n'),
    allowedScope: scope,
    forbiddenContext: 'Secret/commit/push/deploy',
    requiredOutput: 'risk_review_or_counter_argument',
    safetyNotes: 'Review only. Advisory role. Final decision by human.',
  };
}

function buildGeminiPrompt(workOrder) {
  const scope = workOrder.allowedScope || 'Google / Cloud / 検索整理 / 環境確認';
  const files = (workOrder.targetFiles || []).join(', ') || 'tools/**';
  return {
    targetAgent: 'gemini',
    intendedRole: 'Google / Cloud / 検索整理 / 環境確認',
    promptText: [
      `You are Gemini. Your role is: ${workOrder.role || 'Google / Cloud / 検索整理 / 環境確認'}.`,
      '',
      `Scope: ${scope}`,
      `Target files: ${files}`,
      '',
      'Generated from work order:',
      `  Title: ${workOrder.sanitizedTaskPack?.taskTitle || workOrder.agent}`,
      `  Summary: ${workOrder.sanitizedTaskPack?.taskSummary || ''}`,
      '',
      'Your responsibilities:',
      '  - Google Cloud / IAM / Cloud Run / Scheduler configuration review',
      '  - Search and organize information',
      '  - Environment confirmation',
      '',
      'Forbidden:',
      '  - No commit / tag / push / deploy',
      '  - No Secret / API key / .env / credentials access',
      '  - No real IAM / Scheduler mutations',
      '',
      'Constraints:',
      '  - All operations are dryRun only',
      '  - No real GCP API calls',
      '',
      'safetyNotes: DryRun only. No real GCP mutations.',
    ].join('\n'),
    allowedScope: scope,
    forbiddenContext: 'Secret/commit/push/deploy/realIAM/realScheduler',
    requiredOutput: 'configuration_review_or_info_organization',
    safetyNotes: 'DryRun only. No real GCP API calls. No real IAM/Scheduler mutations.',
  };
}

const PROMPT_BUILDERS = {
  gpt_codex: buildGptPrompt,
  claude: buildClaudePrompt,
  gemini: buildGeminiPrompt,
  grok: buildGrokPrompt,
  deepseek_opencode: buildDeepSeekPrompt,
};

// ── Danger content patterns ─────────────────────────────────────────────────

const DANGER_TEXT_PATTERNS = [
  { id: 'sales_dx',      re: /営業DX|sales.?dx|transcriber/i,                      label: 'salesDX/transcriber' },
  { id: 'anesty_board',  re: /ANESTY\s*Board|anesty[_\-]board/i,                    label: 'ANESTY Board' },
  { id: 'secret',        re: /(?:api[_-]?key|bot[_-]?token|secret|credential|password|\.env)[\s=:'"]/i, label: 'Secret/credential' },
  { id: 'customer_data', re: /顧客情報|個人情報|customer_data|pii\b/i,               label: 'Customer data' },
];

// ── Main exporter ─────────────────────────────────────────────────────────────

function buildPromptExporter(workOrders = []) {
  const promptPacks = [];
  const blockedReasons = [];
  const cautions = [];
  const humanGateItems = [];
  let hasBlocked = false;
  let hasCaution = false;
  let humanGate = false;

  for (const wo of workOrders) {
    const builder = PROMPT_BUILDERS[wo.agentKey];
    if (!builder) {
      cautions.push(`Unknown agent key: ${wo.agentKey}`);
      hasCaution = true;
      continue;
    }

    const pack = builder(wo);

    // Scan forbidden context and scope for danger keywords in actual work content
    const scanText = `${wo.allowedScope || ''} ${wo.sanitizedTaskPack?.taskTitle || ''} ${wo.sanitizedTaskPack?.taskSummary || ''}`;
    for (const dp of DANGER_TEXT_PATTERNS) {
      if (dp.re.test(scanText)) {
        humanGate = true;
        humanGateItems.push({ agent: wo.agentKey, reason: `work order contains ${dp.label} reference` });
        blockedReasons.push(`[${wo.agentKey}] Work order contains ${dp.label} reference`);
      }
    }

    promptPacks.push(pack);
  }

  if (workOrders.length === 0) {
    blockedReasons.push('No work orders provided');
    hasBlocked = true;
  }

  // Overall status
  let status;
  let nextAllowedAction;

  if (humanGate) {
    status = STATUS.human_gate;
    nextAllowedAction = 'review_and_remove_dangerous_content_from_prompts';
  } else if (hasBlocked) {
    status = STATUS.blocked;
    nextAllowedAction = 'fix_blocked_work_orders_and_rerun';
  } else if (hasCaution) {
    status = STATUS.caution;
    nextAllowedAction = 'review_cautions_then_export_prompts';
  } else {
    status = STATUS.safe;
    nextAllowedAction = 'prompts_ready_for_dispatch';
  }

  return {
    tool:       TOOL_META.slug,
    version:    TOOL_META.version,
    timestamp:  new Date().toISOString(),
    dryRun:     true,
    status,
    workOrderCount: workOrders.length,
    promptPackCount: promptPacks.length,
    promptPacks,
    blockedReasons,
    cautions,
    humanGateItems,
    nextAllowedAction,
    humanApprovalRequired: humanGate,
    summaryForDashboard: {
      status,
      workOrderCount: workOrders.length,
      promptPackCount: promptPacks.length,
      blockedCount: blockedReasons.length,
      cautionCount: cautions.length,
      humanGateCount: humanGateItems.length,
      nextAllowedAction,
    },
  };
}

// ── Demo / fixture generator ─────────────────────────────────────────────────

function createDemoWorkOrders() {
  return [
    {
      agentKey: 'gpt_codex',
      agent: 'GPT / Codex',
      role: '設計・裁定・検収・安全分解・長距離実装',
      providerKey: 'gpt_codex',
      modelId: 'gpt-5.4-mini',
      status: 'safe',
      allowedScope: '企画・構成・台本作成・設計整理',
      targetFiles: ['tools/**', 'smoke/**'],
      expectedSmoke: ['npm run verify'],
      sanitizedTaskPack: { taskTitle: 'Design system architecture', taskSummary: 'Create design documents for the new feature', safetyNotes: '' },
    },
    {
      agentKey: 'deepseek_opencode',
      agent: 'DeepSeek / opencode',
      role: 'sanitized_only 低機密テンプレ作成',
      providerKey: 'deepseek_opencode',
      modelId: 'deepseek-chat',
      status: 'safe',
      allowedScope: 'sanitized_only low-sensitivity template creation',
      targetFiles: ['smoke/**'],
      expectedSmoke: ['npm run verify'],
      sanitizedTaskPack: { taskTitle: 'Create smoke test fixture', taskSummary: 'Add test fixture for new module', safetyNotes: 'sanitized_only' },
    },
    {
      agentKey: 'claude',
      agent: 'Claude',
      role: '品質監査・境界監査・高難度仕上げ',
      providerKey: 'claude',
      modelId: 'claude-sonnet-4-6',
      status: 'safe',
      allowedScope: '品質チェック・境界監査・最終レビュー',
      targetFiles: ['docs/**', 'smoke/**'],
      expectedSmoke: ['npm run verify'],
      sanitizedTaskPack: { taskTitle: 'Quality audit', taskSummary: 'Review implementation quality and security boundaries', safetyNotes: '' },
    },
    {
      agentKey: 'grok',
      agent: 'Grok',
      role: '穴探し・反対意見・リスクレビュー',
      providerKey: 'grok',
      modelId: 'grok',
      status: 'safe',
      allowedScope: '穴探し・反対意見・リスクレビュー',
      targetFiles: ['docs/**'],
      expectedSmoke: [],
      sanitizedTaskPack: { taskTitle: 'Risk review', taskSummary: 'Identify gaps and counter-arguments', safetyNotes: '' },
    },
    {
      agentKey: 'gemini',
      agent: 'Gemini',
      role: 'Google / IAM / Cloud Run / 環境確認',
      providerKey: 'gemini',
      modelId: 'gemini-2.5-flash-lite',
      status: 'safe',
      allowedScope: 'Google / Cloud / 検索整理 / 環境確認',
      targetFiles: ['tools/**'],
      expectedSmoke: ['npm run verify'],
      sanitizedTaskPack: { taskTitle: 'Cloud config review', taskSummary: 'Review GCP configuration and environment setup', safetyNotes: '' },
    },
  ];
}

// ── CLI display ──────────────────────────────────────────────────────────────

function printExporter(result) {
  const statusColor = result.status === 'safe' ? 'green'
    : result.status === 'caution' ? 'yellow'
    : result.status === 'blocked' ? 'red'
    : 'magenta';
  const statusIcon = result.status === 'safe' ? '✓'
    : result.status === 'caution' ? '⚠'
    : result.status === 'blocked' ? '✗'
    : '⛔';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME Work Order Prompt Exporter'))}  ${c('cyan', `v${result.version}`)}  ${c('gray', `(${result.timestamp})`)}`);
  console.log(`  ${c('bold', 'Work Orders:')} ${result.workOrderCount}  |  ${c('bold', 'Prompt Packs:')} ${result.promptPackCount}  |  ${c('bold', 'Status:')} ${c(statusColor, `${statusIcon} ${result.status.toUpperCase()}`)}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  if (result.blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const br of result.blockedReasons) console.log(`    ${c('red', '✗')} ${br}`);
  }

  if (result.cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const ca of result.cautions) console.log(`    ${c('yellow', '⚠')} ${ca}`);
  }

  if (result.humanGateItems.length > 0) {
    console.log(`\n  ${c('bold', c('magenta', 'HUMAN GATE'))}`);
    for (const hg of result.humanGateItems) console.log(`    ${c('magenta', '⛔')} ${hg.agent}: ${hg.reason}`);
  }

  console.log(`\n  ${c('bold', 'Prompt Packs')}`);
  for (const pp of result.promptPacks) {
    const icon = pp.targetAgent === 'gpt_codex' ? 'P' : pp.targetAgent === 'deepseek_opencode' ? 'D' : pp.targetAgent === 'claude' ? 'C' : pp.targetAgent === 'grok' ? 'X' : 'G';
    console.log(`    ${c('bold', icon)} ${c('cyan', pp.targetAgent)} — ${c('dim', pp.intendedRole)}`);
    console.log(`      allowedScope: ${pp.allowedScope}`);
    console.log(`      forbidden: ${pp.forbiddenContext}`);
    const preview = pp.promptText.split('\n').slice(0, 4).join(' ').slice(0, 120);
    console.log(`      prompt: ${c('gray', preview)}...`);
    console.log(`      safetyNotes: ${pp.safetyNotes}`);
    console.log('');
  }

  console.log(`  ${c('bold', c('blue', '╡ End of Prompt Exporter'))} ${c('gray', `${result.promptPackCount} packs`)}`);
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  return {
    json: args.includes('--json'),
    demo: args.includes('--demo'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const workOrders = cliArgs.demo ? createDemoWorkOrders() : [];
  const result = buildPromptExporter(workOrders);
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printExporter(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  buildPromptExporter,
  createDemoWorkOrders,
  printExporter,
};
