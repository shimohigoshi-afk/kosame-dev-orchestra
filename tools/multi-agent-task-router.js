#!/usr/bin/env node
'use strict';

/**
 * Multi-Agent Task Router v110.13.0
 *
 * GPT が裁定し、Gemini / Claude Code / Grok にタスクを自動ディスパッチする。
 *
 * Usage:
 *   node tools/multi-agent-task-router.js --input="<task>" [--live] [--yes]
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { arbitrate } = require('./gpt-task-arbiter');
const geminiProvider = require('../providers/gemini-provider');

// ── Context Enrichment ────────────────────────────────────────────────────────

function enrichContext(subtask, originalInput) {
  const context = {
    originalInput,
    projectContext: {
      productName: 'ANESTY Board',
      targetVersion: 'v110.16.0',
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

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = prefix => args.find(a => a.startsWith(prefix))?.slice(prefix.length) ?? null;

  const inputInline = get('--input=');
  const taskFile = get('--task-file=');
  const output = get('--output=');
  const live = args.includes('--live');
  const yes = args.includes('--yes');

  return { inputInline, taskFile, output, live, yes };
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

// ── Dispatch: Claude Code ─────────────────────────────────────────────────────

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

// ── Plan display ──────────────────────────────────────────────────────────────

function printPlan({ task, routing, dryRun, live }) {
  console.log('\n===== Multi-Agent Task Router v110.13 =====');
  console.log(`INPUT   : ${task.length > 100 ? task.slice(0, 100) + '…' : task}`);
  console.log(`ARBITER : GPT (method=${routing.method})`);
  console.log(`DRY RUN : ${dryRun}`);
  console.log(`LIVE    : ${live}`);
  console.log('===========================================\n');

  console.log('[Routing Decision]');
  if (routing.reasoning) console.log(`  reasoning: ${routing.reasoning}`);

  console.log(`\n  → Gemini (${routing.gemini.length} task${routing.gemini.length !== 1 ? 's' : ''})`);
  routing.gemini.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  console.log(`\n  → Claude Code (${routing.claudeCode.length} task${routing.claudeCode.length !== 1 ? 's' : ''})`);
  routing.claudeCode.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  console.log(`\n  → Grok (${routing.grok.length} task${routing.grok.length !== 1 ? 's' : ''})`);
  routing.grok.forEach((t, i) => console.log(`    [${i + 1}] ${t}`));

  if (dryRun) {
    console.log('\n  ── dry-run: pass --yes to dispatch ──');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run(argv) {
  const { inputInline, taskFile, output, live, yes } = parseArgs(argv);
  const dryRun = !yes;

  const task = resolveTask({ inputInline, taskFile });

  // 1. GPT arbitration
  console.log('[1/4] GPT arbitration…');
  const routing = await arbitrate(task, { live });

  // 2. Show plan
  printPlan({ task, routing, dryRun, live });

  if (dryRun) {
    return { dryRun: true, routing };
  }

  // 3. Dispatch (--yes)
  console.log('\n[2/4] Gemini dispatch');
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

  console.log('\n[3/4] Claude Code dispatch');
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

  console.log('\n[4/4] Grok bucket (audit only)');
  routing.grok.forEach(t => console.log(`  [AUDIT] ${t.slice(0, 60)}`));

  const summary = {
    dryRun: false,
    task,
    routing,
    gemini: geminiResults,
    claudeCode: claudeResults,
    dispatchedAt: new Date().toISOString(),
  };

  if (output) {
    fs.writeFileSync(output, JSON.stringify(summary, null, 2));
    console.log(`\n💾 Results saved to ${output}`);
  }

  console.log('\n✅ dispatch complete');
  return summary;
}

module.exports = { run, parseArgs, resolveTask, detectInsufficientContext };

if (require.main === module) {
  run(process.argv).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}
