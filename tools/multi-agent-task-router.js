#!/usr/bin/env node
'use strict';

/**
 * Multi-Agent Task Router v110.31.0
 *
 * GPT が裁定し、Gemini / Claude Code / Grok / DeepSeek にタスクを自動ディスパッチする。
 * v110.28: Google Drive Writer 自動記録オーケストレーション (dryRun) を追加。
 * v110.31: DeepSeek レスポンスの KOSAME Patch Format を deepseek-local-patch-executor に
 *          自動パイプ。dryRunデフォルト / --write は human_gate 必須 / smoke は明示時のみ。
 *
 * Usage:
 *   node tools/multi-agent-task-router.js --input="<task>" [--live] [--yes] [--write] [--smoke=<cmd>]
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const { arbitrate } = require('./gpt-task-arbiter');
const geminiProvider = require('../providers/gemini-provider');
const deepseekProvider = require('../providers/deepseek-provider');
const { classifyDifficulty } = require('./kosame-difficulty-model-router');
const gdriveWriter = require('./kosame-gdrive-writer');
const executor = require('./deepseek-local-patch-executor');

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

// ── Context Enrichment ────────────────────────────────────────────────────────

function enrichContext(subtask, originalInput) {
  const context = {
    originalInput,
    projectContext: {
      productName: 'ANESTY Board',
      targetVersion: 'v110.31.0',
      environment: 'kosame-dev-orchestra',
      realProductActionsExecuted: false,
      dangerousActionsDenied: true,
    },
    task: subtask,
    expectedOutput: 'KOSAME Patch Format: [FILE] <path> followed by ```lang ... ``` code block. NO CHITCHAT. Just the patch.',
    forbiddenActions: [
      'credential exposure',
      'unauthorized file deletion',
      'production deployment',
      'automatic git commit',
    ],
  };
  return JSON.stringify(context, null, 2);
}

// ... detectInsufficientContext, parseArgs, resolveTask stay the same ...

function detectInsufficientContext(response) {
  if (!response) return false;
  const signals = [
    'もう少し情報が必要',
    'どの機能ですか',
    '具体的に教えてください',
    'need more info',
    'which feature',
    'INSUFFICIENT_CONTEXT',
  ];
  return signals.some(s => response.includes(s));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;

  const inputInline = get('--input=');
  const taskFile = get('--task-file=');
  const output = get('--output=');
  const live = args.includes('--live');
  const yes = args.includes('--yes');
  const write = args.includes('--write');

  // --smoke=<cmd> or --smoke <cmd>
  let smoke = get('--smoke=') ?? '';
  if (!smoke && args.includes('--smoke')) {
    const idx = args.indexOf('--smoke');
    smoke = args[idx + 1] ?? '';
  }

  return { inputInline, taskFile, output, live, yes, write, smoke };
}

function resolveTask({ inputInline, taskFile }) {
  if (inputInline) return inputInline;
  if (taskFile) {
    const p = path.resolve(taskFile);
    if (!fs.existsSync(p)) throw new Error(`task-file not found: ${p}`);
    const raw = fs.readFileSync(p, 'utf8');
    try {
      const obj = JSON.parse(raw);
      return obj.input ?? obj.task ?? raw.trim();
    } catch {
      return raw.trim();
    }
  }
  throw new Error('--input="<task>" or --task-file=<path> is required');
}

// ... Dispatchers stay the same ...

async function dispatchToGemini(tasks, live, originalInput) {
  const results = [];
  for (const task of tasks) {
    const enrichedInput = enrichContext(task, originalInput);
    const packet = { id: `gemini-${Date.now()}`, type: 'generate', input: enrichedInput };
    const result = await geminiProvider.run(packet, { live });
    const insufficient = detectInsufficientContext(result.response);
    results.push({ task, result, insufficient });
  }
  return results;
}

async function dispatchToDeepSeek(tasks, live, originalInput) {
  const results = [];
  for (const task of tasks) {
    const enrichedInput = enrichContext(task, originalInput);
    const packet = { id: `deepseek-${Date.now()}`, type: 'generate', input: enrichedInput };
    const result = await deepseekProvider.run(packet, { live });
    const insufficient = detectInsufficientContext(result.response);
    results.push({ task, result, insufficient });
  }
  return results;
}

function dispatchToClaudeCode(tasks, dryRun, originalInput) {
  const results = [];
  for (const task of tasks) {
    const enrichedInput = enrichContext(task, originalInput);
    if (dryRun) {
      results.push({
        task,
        result: { dryRun: true, provider: 'claude-code', planned: `claude -p "${enrichedInput.slice(0, 100)}..."` },
      });
      continue;
    }
    try {
      const out = execFileSync('claude', ['-p', enrichedInput], {
        encoding: 'utf8',
        timeout: 60000,
      });
      const insufficient = detectInsufficientContext(out);
      results.push({ task, result: { success: true, provider: 'claude-code', response: out.trim() }, insufficient });
    } catch (err) {
      results.push({
        task,
        result: { success: false, provider: 'claude-code', error: err.message },
      });
    }
  }
  return results;
}

// ── DeepSeek → Executor Pipeline (v110.31) ────────────────────────────────────

/**
 * DeepSeek レスポンスに含まれる KOSAME Patch Format を executor にパイプする。
 * - dryRun デフォルト (write: false)
 * - write: true の場合は human_gate を明示表示
 * - smoke は opts.smoke が指定され、かつ write かつ ok の場合のみ実行
 * - commit/tag/push/deploy は実行しない (executor 側で保証)
 */
