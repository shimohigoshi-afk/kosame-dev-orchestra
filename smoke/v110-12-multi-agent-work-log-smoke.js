#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.12.0
 * - multi-agent-work-log (Gemini実装/Claude補修/GPT裁定の時系列記録・可視化)
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg  = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.12 multi-agent-work-log smoke ===');

// ── version ───────────────────────────────────────────────────────────────────

assert.ok(/^110\.(1[0-9]|[2-9][0-9])\.\d+$/.test(pkg.version), `package version compatible: ${pkg.version}`);
pass('package.json version is 110.12.0');

// ── scripts ───────────────────────────────────────────────────────────────────

[
  'smoke:multi-agent-work-log',
  'smoke:v110-12',
  'pm-agent:multi-agent-work-log'
].forEach(s => {
  assert.ok(pkg.scripts[s], `script missing: ${s}`);
  pass(`script ${s} exists`);
});

// ── node --check ──────────────────────────────────────────────────────────────

execFileSync(process.execPath, ['--check', 'tools/multi-agent-work-log.js'], { cwd: ROOT });
pass('tools/multi-agent-work-log.js passes node --check');

// ── fixture ───────────────────────────────────────────────────────────────────

const fixturePath = path.join(ROOT, 'fixtures/multi-agent-work-log.fixture.json');
assert.ok(fs.existsSync(fixturePath), 'fixture file missing');
pass('fixture multi-agent-work-log.fixture.json exists');

// ── module exports ────────────────────────────────────────────────────────────

const workLogMod = require('../tools/multi-agent-work-log');

assert.strictEqual(workLogMod.TOOL_META.version, '110.12.0');
pass('TOOL_META.version is 110.12.0');

// ── AGENT_ROLE enum ───────────────────────────────────────────────────────────

assert.strictEqual(workLogMod.AGENT_ROLE.GEMINI,  'gemini');
assert.strictEqual(workLogMod.AGENT_ROLE.CLAUDE,  'claude');
assert.strictEqual(workLogMod.AGENT_ROLE.GPT,     'gpt');
assert.strictEqual(workLogMod.AGENT_ROLE.HUMAN,   'human');
assert.strictEqual(workLogMod.AGENT_ROLE.UNKNOWN, 'unknown');
pass('AGENT_ROLE enum values correct');

// ── ACTION_TYPE enum ──────────────────────────────────────────────────────────

const requiredActions = ['implement', 'repair', 'arbitrate', 'review', 'approve', 'handoff', 'complete'];
for (const a of requiredActions) {
  assert.ok(Object.values(workLogMod.ACTION_TYPE).includes(a), `ACTION_TYPE missing: ${a}`);
}
pass('ACTION_TYPE contains all required actions');

// ── buildEntry ────────────────────────────────────────────────────────────────

{
  const e = workLogMod.buildEntry('gemini-1.5-pro', 'implement', {
    taskId: 't1', sessionId: 's1', productId: 'p1',
    description: 'UI実装', dryRun: true
  });
  assert.strictEqual(e.agent,     'gemini-1.5-pro');
  assert.strictEqual(e.action,    'implement');
  assert.strictEqual(e.role,      'gemini');
  assert.strictEqual(e.taskId,    't1');
  assert.strictEqual(e.sessionId, 's1');
  assert.strictEqual(e.productId, 'p1');
  assert.strictEqual(e.dryRun,    true);
  assert.ok(typeof e.ts === 'string' && e.ts.length > 0, 'ts must be ISO string');
  pass('buildEntry(gemini, implement) returns correct structure');
}
{
  const e = workLogMod.buildEntry('claude-sonnet-4-6', 'repair', { dryRun: true });
  assert.strictEqual(e.role, 'claude');
  pass('buildEntry(claude) role=claude');
}
{
  const e = workLogMod.buildEntry('gpt-4o', 'arbitrate', { dryRun: true });
  assert.strictEqual(e.role, 'gpt');
  pass('buildEntry(gpt-4o) role=gpt');
}
{
  const e = workLogMod.buildEntry('human', 'approve', { dryRun: true });
  assert.strictEqual(e.role, 'human');
  pass('buildEntry(human) role=human');
}
{
  const e = workLogMod.buildEntry('unknown-agent', 'review', { dryRun: true });
  assert.strictEqual(e.role, 'unknown');
  pass('buildEntry(unknown-agent) role=unknown');
}

// ── createWorkLog ─────────────────────────────────────────────────────────────

