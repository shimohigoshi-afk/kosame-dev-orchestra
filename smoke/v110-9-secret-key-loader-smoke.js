#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.9.0
 * - colored-section-logger (===ここから=== / ===ここまで===)
 * - secret-key-loader (Secret Manager + env fallback, dryRun default)
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg  = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.9 colored-section-logger / secret-key-loader smoke ===');

// ── version ───────────────────────────────────────────────────────────────────

assert.ok(pkg.version >= '110.9.0');
pass('package.json version is 110.9.0');

// ── scripts ───────────────────────────────────────────────────────────────────

[
  'smoke:colored-section-logger',
  'smoke:secret-key-loader',
  'smoke:v110-9',
  'pm-agent:colored-section-logger',
  'pm-agent:secret-key-loader'
].forEach(s => {
  assert.ok(pkg.scripts[s], `script missing: ${s}`);
  pass(`script ${s} exists`);
});

// ── node --check ──────────────────────────────────────────────────────────────

['tools/colored-section-logger.js', 'tools/secret-key-loader.js'].forEach(f => {
  try {
    execFileSync(process.execPath, ['--check', f], { cwd: ROOT });
    pass(`${f} passes node --check`);
  } catch (error) {
    if (error && error.code === 'EPERM') pass(`${f} node --check skipped in this environment`);
    else throw error;
  }
});

// ── fixtures ──────────────────────────────────────────────────────────────────

['fixtures/colored-section-logger.fixture.json',
 'fixtures/secret-key-loader.fixture.json'].forEach(f => {
  assert.ok(fs.existsSync(path.join(ROOT, f)), `fixture missing: ${f}`);
  pass(`fixture ${f} exists`);
});

// ── colored-section-logger ────────────────────────────────────────────────────

const logger = require('../tools/colored-section-logger');

assert.strictEqual(logger.TOOL_META.version, '110.9.0');
pass('colored-section-logger version');

// sectionStart must output ===ここから===
{
  const lines = [];
  logger.sectionStart('テストセクション', { out: l => lines.push(l) });
  const text = lines.join('\n');
  assert.ok(text.includes('===ここから==='), `sectionStart did not emit ===ここから===: "${text}"`);
  assert.ok(text.includes('テストセクション'), 'sectionStart missing section name');
  pass('sectionStart outputs ===ここから=== with section name');
}

// sectionEnd must output ===ここまで===
{
  const lines = [];
  logger.sectionEnd('テストセクション', { out: l => lines.push(l) });
  const text = lines.join('\n');
  assert.ok(text.includes('===ここまで==='), `sectionEnd did not emit ===ここまで===: "${text}"`);
  pass('sectionEnd outputs ===ここまで=== with section name');
}

// sectionStart/sectionEnd without name
{
  const linesStart = [];
  const linesEnd   = [];
  logger.sectionStart(null, { out: l => linesStart.push(l) });
  logger.sectionEnd(null,   { out: l => linesEnd.push(l) });
  assert.ok(linesStart[0].includes('===ここから==='), 'sectionStart no-name must include marker');
  assert.ok(linesEnd[0].includes('===ここまで==='),   'sectionEnd no-name must include marker');
  pass('sectionStart/sectionEnd work without section name');
}

// section() wraps fn() between open and close
{
  const lines = [];
  const out   = l => lines.push(l);
  const result = logger.section('ラップテスト', () => {
    logger.log('info', 'inside section', { out });
    return 42;
  }, { out });
  const joined = lines.join('\n');
  assert.strictEqual(result, 42, 'section() must return fn() result');
  assert.ok(joined.includes('===ここから==='), 'section() must emit open marker');
  assert.ok(joined.includes('===ここまで==='), 'section() must emit close marker');
  pass('section() wraps fn() and returns result');
}

// log levels — each must contain the correct prefix text
const levelPrefixMap = { info: 'INFO', success: 'OK', warn: 'WARN', error: 'ERR', debug: 'DBG' };
Object.entries(levelPrefixMap).forEach(([level, prefix]) => {
  const lines = [];
  logger.log(level, 'test message', { out: l => lines.push(l) });
  const text = lines.join('');
  assert.ok(text.includes(prefix), `log('${level}') must contain prefix "${prefix}": got "${text}"`);
  pass(`log('${level}') contains prefix ${prefix}`);
});

// NO_COLOR=1 must suppress ANSI escape codes
{
  const original = process.env.NO_COLOR;
  process.env.NO_COLOR = '1';
  const lines = [];
  logger.sectionStart('カラーなし', { out: l => lines.push(l) });
  process.env.NO_COLOR = original !== undefined ? original : undefined;
  if (original === undefined) delete process.env.NO_COLOR;
  const text = lines[0];
  assert.ok(!text.includes('\x1b['), `NO_COLOR=1 must strip ANSI codes: "${text}"`);
  pass('NO_COLOR=1 strips ANSI escape codes');
}