function pipeDeepSeekToExecutor(deepseekResults, opts = {}) {
  const { write = false, smoke = '' } = opts;
  const pipeResults = [];

  for (const { task, result } of deepseekResults) {
    if (!result.response) {
      pipeResults.push({ task, skipped: true, reason: 'no response' });
      continue;
    }

    // KOSAME Patch Format ([FILE] ブロック) が含まれる場合のみパイプ
    let patches;
    try {
      patches = executor.parseKosamePatch(result.response);
    } catch {
      // KOSAME Patch Format なし — 通常テキストレスポンスなのでスキップ
      pipeResults.push({ task, skipped: true, reason: 'no [FILE] patch blocks in response' });
      continue;
    }

    // --write が指定された場合は human_gate を表示
    if (write) {
      console.log('\n[HUMAN GATE] --write が指定されました。ファイル書き込みには人間の承認が必要です。');
      console.log(`  executor : ${executor.TOOL_META.slug} v${executor.TOOL_META.version}`);
      console.log(`  対象ファイル : ${patches.map(p => p.target).join(', ')}`);
    }

    const execResult = executor.applyPatches(patches, { write });

    // smoke は明示指定 + ok + write の場合のみ実行
    if (smoke && execResult.ok && write) {
      execResult.smoke = executor.runSmokeCommand(smoke);
      execResult.ok = execResult.ok && execResult.smoke.ok;
    }

    pipeResults.push({
      task,
      patches: patches.map(p => p.target),
      execResult,
      human_gate: true,
      realGitActionsExecuted: false,
      realDeployActionsExecuted: false,
    });
  }

  return pipeResults;
}

// ── Recording ─────────────────────────────────────────────────────────────────

/**
 * タスク実行結果を Learning Log に記録し、Google Drive Writer (dryRun) を実行する。
 */
async function recordTaskExecution(summary, opts = {}) {
  const { live = false, dryRun = true } = opts;
  const startTime = new Date(summary.dispatchedAt).getTime();
  const durationMs = Date.now() - startTime;

  const classification = classifyDifficulty(summary.task);

  // 使用されたプロバイダーとモデルを収集
  const providers = [];
  const models = [];

  const allResults = [
    ...(summary.gemini ?? []),
    ...(summary.claudeCode ?? []),
    ...(summary.deepseek ?? []),
  ];

  allResults.forEach(r => {
    if (r.result.provider && !providers.includes(r.result.provider)) providers.push(r.result.provider);
    if (r.result.model && !models.includes(r.result.model)) models.push(r.result.model);
    if (r.result.provider === 'claude-code' && !models.includes('claude-sonnet')) models.push('claude-sonnet');
  });

  // executor pipe 結果を集計
  const pipeResults = summary.deepseekPipe ?? [];
  const pipeApplied = pipeResults.filter(r => !r.skipped && r.execResult);
  const pipeOk = pipeApplied.every(r => r.execResult.ok !== false);
  const pipePatches = pipeApplied.flatMap(r => r.patches ?? []);

  const entry = {
    ts:         summary.dispatchedAt,
    taskType:   'multi-agent-route',
    difficulty: classification.difficulty,
    model:      models.join('|'),
    provider:   providers.join('|'),
    costUsd:    0.0,
    durationMs: durationMs,
    success:    allResults.every(r => r.result.success || r.result.dryRun),
    escalated:  summary.routing.method !== 'heuristic',
    dryRun:     dryRun,
    taskInput:  summary.task.slice(0, 200),
    // v110.31: DeepSeek executor pipe 情報
    deepseekPatchCount: pipePatches.length,
    deepseekPatchOk:    pipePatches.length > 0 ? pipeOk : null,
    deepseekPatchWrite: summary.write ?? false,
  };

  // 1. Local Learning Log 追記
  try {
    if (!fs.existsSync(KOSAME_DIR)) fs.mkdirSync(KOSAME_DIR, { recursive: true });
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
    console.log(`\n📝 Local learning log updated: ${classification.difficulty}`);
  } catch (err) {
    console.warn(`\n⚠️ Failed to update local learning log: ${err.message}`);
  }

  // 2. Google Drive Writer (v110.28 以降常に dryRun)
  console.log('\n[Auto-Recording] Orchestrating Google Drive Writer...');
  try {
    const patchSummary = pipePatches.length > 0
      ? ` | DeepSeek patches: ${pipePatches.join(', ').slice(0, 80)}`
      : '';
    const writerOpts = {
      dryRun:    true,
      tail:      1,
      content:   `Multi-agent task: ${summary.task.slice(0, 100)}${patchSummary}`,
      version:   '110.31.0',
    };

    console.log('  → Sheets (dryRun)');
    const sheetRes = await gdriveWriter.writeSheetsRows(writerOpts);
    console.log(`    ok: ${sheetRes.ok} | rows: ${sheetRes.rowCount}`);

    console.log('  → Docs (dryRun)');
    const docRes = await gdriveWriter.writeDocsEntry(writerOpts);
    console.log(`    ok: ${docRes.ok} | preview: ${docRes.textPreview.replace(/\n/g, ' ').slice(0, 60)}...`);

  } catch (err) {
    console.warn(`\n⚠️ Google Drive Writer orchestration failed: ${err.message}`);
  }
}