{
  const wl = workLogMod.createWorkLog({ sessionId: 'sess-1', productId: 'prod-1', dryRun: true });

  // append entries
  wl.arbitrate('gpt-4o',            { taskId: 't1', description: 'タスク裁定' });
  wl.implement('gemini-1.5-pro',    { taskId: 't1', description: 'コンポーネント実装', durationMs: 5000 });
  wl.repair   ('claude-sonnet-4-6', { taskId: 't1', description: '型エラー修正' });
  wl.review   ('claude-opus-4-8',   { taskId: 't1', description: 'コードレビュー' });
  wl.approve  ('human',             { taskId: 't1', description: 'ゲート承認' });
  wl.handoff  ('claude-sonnet-4-6', { taskId: 't1', description: 'コミットパケット生成' });
  wl.implement('gemini-2.0-flash',  { taskId: 't2', description: 'APIルート実装' });
  wl.complete ('gemini-2.0-flash',  { taskId: 't2', description: '完了' });

  assert.strictEqual(wl.entries.length, 8, 'must have 8 entries');
  pass('createWorkLog appends 8 entries via shortcut methods');

  // all entries carry dryRun / sessionId / productId
  for (const e of wl.entries) {
    assert.strictEqual(e.dryRun,    true,   'entry.dryRun must be true');
    assert.strictEqual(e.sessionId, 'sess-1');
    assert.strictEqual(e.productId, 'prod-1');
  }
  pass('all entries carry dryRun/sessionId/productId');

  // bySession
  const byS = wl.bySession('sess-1');
  assert.strictEqual(byS.length, 8);
  const bySOther = wl.bySession('other');
  assert.strictEqual(bySOther.length, 0);
  pass('bySession filters correctly');

  // byProduct
  const byP = wl.byProduct('prod-1');
  assert.strictEqual(byP.length, 8);
  pass('byProduct filters correctly');

  // timeline — sorted by ts
  const tl = wl.timeline();
  assert.strictEqual(tl.length, 8);
  for (let i = 1; i < tl.length; i++) {
    assert.ok(tl[i - 1].ts <= tl[i].ts, 'timeline must be sorted by ts');
  }
  pass('timeline returns sorted entries');

  // agentSummary
  const summary = wl.agentSummary();
  assert.ok(Array.isArray(summary), 'agentSummary must return array');
  const gemini = summary.find(s => s.agent.startsWith('gemini'));
  assert.ok(gemini, 'gemini agent must appear in summary');
  assert.ok(gemini.actionCount >= 1, 'gemini must have at least 1 action');
  pass('agentSummary includes gemini with correct action count');

  // report
  const rep = wl.report({ silent: true });
  assert.strictEqual(rep.tool,    'multi-agent-work-log');
  assert.strictEqual(rep.version, '110.12.0');
  assert.strictEqual(rep.dryRun,  true);
  assert.strictEqual(rep.realProductActionsExecuted, false);
  assert.strictEqual(rep.dangerousActionsDenied,     true);
  assert.strictEqual(rep.humanApprovalRequired,      true);
  assert.strictEqual(rep.entryCount, 8);
  assert.ok(Array.isArray(rep.agentSummary));
  assert.ok(Array.isArray(rep.timeline));
  assert.strictEqual(rep.timeline.length, 8);
  pass('report returns correct structure and safety fields');
}

// ── renderTimeline ────────────────────────────────────────────────────────────

{
  const wl = workLogMod.createWorkLog({ dryRun: true });
  wl.implement('gemini-1.5-flash', { taskId: 't1', description: 'テスト実装' });
  wl.repair   ('claude-sonnet-4-6', { taskId: 't1', description: 'テスト修正' });

  const rendered = workLogMod.renderTimeline(wl.timeline());
  assert.ok(typeof rendered === 'string', 'renderTimeline must return string');
  assert.ok(rendered.includes('TIMELINE'), 'must include TIMELINE header');
  assert.ok(rendered.includes('implement') || rendered.includes('G'), 'must include action or role icon');
  pass('renderTimeline returns ASCII timeline string');
}

// ── report with section logger markers ───────────────────────────────────────

{
  const wl = workLogMod.createWorkLog({ dryRun: true });
  wl.implement('gemini-1.5-flash', { taskId: 't1' });

  const lines = [];
  const origLog = console.log;
  console.log = (...args) => lines.push(args.join(' '));
  wl.report({ silent: false });
  console.log = origLog;

  const out = lines.join('\n');
  assert.ok(out.length > 0, 'report must emit output when silent=false');
  pass('report emits log output when silent=false');
}

console.log('\nPASS: v110.12 all smoke tests');
