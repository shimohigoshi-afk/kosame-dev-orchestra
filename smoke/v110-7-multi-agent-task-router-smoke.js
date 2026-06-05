#!/usr/bin/env node
'use strict';

/**
 * Smoke test: Multi-Agent Task Router v110.7.0
 */

const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg = require('../package.json');
const { arbitrate, heuristicRoute } = require('../tools/gpt-task-arbiter');
const { parseArgs, resolveTask } = require('../tools/multi-agent-task-router');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.7 multi-agent task router smoke ===');

// ── package.json ──────────────────────────────────────────────────────────────

assert.strictEqual(pkg.version, '110.7.0', `version mismatch: ${pkg.version}`);
pass('version is 110.7.0');

assert.ok(pkg.scripts['route'], 'route script missing');
assert.ok(pkg.scripts['route'].includes('multi-agent-task-router.js'), 'route script wrong path');
pass('route script exists');

assert.ok(pkg.scripts['smoke:multi-agent-router'], 'smoke:multi-agent-router script missing');
pass('smoke:multi-agent-router script exists');

// ── node --check ──────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, '..');

execFileSync(process.execPath, ['--check', 'tools/gpt-task-arbiter.js'], { cwd: ROOT });
pass('gpt-task-arbiter.js passes node --check');

execFileSync(process.execPath, ['--check', 'tools/multi-agent-task-router.js'], { cwd: ROOT });
pass('multi-agent-task-router.js passes node --check');

// ── heuristic routing ─────────────────────────────────────────────────────────

const h1 = heuristicRoute('summarize and draft the existing coverage report');
assert.ok(h1.gemini.length > 0, 'summarize → gemini expected');
assert.strictEqual(h1.method, 'heuristic_gemini_only');
pass('summarize routes to gemini only');

const h2 = heuristicRoute('implement and fix the bug in completion-review-gate');
assert.ok(h2.claudeCode.length > 0, 'implement/fix → claude expected');
assert.strictEqual(h2.method, 'heuristic_claude_only');
pass('implement/fix routes to claude only');

const h3 = heuristicRoute('generate a document and implement the code');
assert.ok(h3.gemini.length > 0, 'mixed → gemini expected');
assert.ok(h3.claudeCode.length > 0, 'mixed → claude expected');
assert.strictEqual(h3.method, 'heuristic_split');
pass('mixed task splits to both agents');

const h4 = heuristicRoute('コードを実装してスモークテストを追加');
assert.ok(h4.claudeCode.length > 0, 'Japanese implement → claude expected');
pass('Japanese implementation task routes to claude');

const h5 = heuristicRoute('要約と一覧を生成してください');
assert.ok(h5.gemini.length > 0, 'Japanese generate → gemini expected');
pass('Japanese generation task routes to gemini');

// ── arbitrate (dry-run, no --live) ────────────────────────────────────────────

async function runAsyncTests() {
  const r1 = await arbitrate('implement a smoke test', { live: false });
  assert.ok(r1.dryRun === true, 'arbitrate without live should be dryRun');
  assert.ok(Array.isArray(r1.gemini), 'gemini array expected');
  assert.ok(Array.isArray(r1.claudeCode), 'claudeCode array expected');
  assert.ok(typeof r1.method === 'string', 'method string expected');
  assert.ok(r1.reasoning.includes('[heuristic]'), 'heuristic reasoning expected');
  pass('arbitrate dry-run returns heuristic result');

  const r2 = await arbitrate('write a summary report', { live: false });
  assert.ok(r2.dryRun === true);
  assert.ok(r2.gemini.length > 0, 'summary → gemini via heuristic');
  pass('summary task heuristic routes to gemini');

  // arg parsing
  const a1 = parseArgs(['node', 'router.js', '--input=hello', '--yes', '--live']);
  assert.strictEqual(a1.inputInline, 'hello');
  assert.strictEqual(a1.yes, true);
  assert.strictEqual(a1.live, true);
  pass('--input --yes --live parsed correctly');

  const a2 = parseArgs(['node', 'router.js', '--input=hello']);
  assert.strictEqual(a2.yes, false);
  assert.strictEqual(a2.live, false);
  pass('omitting --yes and --live gives dry-run defaults');

  // resolveTask
  const t1 = resolveTask({ inputInline: 'my task', taskFile: null });
  assert.strictEqual(t1, 'my task');
  pass('resolveTask with inline input');

  const tmpFile = path.join(ROOT, 'fixtures', 'tmp-task-smoke.json');
  fs.writeFileSync(tmpFile, JSON.stringify({ input: 'fixture task' }));
  const t2 = resolveTask({ inputInline: null, taskFile: tmpFile });
  assert.strictEqual(t2, 'fixture task');
  fs.unlinkSync(tmpFile);
  pass('resolveTask with task-file (JSON)');

  assert.throws(
    () => resolveTask({ inputInline: null, taskFile: null }),
    /required/
  );
  pass('resolveTask throws without input or task-file');

  // dry-run: run() returns without dispatching
  const { run } = require('../tools/multi-agent-task-router');
  const result = await run(['node', 'router.js', '--input=implement the routing module']);
  assert.strictEqual(result.dryRun, true, 'run without --yes must be dryRun');
  assert.ok(result.routing, 'routing plan returned');
  pass('run without --yes is dry-run only');

  console.log('PASS: v110.7 multi-agent task router smoke');
}

runAsyncTests().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
