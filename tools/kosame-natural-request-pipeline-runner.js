#!/usr/bin/env node
'use strict';

/**
 * KOSAME Natural Request Pipeline Runner v110.73.0
 *
 * 自然文の --request を受け取り、v110.69 Agent Work Order Auto Splitter と
 * v110.71 Work Order Prompt Exporter をつないで、
 * 1行依頼から AI別 prompt pack まで一括生成するCLI。
 *
 * v110.73: content_factory モード追加。YouTube/動画/台本/HP/LP/SEO等の
 * コンテンツ制作系リクエストを検出し、5役(GPT/DeepSeek/Claude/Grok/Gemini)
 * を自動展開する。
 *
 * 【制約】
 *   - 実AI送信はしない。プロンプト文面の生成のみ。
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *
 * Usage:
 *   node tools/kosame-natural-request-pipeline-runner.js --request="fix typo in readme"
 *   node tools/kosame-natural-request-pipeline-runner.js --request="..." --mode=content_factory --json
 *   npm run natural:request -- --request="..." --mode content_factory
 */

const workOrderSplitter = require('./kosame-agent-work-order-auto-splitter');
const promptExporter    = require('./kosame-work-order-prompt-exporter');

const TOOL_META = {
  version:       '110.73.0',
  feature:       'v110-73-content-factory-multi-agent-mode',
  slug:          'kosame-natural-request-pipeline-runner',
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

// ── Content factory detection ─────────────────────────────────────────────────

const CONTENT_FACTORY_KEYWORDS = [
  'youtube', 'ゆっくり', '動画', 'video', '台本', 'script',
  'サムネ', 'thumbnail', '企画', '構成', 'コンテンツ', 'content',
  'ホームページ', 'website', 'ランディング', 'lp制作', 'hp制作',
  'seo', '記事', 'article', 'ブログ', 'blog',
  'sns', 'twitter', 'instagram', 'tiktok',
  '制作', 'creation', 'production', '編集', 'edit',
  '撮影', 'shooting', 'recording', 'ナレーション', 'narration',
  'banner', 'バナー', '広告', 'advertisement',
  'mail', 'メール', 'email', 'newsletter',
  'vlog', 'podcast', 'ポッドキャスト',
];

const ALL_AGENTS = ['gpt_codex', 'deepseek_opencode', 'claude', 'grok', 'gemini'];

function detectContentFactory(request, mode) {
  if (mode === 'content_factory') return true;
  const text = String(request || '').toLowerCase();
  return CONTENT_FACTORY_KEYWORDS.some(kw => {
    if (/[\u3000-\u9fff]/.test(kw)) return text.includes(kw);
    const re = new RegExp('\\b' + kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i');
    return re.test(text);
  });
}

// ── Content factory work order builder ─────────────────────────────────────────

function buildContentFactoryWorkOrders(request) {
  const userRequest = String(request.userRequest || request.request || '').trim();
  const targetRepo  = request.targetRepo || 'kosame-dev-orchestra';
  const targetVersion = request.targetVersion || '110.73';
  const riskLevel   = request.riskLevel || 'medium';
  const synthTask = {
    id:          `cf-${Date.now()}`,
    title:       `content factory: ${userRequest.slice(0, 100)}`,
    description: userRequest.slice(0, 500),
    difficulty:  riskLevel === 'high' ? 'high' : 'medium',
  };

  const AGENT_CONFIGS = [
    {
      agentKey: 'gpt_codex',
      role: '企画・構成・台本・設計整理',
      modelId: 'gpt-5.4-mini',
      allowedScope: '企画・構成・台本作成・設計整理',
      targetFiles: ['tools/**', 'smoke/**', 'docs/**'],
      expectedSmoke: ['npm run verify'],
    },
    {
      agentKey: 'deepseek_opencode',
      role: 'sanitized_only 低機密テンプレ作成',
      modelId: 'deepseek-chat',
      allowedScope: 'sanitized_only low-sensitivity template creation',
      targetFiles: ['smoke/**', 'docs/**'],
      expectedSmoke: ['npm run verify'],
    },
    {
      agentKey: 'claude',
      role: '品質チェック・境界監査・表現チェック・コンプラ確認',
      modelId: 'claude-sonnet-4-6',
      allowedScope: '品質チェック・境界監査・最終レビュー',
      targetFiles: ['docs/**', 'smoke/**'],
      expectedSmoke: ['npm run verify'],
    },
    {
      agentKey: 'grok',
      role: '穴探し・反対意見・炎上リスク・弱点レビュー',
      modelId: 'grok',
      allowedScope: '穴探し・反対意見・リスクレビュー',
      targetFiles: ['docs/**'],
      expectedSmoke: [],
    },
    {
      agentKey: 'gemini',
      role: 'Google / Cloud / 検索整理 / リサーチ観点 / 環境確認',
      modelId: 'gemini-2.5-flash-lite',
      allowedScope: 'Google / Cloud / 検索整理 / 環境確認',
      targetFiles: ['tools/**', 'fixtures/**'],
      expectedSmoke: ['npm run verify'],
    },
  ];

  const workOrders = AGENT_CONFIGS.map(cfg => ({
    agentKey: cfg.agentKey,
    agent: cfg.agentKey === 'gpt_codex' ? 'GPT / Codex'
         : cfg.agentKey === 'deepseek_opencode' ? 'DeepSeek / opencode'
         : cfg.agentKey === 'claude' ? 'Claude'
         : cfg.agentKey === 'grok' ? 'Grok'
         : 'Gemini',
    role: cfg.role,
    provider: cfg.agentKey === 'gpt_codex' ? 'GPT / Codex'
            : cfg.agentKey === 'deepseek_opencode' ? 'DeepSeek / opencode'
            : cfg.agentKey === 'claude' ? 'Claude'
            : cfg.agentKey === 'grok' ? 'Grok'
            : 'Gemini',
    providerKey: cfg.agentKey === 'gpt_codex' ? 'gpt_codex'
               : cfg.agentKey === 'deepseek_opencode' ? 'deepseek_opencode'
               : cfg.agentKey === 'claude' ? 'claude'
               : cfg.agentKey === 'grok' ? 'grok'
               : 'gemini',
    modelId: cfg.modelId,
    status: 'safe',
    allowedScope: cfg.allowedScope,
    forbiddenScope: 'Secret/customer/salesDX/ANESTY/commit/push/deploy',
    targetFiles: cfg.targetFiles,
    expectedSmoke: cfg.expectedSmoke,
    sanitizedTaskPack: {
      taskId: `cf-${cfg.agentKey}-${Date.now()}`,
      taskTitle: `Content factory: ${userRequest.slice(0, 100)}`,
      taskSummary: `[${cfg.role}] ${userRequest.slice(0, 300)}`,
      allowedWorkerClass: cfg.agentKey === 'deepseek_opencode' ? 'sanitized_only' : 'standard',
      safetyNotes: cfg.agentKey === 'deepseek_opencode' ? 'sanitized_only. No real data access.' : '',
    },
  }));

  const status = workOrders.some(w => w.status === 'human_gate') ? STATUS.human_gate
    : workOrders.some(w => w.status === 'blocked') ? STATUS.blocked
    : workOrders.some(w => w.status === 'caution') ? STATUS.caution
    : STATUS.safe;

  return { workOrders, status };
}

// ── Pipeline runner ───────────────────────────────────────────────────────────

function runPipeline(request = {}) {
  const userRequest = String(request.userRequest || request.request || '').trim();
  const targetRepo  = request.targetRepo || 'kosame-dev-orchestra';
  const targetVersion = request.targetVersion || '110.73';
  const riskLevel   = request.riskLevel || 'medium';
  const mode = request.mode || '';

  if (!userRequest) {
    return {
      tool:       TOOL_META.slug,
      version:    TOOL_META.version,
      timestamp:  new Date().toISOString(),
      dryRun:     true,
      status:     STATUS.blocked,
      request:    '',
      mode:       mode || 'standard',
      workOrders: [],
      promptPacks: [],
      blockedReasons: ['No request provided. Use --request="your request text" or --request "your request text"'],
      cautions:   [],
      humanGateItems: [],
      nextAllowedAction: 'provide_a_request_and_rerun',
      humanApprovalRequired: false,
      workOrderCount: 0,
      promptPackCount: 0,
      summaryForDashboard: { status: STATUS.blocked, workOrderCount: 0, promptPackCount: 0, nextAllowedAction: 'provide_request' },
    };
  }

  const isContentFactory = detectContentFactory(userRequest, request.mode);
  let workOrders, splitResult, expandedBy;

  if (isContentFactory) {
    const cfResult = buildContentFactoryWorkOrders({
      userRequest, targetRepo, targetVersion, riskLevel,
      preferredAgents: ALL_AGENTS,
    });
    workOrders = cfResult.workOrders;
    expandedBy = 'content_factory_multi_agent_mode';
    splitResult = { status: cfResult.status, blockedReasons: [], cautions: [] };
  } else {
    splitResult = workOrderSplitter.buildAgentWorkOrderAutoSplit({
      userRequest,
      requestedOutcome: userRequest,
      targetRepo,
      targetVersion,
      riskLevel,
    });
    workOrders = splitResult.workOrders || [];
    expandedBy = null;
  }

  // Step 2: Generate prompt packs from work orders
  const exportResult = promptExporter.buildPromptExporter(workOrders);

  // Step 3: Compute overall status
  const allBlocked = [
    ...(splitResult.blockedReasons || []),
    ...(exportResult.blockedReasons || []),
  ];
  const allCautions = [
    ...(splitResult.cautions || []),
    ...(exportResult.cautions || []),
  ];
  const hasHumanGate = splitResult.status === STATUS.human_gate || exportResult.status === STATUS.human_gate
    || (splitResult.humanApprovalRequired || exportResult.humanApprovalRequired);
  const hasBlocked = allBlocked.length > 0;
  const hasCaution = allCautions.length > 0;

  let status;
  let nextAllowedAction;

  if (hasHumanGate) {
    status = STATUS.human_gate;
    nextAllowedAction = 'review_and_approve_human_gate_items';
  } else if (hasBlocked) {
    status = STATUS.blocked;
    nextAllowedAction = 'fix_blocked_items_and_rerun';
  } else if (hasCaution) {
    status = STATUS.caution;
    nextAllowedAction = 'review_cautions_then_proceed';
  } else {
    status = STATUS.safe;
    nextAllowedAction = 'prompts_ready_for_dispatch';
  }

  return {
    tool:             TOOL_META.slug,
    version:          TOOL_META.version,
    timestamp:        new Date().toISOString(),
    dryRun:           true,
    status,
    request:          userRequest,
    targetRepo,
    targetVersion,
    riskLevel,
    mode:             isContentFactory ? 'content_factory' : 'standard',
    ...(expandedBy ? { expandedBy } : {}),
    workOrderCount:   workOrders.length,
    promptPackCount:  exportResult.promptPackCount || exportResult.promptPacks?.length || 0,
    workOrders: workOrders.map(w => ({
      agentKey: w.agentKey,
      agent: w.agent,
      role: w.role,
      modelId: w.modelId,
      status: w.status,
      allowedScope: w.allowedScope,
      targetFiles: w.targetFiles || [],
      expectedSmoke: w.expectedSmoke || [],
    })),
    promptPacks: exportResult.promptPacks || [],
    blockedReasons: allBlocked,
    cautions: allCautions,
    humanGateItems: exportResult.humanGateItems || [],
    nextAllowedAction,
    humanApprovalRequired: hasHumanGate,
    summaryForDashboard: {
      status,
      workOrderCount: workOrders.length,
      promptPackCount: exportResult.promptPackCount || exportResult.promptPacks?.length || 0,
      nextAllowedAction,
    },
  };
}

// ── CLI display ──────────────────────────────────────────────────────────────

function printPipeline(result) {
  const statusColor = result.status === 'safe' ? 'green'
    : result.status === 'caution' ? 'yellow'
    : result.status === 'blocked' ? 'red'
    : 'magenta';
  const statusIcon = result.status === 'safe' ? '✓'
    : result.status === 'caution' ? '⚠'
    : result.status === 'blocked' ? '✗'
    : '⛔';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME Natural Request Pipeline Runner'))}  ${c('cyan', `v${result.version}`)}`);
  const reqText = (result.request || '').slice(0, 120);
  console.log(`  ${c('bold', 'Request:')} ${c('cyan', reqText || '(empty)')}`);
  const modeLabel = result.mode === 'content_factory' ? c('yellow', `content_factory${result.expandedBy ? ' (expanded)' : ''}`) : 'standard';
  console.log(`  ${c('bold', 'Mode:')} ${modeLabel}  |  ${c('bold', 'Status:')} ${c(statusColor, `${statusIcon} ${result.status.toUpperCase()}`)}  |  ${c('bold', 'Work Orders:')} ${result.workOrderCount || 0}  |  ${c('bold', 'Prompt Packs:')} ${result.promptPackCount || 0}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  // Work orders
  const workOrders = result.workOrders || [];
  if (workOrders.length > 0) {
    console.log(`\n  ${c('bold', 'Work Orders')}`);
    for (const wo of workOrders) {
      const woColor = wo.status === 'safe' ? 'green' : wo.status === 'caution' ? 'yellow' : wo.status === 'blocked' ? 'red' : 'magenta';
      const woIcon = wo.status === 'safe' ? '✓' : wo.status === 'caution' ? '⚠' : wo.status === 'blocked' ? '✗' : '⛔';
      console.log(`    ${c(woColor, woIcon)} ${c('bold', wo.agent)} — ${c(woColor, wo.status.toUpperCase())}  ${c('gray', `(${wo.role})`)}`);
      console.log(`      model: ${wo.modelId}  files: ${(wo.targetFiles || []).join(', ') || '-'}`);
    }
  }

  // Prompt packs
  const promptPacks = result.promptPacks || [];
  if (promptPacks.length > 0) {
    console.log(`\n  ${c('bold', 'Prompt Packs')}`);
    for (const pp of promptPacks) {
      const icon = pp.targetAgent === 'gpt_codex' ? 'P' : pp.targetAgent === 'deepseek_opencode' ? 'D' : pp.targetAgent === 'claude' ? 'C' : pp.targetAgent === 'grok' ? 'X' : 'G';
      console.log(`    ${c('bold', icon)} ${c('cyan', pp.targetAgent)} — ${c('dim', pp.intendedRole)}`);
      console.log(`      scope: ${pp.allowedScope}  forbidden: ${pp.forbiddenContext}`);
      const preview = (pp.promptText || '').split('\n').slice(0, 3).join(' ').slice(0, 100);
      console.log(`      prompt: ${c('gray', preview)}...`);
    }
  }

  // Issues
  const blockedReasons = result.blockedReasons || [];
  const cautions = result.cautions || [];
  const humanGateItems = result.humanGateItems || [];
  if (blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const br of blockedReasons) console.log(`    ${c('red', '✗')} ${br}`);
  }
  if (cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const ca of cautions) console.log(`    ${c('yellow', '⚠')} ${ca}`);
  }
  if (humanGateItems.length > 0) {
    console.log(`\n  ${c('bold', c('magenta', 'HUMAN GATE'))}`);
    for (const hg of humanGateItems) console.log(`    ${c('magenta', '⛔')} ${hg.agent || hg.label}: ${hg.reason}`);
  }

  console.log(`\n  ${c('bold', c('blue', '╡ End of Pipeline'))} ${c('gray', `${result.workOrderCount} orders, ${result.promptPackCount} packs`)}`);
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => {
    const eq = `--${name}=`;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === eq) return '';
      if (args[i].startsWith(eq)) return args[i].slice(eq.length);
    }
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) {
      return args[idx + 1];
    }
    return null;
  };
  return {
    request:       get('request') || get('req') || '',
    targetRepo:    get('target-repo') || 'kosame-dev-orchestra',
    targetVersion: get('target-version') || '110.73',
    riskLevel:     get('risk-level') || 'medium',
    mode:          get('mode') || '',
    json:          args.includes('--json'),
    dryRun:        !args.includes('--no-dry-run'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = runPipeline({
    request:       cliArgs.request,
    targetRepo:    cliArgs.targetRepo,
    targetVersion: cliArgs.targetVersion,
    riskLevel:     cliArgs.riskLevel,
    mode:          cliArgs.mode,
  });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printPipeline(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  CONTENT_FACTORY_KEYWORDS,
  ALL_AGENTS,
  detectContentFactory,
  buildContentFactoryWorkOrders,
  runPipeline,
  printPipeline,
};
