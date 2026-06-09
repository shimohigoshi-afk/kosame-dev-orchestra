#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.27 KOSAME Google Drive Auto Writer
 *
 * Verifies without making any real API calls:
 *   - TOOL_META.version, constants
 *   - entryToRow() maps learning-log schema correctly
 *   - buildDocsEntry() formats version/commit/datetime block
 *   - writeSheetsRows() dryRun returns correct shape, no API call
 *   - writeDocsEntry() dryRun returns correct shape, no API call
 *   - --write without ID → rejects with descriptive error
 *   - readLogEntries() returns array
 */

const assert = require('node:assert');
const w      = require('../tools/kosame-gdrive-writer');

let passed = 0;
let failed = 0;

function semverGte(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return true;
}

function pass(msg) { passed++; console.log(`  PASS: ${msg}`); }
function fail(msg, err) { failed++; console.error(`  FAIL: ${msg}  — ${err?.message ?? err}`); }

function check(label, fn) {
  try { fn(); pass(label); }
  catch (e) { fail(label, e); }
}

async function checkAsync(label, fn) {
  try { await fn(); pass(label); }
  catch (e) { fail(label, e); }
}

async function main() {
  console.log('=== v110.27 gdrive-writer smoke ===');

  // ── TOOL_META ───────────────────────────────────────────────────────────────
  check('TOOL_META.version >= 110.27.0', () =>
    assert.ok(semverGte(w.TOOL_META.version, '110.27.0')));
  check('TOOL_META.slug === kosame-gdrive-writer', () =>
    assert.strictEqual(w.TOOL_META.slug, 'kosame-gdrive-writer'));

  // ── Constants ───────────────────────────────────────────────────────────────
  check('SHEET_NAME is シート1', () =>
    assert.strictEqual(w.SHEET_NAME, 'シート1'));
  check('DOC_NAME is KOSAME 設計書（自動生成）', () =>
    assert.strictEqual(w.DOC_NAME, 'KOSAME 設計書（自動生成）'));
  check('SHEET_HEADER has 11 columns', () =>
    assert.strictEqual(w.SHEET_HEADER.length, 11));
  check('SHEET_HEADER[0] === ts', () =>
    assert.strictEqual(w.SHEET_HEADER[0], 'ts'));
  check('SHEET_HEADER includes taskInput', () =>
    assert.ok(w.SHEET_HEADER.includes('taskInput')));

  // ── entryToRow ──────────────────────────────────────────────────────────────
  check('entryToRow: maps all 11 fields', () => {
    const row = w.entryToRow({
      ts: '2026-06-08T00:00:00.000Z', taskType: 'implement', difficulty: 'medium',
      model: 'claude-sonnet-4-6', provider: 'anthropic', costUsd: 0.0012,
      durationMs: 4500, success: true, escalated: false, dryRun: false,
      taskInput: 'DeepSeek adapter',
    });
    assert.strictEqual(row.length, 11);
    assert.strictEqual(row[0], '2026-06-08T00:00:00.000Z');
    assert.strictEqual(row[1], 'implement');
    assert.strictEqual(row[5], 0.0012);
    assert.strictEqual(row[7], 'true');
    assert.strictEqual(row[10], 'DeepSeek adapter');
  });
  check('entryToRow: null fields → empty string', () => {
    const row = w.entryToRow({ costUsd: null, durationMs: null, success: null });
    assert.strictEqual(row[5], '');
    assert.strictEqual(row[6], '');
    assert.strictEqual(row[7], '');
  });

  // ── buildDocsEntry ──────────────────────────────────────────────────────────
  check('buildDocsEntry: contains version', () => {
    const t = w.buildDocsEntry({ version: 'v110.27', content: 'Google Drive writer' });
    assert.ok(t.includes('v110.27'));
  });
  check('buildDocsEntry: contains date', () => {
    const t = w.buildDocsEntry({ version: 'v110.27', content: '' });
    assert.ok(/\d{4}-\d{2}-\d{2}/.test(t));
  });
  check('buildDocsEntry: contains content', () => {
    const t = w.buildDocsEntry({ version: 'v1', content: 'test content ABC' });
    assert.ok(t.includes('test content ABC'));
  });
  check('buildDocsEntry: uses provided commit', () => {
    const t = w.buildDocsEntry({ version: 'v1', content: '', commit: { hash: 'abc1234', msg: 'test commit' } });
    assert.ok(t.includes('abc1234'));
    assert.ok(t.includes('test commit'));
  });
  check('buildDocsEntry: empty content → (no description)', () => {
    const t = w.buildDocsEntry({ version: 'v1', content: '' });
    assert.ok(t.includes('(no description)'));
  });

  // ── writeSheetsRows dryRun ──────────────────────────────────────────────────
  await checkAsync('writeSheetsRows dryRun: ok=true, dryRun=true', async () => {
    const r = await w.writeSheetsRows({ dryRun: true });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.realProductActionsExecuted, false);
  });
  await checkAsync('writeSheetsRows dryRun: op=sheets:append', async () => {
    const r = await w.writeSheetsRows({ dryRun: true });
    assert.strictEqual(r.op, 'sheets:append');
  });
  await checkAsync('writeSheetsRows dryRun: sheetName correct', async () => {
    const r = await w.writeSheetsRows({ dryRun: true });
    assert.strictEqual(r.sheetName, 'シート1');
  });
  await checkAsync('writeSheetsRows dryRun: rowCount is number', async () => {
    const r = await w.writeSheetsRows({ dryRun: true });
    assert.ok(typeof r.rowCount === 'number');
  });
  await checkAsync('writeSheetsRows dryRun: no SHEETS_ID reflected in plan', async () => {
    const saved = process.env.KOSAME_SHEETS_ID;
    delete process.env.KOSAME_SHEETS_ID;
    const r = await w.writeSheetsRows({ dryRun: true });
    assert.ok(r.sheetsId.includes('not set'));
    if (saved !== undefined) process.env.KOSAME_SHEETS_ID = saved;
  });

  // ── writeDocsEntry dryRun ───────────────────────────────────────────────────
  await checkAsync('writeDocsEntry dryRun: ok=true, dryRun=true', async () => {
    const r = await w.writeDocsEntry({ dryRun: true, version: 'v110.27', content: 'test' });
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.realProductActionsExecuted, false);
  });
  await checkAsync('writeDocsEntry dryRun: op=docs:append', async () => {
    const r = await w.writeDocsEntry({ dryRun: true });
    assert.strictEqual(r.op, 'docs:append');
  });
  await checkAsync('writeDocsEntry dryRun: docName correct', async () => {
    const r = await w.writeDocsEntry({ dryRun: true });
    assert.strictEqual(r.docName, 'KOSAME 設計書（自動生成）');
  });
  await checkAsync('writeDocsEntry dryRun: textPreview contains version', async () => {
    const r = await w.writeDocsEntry({ dryRun: true, version: 'v110.27', content: 'abc' });
    assert.ok(r.textPreview.includes('v110.27'));
  });
  await checkAsync('writeDocsEntry dryRun: no DOCS_ID reflected in plan', async () => {
    const saved = process.env.KOSAME_DOCS_ID;
    delete process.env.KOSAME_DOCS_ID;
    const r = await w.writeDocsEntry({ dryRun: true });
    assert.ok(r.docsId.includes('not set'));
    if (saved !== undefined) process.env.KOSAME_DOCS_ID = saved;
  });

  // ── --write without ID → rejects ────────────────────────────────────────────
  await checkAsync('writeSheetsRows --write without sheetsId → rejects', async () => {
    const saved = process.env.KOSAME_SHEETS_ID;
    delete process.env.KOSAME_SHEETS_ID;
    await assert.rejects(() => w.writeSheetsRows({ dryRun: false }), /KOSAME_SHEETS_ID/);
    if (saved !== undefined) process.env.KOSAME_SHEETS_ID = saved;
  });
  await checkAsync('writeDocsEntry --write without docsId → rejects', async () => {
    const saved = process.env.KOSAME_DOCS_ID;
    delete process.env.KOSAME_DOCS_ID;
    await assert.rejects(() => w.writeDocsEntry({ dryRun: false }), /KOSAME_DOCS_ID/);
    if (saved !== undefined) process.env.KOSAME_DOCS_ID = saved;
  });

  // ── readLogEntries ──────────────────────────────────────────────────────────
  check('readLogEntries: returns array', () =>
    assert.ok(Array.isArray(w.readLogEntries())));

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n=== v110.27 gdrive-writer smoke: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
