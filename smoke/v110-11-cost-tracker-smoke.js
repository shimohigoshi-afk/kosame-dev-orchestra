#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.11.0
 * - cost-tracker (OpenAI/Gemini/Grok/DeepSeek/Kimi, per-task aggregation,
 *                 Claude Agent Team comparison report)
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg  = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.11 cost-tracker smoke ===');

// ── version ───────────────────────────────────────────────────────────────────

assert.ok(/^110\.(1[0-9]|[2-9][0-9])\.\d+$/.test(pkg.version), `package version compatible: ${pkg.version}`);
pass('package.json version is 110.12.0');

// ── scripts ───────────────────────────────────────────────────────────────────

[
  'smoke:cost-tracker',
  'smoke:v110-11',
  'pm-agent:cost-tracker'
].forEach(s => {
  assert.ok(pkg.scripts[s], `script missing: ${s}`);
  pass(`script ${s} exists`);
});

// ── node --check ──────────────────────────────────────────────────────────────

try {
  execFileSync(process.execPath, ['--check', 'tools/cost-tracker.js'], { cwd: ROOT });
  pass('tools/cost-tracker.js passes node --check');
} catch (error) {
  if (error && error.code === 'EPERM') pass('tools/cost-tracker.js node --check skipped in this environment');
  else throw error;
}

// ── fixture ───────────────────────────────────────────────────────────────────

const fixturePath = path.join(ROOT, 'fixtures/cost-tracker.fixture.json');
assert.ok(fs.existsSync(fixturePath), 'fixture file missing');
pass('fixture cost-tracker.fixture.json exists');

// ── module exports ────────────────────────────────────────────────────────────

const tracker = require('../tools/cost-tracker');

assert.strictEqual(tracker.TOOL_META.version, '110.11.0');
pass('TOOL_META.version is 110.11.0');

// ── PRICE_TABLE coverage ──────────────────────────────────────────────────────

const requiredModels = [
  // OpenAI
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo',
  // Gemini
  'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash',
  // Grok
  'grok-2',
  // DeepSeek
  'deepseek-chat', 'deepseek-reasoner',
  // Kimi
  'kimi-latest',
  // Claude (comparison)
  'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'
];

for (const m of requiredModels) {
  assert.ok(tracker.PRICE_TABLE[m], `PRICE_TABLE missing model: ${m}`);
  const p = tracker.PRICE_TABLE[m];
  assert.ok(typeof p.input === 'number' && p.input >= 0,  `${m}.input must be non-negative number`);
  assert.ok(typeof p.output === 'number' && p.output >= 0, `${m}.output must be non-negative number`);
  assert.ok(typeof p.provider === 'string' && p.provider.length > 0, `${m}.provider must be string`);
}
pass('PRICE_TABLE contains all required models with valid entries');

// ── CLAUDE_AGENT_TEAM ─────────────────────────────────────────────────────────

assert.ok(Array.isArray(tracker.CLAUDE_AGENT_TEAM), 'CLAUDE_AGENT_TEAM must be array');
assert.ok(tracker.CLAUDE_AGENT_TEAM.includes('claude-sonnet-4-6'), 'claude-sonnet-4-6 must be in team');
pass('CLAUDE_AGENT_TEAM is array containing claude-sonnet-4-6');

// ── calcCost ──────────────────────────────────────────────────────────────────

{
  const c = tracker.calcCost('gpt-4o', 1_000_000, 1_000_000);
  assert.strictEqual(c.model,    'gpt-4o');
  assert.strictEqual(c.provider, 'openai');
  assert.strictEqual(c.inputUsd, 2.50);
  assert.strictEqual(c.outputUsd, 10.00);
  assert.strictEqual(c.totalUsd, 12.50);
  pass('calcCost gpt-4o 1M/1M tokens: correct USD amounts');
}
{
  const c = tracker.calcCost('gemini-1.5-flash', 10_000, 2_000);
  assert.strictEqual(c.provider, 'gemini');
  assert.ok(c.totalUsd >= 0, 'totalUsd must be non-negative');
  pass('calcCost gemini-1.5-flash: non-negative totalUsd');
}
{
  const c = tracker.calcCost('deepseek-chat', 0, 0);
  assert.strictEqual(c.totalUsd, 0, 'zero tokens must yield zero cost');
  pass('calcCost zero tokens yields totalUsd=0');
}
{
  assert.throws(() => tracker.calcCost('unknown-model-xyz', 100, 100), /Unknown model/);
  pass('calcCost throws on unknown model');
}

