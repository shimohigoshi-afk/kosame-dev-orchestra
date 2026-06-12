#!/usr/bin/env node
'use strict';

/**
 * KOSAME Natural Request Pipeline Runner v110.72.0
 *
 * 自然文の --request を受け取り、v110.69 Agent Work Order Auto Splitter と
 * v110.71 Work Order Prompt Exporter をつないで、
 * 1行依頼から AI別 prompt pack まで一括生成するCLI。
 *
 * 【制約】
 *   - 実AI送信はしない。プロンプト文面の生成のみ。
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *
 * Usage:
 *   node tools/kosame-natural-request-pipeline-runner.js --request="fix typo in readme"
 *   node tools/kosame-natural-request-pipeline-runner.js --request="..." --json
 *   npm run natural:request -- --request="add smoke test for new module"
 */

const workOrderSplitter = require('./kosame-agent-work-order-auto-splitter');
const promptExporter    = require('./kosame-work-order-prompt-exporter');

const TOOL_META = {
  version:       '110.72.0',
  feature:       'v110-72-natural-request-pipeline-runner',
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

// ── Pipeline runner ───────────────────────────────────────────────────────────

function runPipeline(request = {}) {
  const userRequest = String(request.userRequest || request.request || '').trim();
  const targetRepo  = request.targetRepo || 'kosame-dev-orchestra';
  const targetVersion = request.targetVersion || '110.72';
  const riskLevel   = request.riskLevel || 'medium';
  const preferredAgents = request.preferredAgents || [];
  const forbiddenAgents = request.forbiddenAgents || [];

  if (!userRequest) {
    return {
      tool:       TOOL_META.slug,
      version:    TOOL_META.version,
      timestamp:  new Date().toISOString(),
      dryRun:     true,
      status:     STATUS.blocked,
      request:    '',
      error:      'No request provided. Use --request="your request text"',
      workOrders: [],
      promptPacks: [],
      blockedReasons: ['No request provided'],
      cautions:   [],
      nextAllowedAction: 'provide_a_request_and_rerun',
      humanApprovalRequired: false,
      summaryForDashboard: { status: STATUS.blocked, workOrderCount: 0, promptPackCount: 0, nextAllowedAction: 'provide_request' },
    };
  }

  // Step 1: Split request into work orders
  const splitResult = workOrderSplitter.buildAgentWorkOrderAutoSplit({
    userRequest,
    requestedOutcome: userRequest,
    targetRepo,
    targetVersion,
    riskLevel,
    preferredAgents,
    forbiddenAgents,
  });

  const workOrders = splitResult.workOrders || [];

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
    tool:       TOOL_META.slug,
    version:    TOOL_META.version,
    timestamp:  new Date().toISOString(),
    dryRun:     true,
    status,
    request:    userRequest,
    targetRepo,
    targetVersion,
    riskLevel,
    workOrderCount: workOrders.length,
    promptPackCount: exportResult.promptPackCount || exportResult.promptPacks?.length || 0,
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
  console.log(`  ${c('bold', 'Request:')} ${c('cyan', result.request.slice(0, 120))}`);
  console.log(`  ${c('bold', 'Status:')} ${c(statusColor, `${statusIcon} ${result.status.toUpperCase()}`)}  |  ${c('bold', 'Work Orders:')} ${result.workOrderCount}  |  ${c('bold', 'Prompt Packs:')} ${result.promptPackCount}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  // Work orders
  console.log(`\n  ${c('bold', 'Work Orders')}`);
  for (const wo of result.workOrders) {
    const woColor = wo.status === 'safe' ? 'green' : wo.status === 'caution' ? 'yellow' : wo.status === 'blocked' ? 'red' : 'magenta';
    const woIcon = wo.status === 'safe' ? '✓' : wo.status === 'caution' ? '⚠' : wo.status === 'blocked' ? '✗' : '⛔';
    console.log(`    ${c(woColor, woIcon)} ${c('bold', wo.agent)} — ${c(woColor, wo.status.toUpperCase())}  ${c('gray', `(${wo.role})`)}`);
    console.log(`      model: ${wo.modelId}  files: ${(wo.targetFiles || []).join(', ') || '-'}`);
  }

  // Prompt packs
  console.log(`\n  ${c('bold', 'Prompt Packs')}`);
  for (const pp of result.promptPacks) {
    const icon = pp.targetAgent === 'gpt_codex' ? 'P' : pp.targetAgent === 'deepseek_opencode' ? 'D' : pp.targetAgent === 'claude' ? 'C' : pp.targetAgent === 'grok' ? 'X' : 'G';
    console.log(`    ${c('bold', icon)} ${c('cyan', pp.targetAgent)} — ${c('dim', pp.intendedRole)}`);
    console.log(`      scope: ${pp.allowedScope}  forbidden: ${pp.forbiddenContext}`);
    const preview = pp.promptText.split('\n').slice(0, 3).join(' ').slice(0, 100);
    console.log(`      prompt: ${c('gray', preview)}...`);
  }

  // Issues
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
    for (const hg of result.humanGateItems) console.log(`    ${c('magenta', '⛔')} ${hg.agent || hg.label}: ${hg.reason}`);
  }

  console.log(`\n  ${c('bold', c('blue', '╡ End of Pipeline'))} ${c('gray', `${result.workOrderCount} orders, ${result.promptPackCount} packs`)}`);
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => { const p = `--${name}=`; const a = args.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  return {
    request:       get('request'),
    targetRepo:    get('target-repo') || 'kosame-dev-orchestra',
    targetVersion: get('target-version') || '110.72',
    riskLevel:     get('risk-level') || 'medium',
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
  runPipeline,
  printPipeline,
};
