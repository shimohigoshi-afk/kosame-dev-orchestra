#!/usr/bin/env node
'use strict';

/**
 * v113.3.114 — DeepSeek handoff UI smoke
 *
 * Verifies:
 * 1. deepseek_patch_required ticket → .kosame-executor/latest-deepseek.md created
 * 2. latest-deepseek.md contains ticket id / target_repo / user prompt / forbidden items
 * 3. .kosame-executor/latest.md contains lane/status/output path
 * 4. GET /api/executor/latest endpoint defined in server
 * 5. GET /api/executor/deepseek-handoff endpoint defined in server
 * 6. HTML has DeepSeek Handoff display area
 * 7. HTML has copy button
 * 8. blocked_with_reason does NOT create latest-deepseek.md
 * 9. No sales-dx / transcriber / Secret / .env contamination
 */

const fs   = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.114';

const APPEND_MARKER = 'KOSAME_APPEND_113_3_114';

let passed = 0;
let failed = 0;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

function test(name, fn) {
  try { fn(); console.log(`  PASS: ${name}`); passed++; }
  catch (e) { console.error(`  FAIL: ${name} — ${e.message}`); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── Imports ───────────────────────────────────────────────────────────────────
const {
  executeDeepSeekHandoff,
  executeBlocked,
  defaultExecutor,
  EXECUTOR_DIR,
} = require('../tools/kosame-runner-queue');

// ── Version check ──
console.log(`===== v${MIN_VERSION} deepseek handoff UI smoke =====`);
if (compareVersions(PKG.version, MIN_VERSION) < 0) {
  console.error(`FAIL: package version must be >= ${MIN_VERSION} (got ${PKG.version})`);
  process.exit(1);
}
console.log(`  PASS: version ${PKG.version}`);

// ── Clean up any previous handoff files ───────────────────────────────────────
const LATEST_MD = path.join(EXECUTOR_DIR, 'latest.md');
const DEEPSEEK_MD = path.join(EXECUTOR_DIR, 'latest-deepseek.md');
if (fs.existsSync(LATEST_MD)) fs.unlinkSync(LATEST_MD);
if (fs.existsSync(DEEPSEEK_MD)) fs.unlinkSync(DEEPSEEK_MD);

// ── Test 1: deepseek_patch_required creates latest-deepseek.md ──────────────
test('deepseek_patch_required creates latest-deepseek.md', () => {
  const runDir = path.join(ROOT, '.kosame-runner', 'runs', `smoke-114-ds-${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });

  const result = executeDeepSeekHandoff(
    { id: 'smoke-114-ds-test', title: 'DS Test',
      prompt_text: 'public/test.html のスクリプトをリファクタしてください', target_repo: ROOT },
    runDir,
    { reason: 'complex task', promptText: 'public/test.html のスクリプトをリファクタしてください' }
  );
  assert(result.executorStatus === 'deepseek_patch_required',
    `expected deepseek_patch_required, got ${result.executorStatus}`);

  assert(fs.existsSync(DEEPSEEK_MD), 'latest-deepseek.md should exist');
  assert(fs.existsSync(LATEST_MD), 'latest.md should exist');
});

// ── Test 2: latest-deepseek.md content check ────────────────────────────────
test('latest-deepseek.md contains required fields', () => {
  const content = fs.readFileSync(DEEPSEEK_MD, 'utf8');
  assert(content.includes('ticket_id: smoke-114-ds-test'), 'should contain ticket id');
  assert(content.includes('/home/lavie/kosame-dev-orchestra'), 'should contain target_repo');
  assert(content.includes('public/test.html のスクリプトをリファクタしてください'), 'should contain user prompt');
  assert(content.includes('git add -A is prohibited'), 'should forbid git add -A');
  assert(content.includes('Codex is prohibited'), 'should forbid Codex');
  assert(content.includes('Claude is prohibited'), 'should forbid Claude');
  assert(content.includes('Sales DX'), 'should forbid Sales DX');
  assert(content.includes('.env'), 'should forbid .env');
});

// ── Test 3: latest.md contains lane/status/output path ──────────────────────
test('latest.md contains lane/status/output path', () => {
  const content = fs.readFileSync(LATEST_MD, 'utf8');
  assert(content.includes('lane: deepseek_patch_required'), 'should contain lane');
  assert(content.includes('status: pending'), 'should contain status');
  assert(content.includes('output_path:'), 'should contain output path');
  assert(content.includes('deepseek_handoff_path:'), 'should contain deepseek handoff path');
});

// ── Test 4: server defines GET /api/executor/latest ─────────────────────────
test('server defines GET /api/executor/latest', () => {
  const server = read('tools/kosame-live-cockpit-server.js');
  assert(server.includes("/api/executor/latest"),
    'server must define /api/executor/latest endpoint');
});

// ── Test 5: server defines GET /api/executor/deepseek-handoff ───────────────
test('server defines GET /api/executor/deepseek-handoff', () => {
  const server = read('tools/kosame-live-cockpit-server.js');
  assert(server.includes("/api/executor/deepseek-handoff"),
    'server must define /api/executor/deepseek-handoff endpoint');
});

// ── Test 6: HTML has DeepSeek Handoff display area ──────────────────────────
test('HTML has DeepSeek Handoff display area', () => {
  const html = read('public/kosame-live-cockpit.html');
  assert(html.includes('deepseek-handoff-strip'), 'HTML should contain deepseek-handoff-strip');
  assert(html.includes('DeepSeek Handoff'), 'HTML should contain "DeepSeek Handoff" text');
  assert(html.includes('deepseek-handoff-content'), 'HTML should contain deepseek-handoff-content');
});

// ── Test 7: HTML has copy button ────────────────────────────────────────────
test('HTML has copy button for DeepSeek handoff', () => {
  const html = read('public/kosame-live-cockpit.html');
  assert(html.includes('deepseek-copy-btn'), 'HTML should contain deepseek-copy-btn');
  assert(html.includes('renderDeepSeekHandoff'), 'HTML should define renderDeepSeekHandoff');
});

// ── Test 8: blocked_with_reason does NOT create latest-deepseek.md ──────────
test('blocked_with_reason does not create latest-deepseek.md', () => {
  if (fs.existsSync(DEEPSEEK_MD)) fs.unlinkSync(DEEPSEEK_MD);

  const runDir = path.join(ROOT, '.kosame-runner', 'runs', `smoke-114-block-${Date.now()}`);
  fs.mkdirSync(runDir, { recursive: true });

  const result = executeBlocked(
    { id: 'smoke-114-blocked-test', title: 'Block Test',
      prompt_text: 'KOSAME_TEST を ../secret.txt に追記', target_repo: ROOT },
    runDir,
    { reason: 'path traversal detected' }
  );
  assert(result.executorStatus === 'blocked_with_reason',
    `expected blocked_with_reason, got ${result.executorStatus}`);
  assert(!fs.existsSync(DEEPSEEK_MD), 'latest-deepseek.md should NOT exist for blocked');
  assert(fs.existsSync(LATEST_MD), 'latest.md should still exist');
  const latestContent = fs.readFileSync(LATEST_MD, 'utf8');
  assert(latestContent.includes('path traversal detected'), 'latest.md should contain blocked reason');
});

// ── Test 9: no sales-dx / transcriber / Secret / .env contamination ─────────
test('no sales-dx / transcriber / Secret / .env contamination', () => {
  const badPaths = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (const bad of badPaths) {
    assert(!ROOT.includes(bad), `target_repo must NOT contain ${bad}`);
  }
  const html = read('public/kosame-live-cockpit.html');
  const server = read('tools/kosame-live-cockpit-server.js');
  const runner = read('tools/kosame-runner-queue.js');
  for (const f of [html, server, runner]) {
    assert(!f.includes('ANESTY Board'), 'files must not reference ANESTY Board');
  }
});

// ── Test 10: renderDeepSeekHandoff called on init ───────────────────────────
test('renderDeepSeekHandoff called on initialization', () => {
  const html = read('public/kosame-live-cockpit.html');
  assert(html.includes('renderDeepSeekHandoff()'), 'renderDeepSeekHandoff must be called on init');
});

// ── Cleanup handoff files ────────────────────────────────────────────────────
try { if (fs.existsSync(DEEPSEEK_MD)) fs.unlinkSync(DEEPSEEK_MD); } catch (_) {}
try { if (fs.existsSync(LATEST_MD)) fs.unlinkSync(LATEST_MD); } catch (_) {}

// ── Summary ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('');
if (failed === 0) {
  console.log(`✅ v${MIN_VERSION} deepseek handoff UI smoke PASSED (${passed}/${total})`);
} else {
  console.error(`❌ v${MIN_VERSION} deepseek handoff UI smoke FAILED (${passed}/${total}, ${failed} failures)`);
  process.exit(1);
}
