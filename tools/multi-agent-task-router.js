#!/usr/bin/env node
'use strict';

/**
 * Multi-Agent Task Router v110.7.0
 *
 * GPT が裁定し、Gemini と Claude Code にタスクを自動ディスパッチする。
 *
 * Usage:
 *   node tools/multi-agent-task-router.js --input="<task>" [--live] [--yes]
 *   node tools/multi-agent-task-router.js --task-file=<path> [--live] [--yes]
 *
 * --yes なし : dry-run（プランを表示するのみ、実行なし）
 * --yes      : 承認ゲート通過 → Gemini / Claude Code にディスパッチ
 * --live     : 実際のAPI呼び出しを有効化（GPT裁定 + Gemini実行）
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { arbitrate } = require('./gpt-task-arbiter');
const geminiProvider = require('../providers/gemini-provider');

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;

  const inputInline = get('--input=');
  const taskFile = get('--task-file=');
  const live = args.includes('--live');
  const yes = args.includes('--yes');

  return { inputInline, taskFile, live, yes };
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

// ── Dispatch: Gemini ──────────────────────────────────────────────────────────

async function dispatchToGemini(tasks, live) {
  const results = [];
  for (const task of tasks) {
    const packet = { id: `gemini-${Date.now()}`, type: 'generate', input: task };
    const result = await geminiProvider.run(packet, { live });
    results.push({ task, result });
  }
  return results;
}

// ── Dispatch: Claude Code ─────────────────────────────────────────────────────

function dispatchToClaudeCode(tasks, dryRun) {
  const results = [];
  for (const task of tasks) {
    if (dryRun) {
      results.push({
        task,
        result: { dryRun: true, provider: 'claude-code', planned: `claude -p "${task}"` },
      });
      continue;
    }
    try {
      const out = execFileSync('claude', ['-p', task], {
        encoding: 'utf8',
        timeout: 60000,
      });
      results.push({ task, result: { success: true, provider: 'claude-code', response: out.trim() } });
    } catch (err) {
      results.push({
        task,
        result: { success: false, provider: 'claude-code', error: err.message },
      });
    }
  }
  return results;
}

// ── Plan display ──────────────────────────────────────────────────────────────

function printPlan({ task, routing, dryRun, live }) {
  console.log('\n===== Multi-Agent Task Router =====');
  console.log(`INPUT   : ${task.length > 100 ? task.slice(0, 100) + '…' : task}`);
  console.log(`ARBITER : GPT (method=${routing.method})`);
  console.log(`DRY RUN : ${dryRun}`);
  console.log(`LIVE    : ${live}`);
  console.log('===================================\n');

  console.log('[Routing Decision]');
  if (routing.reasoning) console.log(`  reasoning: ${routing.reasoning}`);

  console.log(`\n  → Gemini (${routing.gemini.length} task${routing.gemini.length !== 1 ? 's' : ''})`);
  routing.gemini.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  console.log(`\n  → Claude Code (${routing.claudeCode.length} task${routing.claudeCode.length !== 1 ? 's' : ''})`);
  routing.claudeCode.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  if (dryRun) {
    console.log('\n  ── dry-run: pass --yes to dispatch ──');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(argv) {
  const { inputInline, taskFile, live, yes } = parseArgs(argv);
  const dryRun = !yes;

  const task = resolveTask({ inputInline, taskFile });

  // 1. GPT arbitration
  console.log('[1/3] GPT arbitration…');
  const routing = await arbitrate(task, { live });

  // 2. Show plan
  printPlan({ task, routing, dryRun, live });

  if (dryRun) {
    return { dryRun: true, routing };
  }

  // 3. Dispatch (--yes)
  console.log('\n[2/3] Gemini dispatch');
  const geminiResults = routing.gemini.length > 0
    ? await dispatchToGemini(routing.gemini, live)
    : [];

  geminiResults.forEach(({ task: t, result }) => {
    const status = result.dryRun ? '[DRY]' : result.success ? '[OK]' : '[FAIL]';
    console.log(`  ${status} ${t.slice(0, 60)}`);
    if (result.response) console.log(`       → ${result.response.slice(0, 120)}`);
    if (result.error) console.log(`       ERROR: ${result.error}`);
  });

  console.log('\n[3/3] Claude Code dispatch');
  const claudeResults = routing.claudeCode.length > 0
    ? dispatchToClaudeCode(routing.claudeCode, dryRun)
    : [];

  claudeResults.forEach(({ task: t, result }) => {
    const status = result.dryRun ? '[DRY]' : result.success ? '[OK]' : '[FAIL]';
    console.log(`  ${status} ${t.slice(0, 60)}`);
    if (result.planned) console.log(`       → ${result.planned}`);
    if (result.response) console.log(`       → ${result.response.slice(0, 120)}`);
    if (result.error) console.log(`       ERROR: ${result.error}`);
  });

  const summary = {
    dryRun: false,
    routing,
    gemini: geminiResults,
    claudeCode: claudeResults,
    dispatchedAt: new Date().toISOString(),
  };

  console.log('\n✅ dispatch complete');
  return summary;
}

module.exports = { run, parseArgs, resolveTask };

if (require.main === module) {
  run(process.argv).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
