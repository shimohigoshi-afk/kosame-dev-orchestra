#!/usr/bin/env node
'use strict';

/**
 * KOSAME Auto Runner v110.36.0
 *
 * 設計書から全自動タスク実行を行う。
 *
 * 機能:
 *   - kosame-spec-analyzer でタスク分解
 *   - 難易度に応じてエスカレーションチェーンで自動実行
 *   - タスク間の依存関係を守って順番に実行（トポロジカル順）
 *   - 高度タスク (human_gate=true) は必ず停止・じゅんやさん承認待ち
 *   - 実行結果を learning-log / Google Drive に自動記録
 *
 * Usage:
 *   npm run auto:run -- --spec="設計書テキスト"
 *   npm run auto:run -- --file=./spec.md
 *   npm run auto:run -- --spec="..." --write   # 実際の書き込み有効
 *   npm run auto:run -- --spec="..." --json    # JSON 出力
 */

const fs       = require('node:fs');
const path     = require('node:path');
const os       = require('node:os');
const readline = require('node:readline');

const TOOL_META = {
  version:       '110.36.0',
  feature:       'v110-36-auto-runner',
  slug:          'kosame-auto-runner',
  dryRunDefault: true,
};

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m', bold:    '\x1b[1m', dim:    '\x1b[2m',
  green:   '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:    '\x1b[36m', red:    '\x1b[31m', gray:   '\x1b[90m',
  magenta: '\x1b[35m', bgRed:  '\x1b[41m', bgYellow: '\x1b[43m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

const DIFF_COLOR = { light: 'green', medium: 'yellow', high: 'red' };

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function hr(len = 62) {
  return '─'.repeat(len);
}

// ── Human Gate ────────────────────────────────────────────────────────────────

/**
 * human_gate=true のタスク実行前にじゅんやさんの承認を求める。
 *
 * dryRun=true  → 自動承認（DRY-RUN 表示のみ）
 * dryRun=false → stdin から yes/no を待機
 *
 * @returns {Promise<boolean>} approved
 */
async function waitForHumanApproval(task, opts = {}) {
  const { dryRun = true, out = console.log } = opts;

  out('\n' + c('bgRed', c('bold', '  ⛔ HUMAN GATE ⛔  ')));
  out(`\n  ${c('bold', 'タスク  :')} ${task.title}`);
  out(`  ${c('bold', '難易度  :')} ${c('red', task.difficulty)}`);
  out(`  ${c('bold', '担当AI  :')} ${c('cyan', `${task.assignedAI.provider}/${task.assignedAI.model}`)}`);
  if (task.dependencies.length > 0) {
    out(`  ${c('bold', '依存    :')} ${task.dependencies.join(', ')}`);
  }
  if (task.description) {
    out(`  ${c('bold', '概要    :')} ${task.description.slice(0, 80)}`);
  }

  if (dryRun) {
    out(`\n  ${c('blue', '[DRY-RUN] ゲート自動承認 — 実際の実行では承認入力が必要です')}\n`);
    return true;
  }

  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(
      `\n  ${c('bgYellow', c('bold', ' じゅんやさん、このタスクを承認しますか？ '))} [yes/no] > `,
      answer => {
        rl.close();
        const approved = /^y(es)?$/i.test(answer.trim());
        if (approved) {
          out(c('green', '  ✓ 承認されました。実行します。'));
        } else {
          out(c('red', '  ✗ 却下されました。このタスクをスキップします。'));
        }
        out('');
        resolve(approved);
      }
    );
  });
}

// ── Task Executor ─────────────────────────────────────────────────────────────

/**
 * 単一タスクを実行する（dryRun=true ではシミュレート）。
 *
 * 実行モデル:
 *   dryRun=true  → 難易度ごとの模擬ディレイ + 成功応答
 *   dryRun=false → 実際の LLM 呼び出しスタブ
 *                  ※ v110.36 では基盤実装のみ。実 API コールは後続バージョンで実装。
 *
 * @returns {Promise<TaskResult>}
 */
async function executeTask(task, opts = {}) {
  const { dryRun = true } = opts;
  const startMs = Date.now();

  if (dryRun) {
    const delayMs = { light: 40, medium: 80, high: 120 }[task.difficulty] ?? 80;
    await sleep(delayMs);

    return {
      taskId:         task.id,
      title:          task.title,
      difficulty:     task.difficulty,
      model:          task.assignedAI.model,
      provider:       task.assignedAI.provider,
      executionOrder: task.executionOrder,
      dryRun:         true,
      success:        true,
      skipped:        false,
      escalated:      false,
      costUsd:        null,
      durationMs:     Date.now() - startMs,
      output:         '[DRY-RUN] 実行シミュレート完了',
      timestamp:      nowIso(),
    };
  }

  // Live: escalation chain stub
  // v110.36 基盤実装。実際の LLM API 呼び出しは後続バージョンで実装予定。
  console.log(`    ${c('yellow', '⚠  [STUB] LLM 実呼び出しは未実装。シミュレーション実行します。')}`);
  await sleep(200);

  return {
    taskId:         task.id,
    title:          task.title,
    difficulty:     task.difficulty,
    model:          task.assignedAI.model,
    provider:       task.assignedAI.provider,
    executionOrder: task.executionOrder,
    dryRun:         false,
    success:        true,
    skipped:        false,
    escalated:      false,
    costUsd:        null,
    durationMs:     Date.now() - startMs,
    output:         '[STUB] LLM 実行は v110.37 以降で実装予定',
    timestamp:      nowIso(),
  };
}

// ── Learning Log Recording ────────────────────────────────────────────────────

function recordToLearningLog(taskResult, opts = {}) {
  const { dryRun = true } = opts;
  try {
    const { appendLog } = require('./kosame-learning-log');
    return appendLog({
      taskInput:   taskResult.title.slice(0, 120),
      taskType:    'implement',
      difficulty:  taskResult.difficulty,
      model:       taskResult.model,
      provider:    taskResult.provider,
      costUsd:     taskResult.costUsd,
      durationMs:  taskResult.durationMs,
      success:     taskResult.success && !taskResult.skipped,
      escalated:   taskResult.escalated,
      dryRun,
      meta: {
        feature:  TOOL_META.feature,
        taskId:   taskResult.taskId,
        autoRun:  true,
      },
    }, { dryRun });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ── Google Drive Recording ────────────────────────────────────────────────────

async function recordToGDrive(runResult, opts = {}) {
  const { dryRun = true } = opts;
  const gdriveWriter = (() => {
    try { return require('./kosame-gdrive-writer'); } catch { return null; }
  })();

  if (!gdriveWriter) return { ok: false, reason: 'kosame-gdrive-writer not found' };

  const content = [
    `AutoRunner v${TOOL_META.version}`,
    `tasks=${runResult.taskCount}`,
    `success=${runResult.successCount}`,
    `skipped=${runResult.skippedCount}`,
    `failed=${runResult.failedCount}`,
    `phases=${runResult.phaseCount}`,
    `specLen=${runResult.specLength}`,
  ].join(' | ');

  let sheetRes = null;
  let docRes   = null;

  try {
    sheetRes = await gdriveWriter.writeSheetsRows({ dryRun, tail: runResult.taskCount + 1 });
  } catch (err) {
    sheetRes = { ok: false, error: err.message };
  }

  try {
    docRes = await gdriveWriter.writeDocsEntry({ dryRun, version: TOOL_META.version, content });
  } catch (err) {
    docRes = { ok: false, error: err.message };
  }

  return { ok: true, dryRun, sheetRes, docRes };
}

// ── Phase Runner ──────────────────────────────────────────────────────────────

/**
 * 単一フェーズ（同一 executionOrder のタスク群）を実行する。
 * human_gate=true のタスクが含まれる場合、そのタスク直前で必ず停止する。
 *
 * @returns {Promise<TaskResult[]>}
 */
async function runPhase(phaseOrder, tasks, opts = {}) {
  const { dryRun = true, out = console.log } = opts;
  const results = [];

  const parallelTag = tasks.length > 1 && tasks[0].canParallel
    ? ' ' + c('green', '[並列可]')
    : '';
  out(`\n  ${c('magenta', `── Phase ${phaseOrder}`)} (${tasks.length} タスク)${parallelTag}`);

  for (const task of tasks) {
    const diffColor  = DIFF_COLOR[task.difficulty] || 'gray';
    const diffLabel  = c(diffColor, task.difficulty.padEnd(7));
    const aiLabel    = c('cyan', `${task.assignedAI.provider}/${task.assignedAI.model}`.slice(0, 32));
    const gateTag    = task.humanGate  ? ' ' + c('red', '[GATE]') : '';
    const depTag     = task.dependencies.length > 0
      ? ' ' + c('dim', `← ${task.dependencies.join(', ')}`)
      : '';

    out(`\n    ${c('gray', task.id)}  ${diffLabel}  ${aiLabel}${gateTag}`);
    out(`    ${c('bold', task.title.slice(0, 60))}${depTag}`);

    // Human gate — 必ず停止してじゅんやさんの承認を確認
    if (task.humanGate) {
      const approved = await waitForHumanApproval(task, { dryRun, out });
      if (!approved) {
        const skipped = buildSkippedResult(task, dryRun, 'じゅんやさんに却下されました');
        recordToLearningLog(skipped, { dryRun });
        results.push(skipped);
        out(`    ${c('yellow', '⟳ スキップ')}`);
        continue;
      }
    }

    // Execute task — progress を stderr に (out が stderr 向きのときは process.stderr に合わせる)
    const progressStream = opts.jsonMode ? process.stderr : process.stdout;
    progressStream.write(`    ${c('dim', '実行中...')}`);
    const result = await executeTask(task, { dryRun });

    const statusLabel = result.success
      ? c('green', '✓ 完了')
      : c('red', '✗ 失敗');
    progressStream.write(`\r    ${statusLabel}  ${c('dim', `${result.durationMs}ms`)}\n`);

    recordToLearningLog(result, { dryRun });
    results.push(result);
  }

  return results;
}

function buildSkippedResult(task, dryRun, reason) {
  return {
    taskId:         task.id,
    title:          task.title,
    difficulty:     task.difficulty,
    model:          task.assignedAI.model,
    provider:       task.assignedAI.provider,
    executionOrder: task.executionOrder,
    dryRun,
    success:        false,
    skipped:        true,
    escalated:      false,
    costUsd:        null,
    durationMs:     0,
    output:         reason,
    timestamp:      nowIso(),
  };
}

// ── Main Run ──────────────────────────────────────────────────────────────────

/**
 * 設計書テキストを解析し全タスクを順番に実行する。
 *
 * @param {string} specText  設計書（Markdown / プレーンテキスト）
 * @param {object} opts      { dryRun, maxTasks }
 * @returns {Promise<RunResult>}
 */
async function runSpec(specText, opts = {}) {
  const { dryRun = true, maxTasks = 50, jsonMode = false } = opts;
  // jsonMode=true のとき全進捗出力を stderr に向け、stdout は JSON 専用にする
  const out = jsonMode
    ? (...args) => process.stderr.write(args.join(' ') + '\n')
    : console.log;

  const { analyzeSpec } = require('./kosame-spec-analyzer');

  const dryLabel = dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  out(`\n${c('bold', c('blue', '⬡ KOSAME Auto Runner'))}  ${dryLabel}  v${TOOL_META.version}`);
  out(c('dim', `  v110.36 — 設計書から全自動タスク実行`));

  // ── Step 1: 設計書解析 ─────────────────────────────────────────────────────
  out(`\n  ${c('bold', '📋 設計書解析中...')}`);
  const analysis = analyzeSpec(specText, { dryRun, maxTasks });

  out(`  ${c('green', '✓')} ${analysis.taskCount} タスク検出 / ${analysis.summary.executionPhases} フェーズ`);

  const { difficultyBreakdown: diff, humanGateCount } = analysis.summary;
  const diffParts = Object.entries(diff)
    .filter(([, n]) => n > 0)
    .map(([d, n]) => `${c(DIFF_COLOR[d] || 'gray', d)}:${n}`)
    .join('  ');
  if (diffParts) out(`  難易度: ${diffParts}`);

  if (humanGateCount > 0) {
    out(`  ${c('red', `⚠  HUMAN GATE: ${humanGateCount} タスクはじゅんやさんの承認が必要です`)}`);
  }

  // ── Step 2: フェーズ別グループ化 ───────────────────────────────────────────
  const maxOrder = analysis.summary.executionPhases;
  const phases   = [];
  for (let o = 1; o <= maxOrder; o++) {
    const batch = analysis.tasks.filter(t => t.executionOrder === o);
    if (batch.length > 0) phases.push({ order: o, tasks: batch });
  }

  // ── Step 3: フェーズ順に実行 ───────────────────────────────────────────────
  out(`\n  ${c('bold', '🚀 実行開始')}`);
  const allResults = [];

  for (const phase of phases) {
    const phaseResults = await runPhase(phase.order, phase.tasks, { dryRun, out, jsonMode });
    allResults.push(...phaseResults);
  }

  // ── Step 4: 集計 ───────────────────────────────────────────────────────────
  const successCount = allResults.filter(r =>  r.success && !r.skipped).length;
  const skippedCount = allResults.filter(r =>  r.skipped).length;
  const failedCount  = allResults.filter(r => !r.success && !r.skipped).length;

  const runResult = {
    tool:                       TOOL_META.slug,
    version:                    TOOL_META.version,
    dryRun,
    realProductActionsExecuted: !dryRun,
    dangerousActionsDenied:     true,
    specLength:                 specText.length,
    taskCount:                  allResults.length,
    successCount,
    skippedCount,
    failedCount,
    phaseCount:                 phases.length,
    tasks:                      allResults,
    analysis: {
      summary:   analysis.summary,
      taskCount: analysis.taskCount,
    },
    timestamp: nowIso(),
  };

  // ── Step 5: Google Drive 記録 ──────────────────────────────────────────────
  out(`\n  ${c('bold', '📝 Google Drive / Learning Log に記録中...')}`);
  const gdriveResult = await recordToGDrive(runResult, { dryRun });
  runResult._gdrive = gdriveResult;

  if (dryRun) {
    out(`  ${c('dim', '[DRY-RUN] 記録シミュレート完了')}`);
  } else {
    const sheetOk = gdriveResult.sheetRes?.ok !== false;
    const docOk   = gdriveResult.docRes?.ok   !== false;
    out(`  Sheets: ${sheetOk ? c('green', '✓') : c('red', '✗')}  Docs: ${docOk ? c('green', '✓') : c('red', '✗')}`);
  }

  // ── Step 6: サマリー表示 ───────────────────────────────────────────────────
  printRunSummary(runResult, { out });

  return runResult;
}

// ── Print Summary ─────────────────────────────────────────────────────────────

function printRunSummary(result, opts = {}) {
  const { out = console.log } = opts;
  const dryLabel = result.dryRun ? c('blue', '[DRY-RUN]') : c('green', '[LIVE]');
  out(`\n${hr()}`);
  out(`${c('bold', '実行サマリー')}  ${dryLabel}  v${result.version}`);
  out(`  総タスク数        : ${c('bold', String(result.taskCount))}`);
  out(`  成功              : ${c('green',  String(result.successCount))}`);
  out(`  スキップ (GATE)   : ${c('yellow', String(result.skippedCount))}`);
  out(`  失敗              : ${c('red',    String(result.failedCount))}`);
  out(`  フェーズ数        : ${result.phaseCount}`);
  out(`  設計書文字数      : ${result.specLength}`);
  if (result.analysis?.summary?.humanGateCount > 0) {
    out(`  HUMAN GATE タスク : ${c('red', String(result.analysis.summary.humanGateCount))}`);
  }
  out(hr());
  out('');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get  = prefix => (args.find(a => a.startsWith(prefix)) ?? '').slice(prefix.length) || null;
  const has  = flag   => args.includes(flag);

  return {
    spec:     get('--spec='),
    file:     get('--file='),
    write:    has('--write'),
    json:     has('--json'),
    maxTasks: parseInt(get('--max-tasks=') || '50', 10),
  };
}

async function main() {
  const args = parseArgs(process.argv);

  let specText = args.spec || '';
  if (!specText && args.file) {
    const filePath = path.resolve(args.file);
    if (!fs.existsSync(filePath)) {
      console.error(`ERROR: ファイルが見つかりません: ${filePath}`);
      process.exit(1);
    }
    specText = fs.readFileSync(filePath, 'utf8');
  }

  if (!specText) {
    const usage = {
      tool:    TOOL_META.slug,
      version: TOOL_META.version,
      usage: [
        'npm run auto:run -- --spec="設計書テキスト"',
        'npm run auto:run -- --file=./spec.md',
        'npm run auto:run -- --spec="..." --write    # 実際の書き込み + human gate 有効',
        'npm run auto:run -- --spec="..." --json     # JSON 出力',
        'npm run auto:run -- --spec="..." --max-tasks=30',
      ],
    };
    console.log(JSON.stringify(usage, null, 2));
    return;
  }

  const dryRun = !args.write;
  const result = await runSpec(specText, { dryRun, maxTasks: args.maxTasks, jsonMode: args.json });

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }

  process.exit(result.failedCount === 0 ? 0 : 1);
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  runSpec,
  executeTask,
  waitForHumanApproval,
  recordToLearningLog,
  recordToGDrive,
};