// ── Plan display ──────────────────────────────────────────────────────────────

function printPlan({ task, routing, dryRun, live, write, smoke }) {
  console.log('\n===== Multi-Agent Task Router v110.31 =====');
  console.log(`INPUT   : ${task.length > 100 ? task.slice(0, 100) + '…' : task}`);
  console.log(`ARBITER : GPT (method=${routing.method})`);
  console.log(`DRY RUN : ${dryRun}`);
  console.log(`LIVE    : ${live}`);
  console.log(`WRITE   : ${write} (human_gate required when true)`);
  console.log(`SMOKE   : ${smoke || '(none)'}`);
  console.log('===========================================\n');

  console.log('[Routing Decision]');
  if (routing.reasoning) console.log(`  reasoning: ${routing.reasoning}`);

  console.log(`\n  → Gemini (${routing.gemini.length} task${routing.gemini.length !== 1 ? 's' : ''})`);
  routing.gemini.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  console.log(`\n  → Claude Code (${routing.claudeCode.length} task${routing.claudeCode.length !== 1 ? 's' : ''})`);
  routing.claudeCode.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  console.log(`\n  → Grok (${routing.grok.length} task${routing.grok.length !== 1 ? 's' : ''})`);
  routing.grok.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  const deepseekTasks = routing.deepseek ?? [];
  console.log(`\n  → DeepSeek (${deepseekTasks.length} task${deepseekTasks.length !== 1 ? 's' : ''})`);
  deepseekTasks.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  if (deepseekTasks.length > 0) {
    console.log(`       executor: deepseek-local-patch-executor v${executor.TOOL_META.version}`);
    console.log(`       KOSAME Patch Format → executor pipe (dryRun: ${!write})`);
  }

  if (dryRun) {
    console.log('\n  ── dry-run: pass --yes to dispatch ──');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(argv) {
  const { inputInline, taskFile, output, live, yes, write, smoke } = parseArgs(argv);
  const dryRun = !yes;

  const task = resolveTask({ inputInline, taskFile });

  // 1. GPT arbitration
  console.log('[1/6] GPT arbitration…');
  const routing = await arbitrate(task, { live });

  // 2. Show plan
  printPlan({ task, routing, dryRun, live, write, smoke });

  if (dryRun) {
    // dryRun でも記録フローを確認できるように recordTaskExecution を呼ぶ
    const summary = {
      dryRun: true,
      write: false,
      task,
      routing,
      gemini: routing.gemini.map(t => ({ task: t, result: { dryRun: true, provider: 'gemini' } })),
      claudeCode: routing.claudeCode.map(t => ({ task: t, result: { dryRun: true, provider: 'claude-code' } })),
      deepseek: (routing.deepseek ?? []).map(t => ({ task: t, result: { dryRun: true, provider: 'deepseek' } })),
      deepseekPipe: (routing.deepseek ?? []).map(t => ({ task: t, skipped: true, reason: 'dryRun' })),
      dispatchedAt: new Date().toISOString(),
    };
    await recordTaskExecution(summary, { live, dryRun });
    return { dryRun: true, routing };
  }

  // 3. Dispatch (--yes)
  console.log('\n[2/6] Gemini dispatch');
  const geminiResults = routing.gemini.length > 0
    ? await dispatchToGemini(routing.gemini, live, task)
    : [];

  geminiResults.forEach(({ task: t, result, insufficient }) => {
    const status = result.dryRun ? '[DRY]' : result.success ? (insufficient ? '[WARN]' : '[OK]') : '[FAIL]';
    console.log(`  ${status} ${t.slice(0, 60)}`);
    if (insufficient) console.log('       ⚠️ INSUFFICIENT CONTEXT DETECTED');
    if (result.response) console.log(`       → ${result.response.slice(0, 120)}`);
    if (result.error) console.log(`       ERROR: ${result.error}`);
  });

  console.log('\n[3/6] Claude Code dispatch');
  const claudeResults = routing.claudeCode.length > 0
    ? dispatchToClaudeCode(routing.claudeCode, dryRun, task)
    : [];

  claudeResults.forEach(({ task: t, result, insufficient }) => {
    const status = result.dryRun ? '[DRY]' : result.success ? (insufficient ? '[WARN]' : '[OK]') : '[FAIL]';
    console.log(`  ${status} ${t.slice(0, 60)}`);
    if (insufficient) console.log('       ⚠️ INSUFFICIENT CONTEXT DETECTED');
    if (result.planned) console.log(`       → ${result.planned}`);
    if (result.response) console.log(`       → ${result.response.slice(0, 120)}`);
    if (result.error) console.log(`       ERROR: ${result.error}`);
  });

  console.log('\n[4/6] DeepSeek dispatch');
  const deepseekTasks = routing.deepseek ?? [];
  const deepseekResults = deepseekTasks.length > 0
    ? await dispatchToDeepSeek(deepseekTasks, live, task)
    : [];

  deepseekResults.forEach(({ task: t, result, insufficient }) => {
    const status = result.dryRun ? '[DRY]' : result.success ? (insufficient ? '[WARN]' : '[OK]') : '[FAIL]';
    console.log(`  ${status} ${t.slice(0, 60)}`);
    if (insufficient) console.log('       ⚠️ INSUFFICIENT CONTEXT DETECTED');
    if (result.response) console.log(`       → ${result.response.slice(0, 120)}`);
    if (result.error) console.log(`       ERROR: ${result.error}`);
  });

  // 5. DeepSeek → Executor pipe (v110.31)
  console.log('\n[5/6] DeepSeek → Executor pipe (KOSAME Patch Format)');
  const deepseekPipe = pipeDeepSeekToExecutor(deepseekResults, { write, smoke });

  deepseekPipe.forEach(r => {
    if (r.skipped) {
      console.log(`  [SKIP] ${String(r.task).slice(0, 60)} — ${r.reason}`);
      return;
    }
    const status = r.execResult.ok ? '[OK]' : '[FAIL]';
    console.log(`  ${status} ${String(r.task).slice(0, 60)}`);
    console.log(`       patches: ${r.patches.join(', ')}`);
    console.log(`       dryRun : ${r.execResult.dryRun}`);
    console.log(`       human_gate: ${r.execResult.human_gate}`);
    if (r.execResult.reason) console.log(`       reason : ${r.execResult.reason}`);
    if (r.execResult.nodeChecks?.length) {
      r.execResult.nodeChecks.forEach(nc =>
        console.log(`       node --check ${nc.target}: ${nc.ok ? 'OK' : 'FAIL'}`)
      );
    }
    if (r.execResult.smoke) {
      const ss = r.execResult.smoke;
      console.log(`       smoke  : ${ss.ok ? 'PASS' : ss.rejected ? 'REJECTED' : 'FAIL'} (${ss.command})`);
    }
  });

  console.log('\n[6/6] Grok bucket (audit only)');
  routing.grok.forEach(t => console.log(`  [AUDIT] ${t.slice(0, 60)}`));

  const summary = {
    dryRun: false,
    write,
    task,
    routing,
    gemini: geminiResults,
    claudeCode: claudeResults,
    deepseek: deepseekResults,
    deepseekPipe,
    dispatchedAt: new Date().toISOString(),
  };

  if (output) {
    fs.writeFileSync(output, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to ${output}`);
  }

  // 4. Auto-recording (v110.28 / v110.31)
  await recordTaskExecution(summary, { live, dryRun });

  console.log('\n✅ dispatch complete');
  return summary;
}

module.exports = {
  run,
  parseArgs,
  resolveTask,
  detectInsufficientContext,
  enrichContext,
  recordTaskExecution,
  pipeDeepSeekToExecutor,
};

if (require.main === module) {
  run(process.argv).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