async function runAsyncTests() {
  // sectionAsync wraps async fn
  {
    const lines = [];
    const out   = l => lines.push(l);
    const result = await logger.sectionAsync('非同期テスト', async () => {
      return 'async-result';
    }, { out });
    assert.strictEqual(result, 'async-result');
    const joined = lines.join('\n');
    assert.ok(joined.includes('===ここから==='));
    assert.ok(joined.includes('===ここまで==='));
    pass('sectionAsync wraps async fn correctly');
  }

  // ── secret-key-loader ──────────────────────────────────────────────────────
  // ── secret-key-loader ──────────────────────────────────────────────────────

  const loader = require('../tools/secret-key-loader');

  assert.strictEqual(loader.TOOL_META.version, '110.9.0');
  pass('secret-key-loader version');

  // SOURCE enum
  assert.strictEqual(loader.SOURCE.SECRET_MANAGER, 'secret_manager');
  assert.strictEqual(loader.SOURCE.ENV_FALLBACK,   'env_fallback');
  assert.strictEqual(loader.SOURCE.DRY_RUN,        'dry_run');
  assert.strictEqual(loader.SOURCE.NOT_FOUND,      'not_found');
  pass('SOURCE enum values correct');

  // loadKey dryRun=true: never fetches from network, returns valueHidden
  const r1 = await loader.loadKey('OPENAI_API_KEY', { dryRun: true, silent: true });
  assert.strictEqual(r1.dryRun, true);
  assert.strictEqual(r1.realProductActionsExecuted, false);
  assert.strictEqual(r1.dangerousActionsDenied, true);
  assert.strictEqual(r1.valueHidden, true, 'value must be hidden in result');
  assert.ok(!('value' in r1), 'actual value must NOT be present in result');
  assert.ok(
    r1.source === loader.SOURCE.DRY_RUN || r1.source === loader.SOURCE.ENV_FALLBACK,
    `unexpected source: ${r1.source}`
  );
  pass('loadKey dryRun=true returns valueHidden, no actual value');

  // loadKey dryRun=true: env fallback works when env var set
  const TEST_KEY = '_KOSAME_SMOKE_TEST_KEY_V110_9';
  process.env[TEST_KEY] = 'test-value';
  const r2 = await loader.loadKey(TEST_KEY, { dryRun: true, silent: true, envFallback: true });
  assert.strictEqual(r2.source, loader.SOURCE.ENV_FALLBACK);
  assert.strictEqual(r2.keyPresent, true);
  assert.strictEqual(r2.valueHidden, true);
  assert.ok(!('value' in r2), 'value must not be exposed');
  delete process.env[TEST_KEY];
  pass('loadKey dryRun=true uses env fallback when env var set');

  // loadKey dryRun=true: returns not-found-like source when env missing
  const MISSING_KEY = '_KOSAME_DEFINITELY_NOT_SET_V110_9';
  delete process.env[MISSING_KEY];
  const r3 = await loader.loadKey(MISSING_KEY, { dryRun: true, silent: true, envFallback: true });
  assert.strictEqual(r3.keyPresent, false);
  pass('loadKey dryRun=true: missing env var → keyPresent=false');

  // loadKey dryRun=true, envFallback=false → dry_run source
  const r4 = await loader.loadKey('SOME_KEY', { dryRun: true, silent: true, envFallback: false });
  assert.strictEqual(r4.source, loader.SOURCE.DRY_RUN);
  pass('loadKey dryRun=true, envFallback=false → source=dry_run');

  // resolveKeys batch
  const keys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', '_MISSING_KEY_V110_9'];
  const summary = await loader.resolveKeys(keys, { dryRun: true, silent: true });
  assert.strictEqual(summary.tool, 'secret-key-loader');
  assert.strictEqual(summary.version, '110.9.0');
  assert.strictEqual(summary.dryRun, true);
  assert.strictEqual(summary.realProductActionsExecuted, false);
  assert.strictEqual(summary.dangerousActionsDenied, true);
  assert.strictEqual(summary.humanApprovalRequired, true);
  assert.strictEqual(summary.keyCount, 3);
  assert.ok(typeof summary.results === 'object');
  assert.ok('OPENAI_API_KEY' in summary.results);
  assert.ok('GEMINI_API_KEY' in summary.results);
  // verify no value fields leaked
  for (const r of Object.values(summary.results)) {
    assert.ok(!('value' in r), 'value must not be present in summary results');
    assert.ok(['secret_manager','env_fallback','dry_run','not_found'].includes(r.source),
      `unknown source: ${r.source}`);
  }
  pass('resolveKeys batch returns correct structure, no values leaked');

  // resolveKeys with section logger output visible (not silent)
  {
    const outputLines = [];
    const origLog = console.log;
    console.log = (...args) => outputLines.push(args.join(' '));
    const summary2 = await loader.resolveKeys(['OPENAI_API_KEY'], {
      dryRun: true,
      silent: false,
      sectionName: 'smoke-section-test'
    });
    console.log = origLog;
    const output = outputLines.join('\n');
    assert.ok(output.includes('===ここから==='), `resolveKeys must emit ===ここから===, got: ${output.slice(0,200)}`);
    assert.ok(output.includes('===ここまで==='), `resolveKeys must emit ===ここまで===, got: ${output.slice(0,200)}`);
    assert.ok(output.includes('smoke-section-test'), 'section name must appear in output');
    pass('resolveKeys emits ===ここから=== / ===ここまで=== section markers');
  }

  console.log('\nPASS: v110.9 all smoke tests');
}

runAsyncTests().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