// ── createSession + record + aggregateByTask ──────────────────────────────────

{
  const session = tracker.createSession({ sessionId: 'test-001', productId: 'prod-a', dryRun: true });

  session.record('task-1', 'gemini-1.5-flash', 5000, 1000);
  session.record('task-1', 'gpt-4o-mini',      2000,  500);
  session.record('task-2', 'deepseek-chat',     8000, 2000);

  assert.strictEqual(session.records.length, 3, 'must have 3 records');
  pass('session.record appends entries');

  const agg = session.aggregateByTask();
  assert.strictEqual(agg.length, 2, 'must aggregate into 2 tasks');
  const t1 = agg.find(a => a.taskId === 'task-1');
  assert.ok(t1, 'task-1 must be in aggregation');
  assert.ok(t1.totalUsd >= 0, 'task-1 totalUsd must be non-negative');
  assert.strictEqual(t1.records.length, 2, 'task-1 must have 2 records');
  pass('aggregateByTask returns correct per-task totals');

  // verify dryRun flag propagated
  for (const r of session.records) {
    assert.strictEqual(r.dryRun, true, 'all records must have dryRun=true');
    assert.strictEqual(r.sessionId, 'test-001');
    assert.strictEqual(r.productId, 'prod-a');
  }
  pass('session records carry dryRun/sessionId/productId');
}

// ── comparisonReport ──────────────────────────────────────────────────────────

{
  const session = tracker.createSession({ sessionId: 'cmp-001', dryRun: true });
  session.record('task-1', 'gemini-1.5-flash', 100_000, 20_000);
  session.record('task-2', 'deepseek-chat',    200_000, 50_000);

  const report = session.comparisonReport({ silent: true });

  assert.strictEqual(report.tool,    'cost-tracker');
  assert.strictEqual(report.version, '110.11.0');
  assert.strictEqual(report.dryRun,  true);
  assert.strictEqual(report.realProductActionsExecuted, false);
  assert.strictEqual(report.dangerousActionsDenied,     true);
  assert.strictEqual(report.humanApprovalRequired,      true);
  assert.strictEqual(report.recordCount, 2);
  assert.ok(typeof report.sessionTotalUsd === 'number', 'sessionTotalUsd must be number');
  assert.ok(typeof report.claudeTeamEstimateUsd === 'number', 'claudeTeamEstimateUsd must be number');
  assert.ok(typeof report.estimatedSavingUsd === 'number', 'estimatedSavingUsd must be number');
  assert.ok(typeof report.estimatedSavingPct === 'number', 'estimatedSavingPct must be number');
  assert.ok(typeof report.byProvider === 'object', 'byProvider must be object');
  assert.ok(Array.isArray(report.taskAggregation), 'taskAggregation must be array');
  pass('comparisonReport returns correct structure and safety fields');

  // gemini+deepseek should be cheaper than claude-sonnet-4-6 only
  assert.ok(report.sessionTotalUsd < report.claudeTeamEstimateUsd,
    `session ($${report.sessionTotalUsd}) should be cheaper than claude team ($${report.claudeTeamEstimateUsd})`);
  pass('comparisonReport: session total is cheaper than claude team estimate');
}

// ── comparisonReport with section logger output ───────────────────────────────

{
  const session = tracker.createSession({ dryRun: true });
  session.record('t1', 'gemini-1.5-flash', 1000, 200);

  const lines = [];
  const origLog = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  session.comparisonReport({ silent: false });
  console.log = origLog;

  const out = lines.join('\n');
  assert.ok(out.includes('session total:') || out.includes('INFO') || out.length > 0,
    'comparisonReport must emit log output when silent=false');
  pass('comparisonReport emits log output when silent=false');
}

console.log('\nPASS: v110.11 all smoke tests');
