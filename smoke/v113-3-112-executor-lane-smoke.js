#!/usr/bin/env node
'use strict';

/**
 * v113.3.112 — Executor lane smoke
 *
 * Verifies:
 * 1. local_append: append marker to public/test.html → completed
 * 2. local_replace: replace text in public/test.html → completed
 * 3. local_create_file: create public/test2.html with marker → completed
 * 4. local_small_html_css_patch: change h1 in public/test.html → completed
 * 5. no-op: replace with non-existent source → NOT completed
 * 6. deepseek_patch_required: complex JS refactoring → not completed
 * 7. blocked_with_reason: path traversal → blocked_with_reason
 * 8. blocked_with_reason: sales-dx path → blocked_with_reason
 * 9. completed operations record git diff or hash change in output.md
 */

const fs   = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.112';

const APPEND_MARKER  = 'KOSAME_APPEND_113_3_112';
const CREATE_MARKER  = 'KOSAME_CREATE_113_3_112';
const HEADING_MARKER = 'KOSAME_HEADING_113_3_112';

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

function makeRunDir(label) {
  const dir = path.join(ROOT, '.kosame-runner', 'runs', `smoke-112-${label}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function sha1(p) {
  return crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
}

// ── Imports ───────────────────────────────────────────────────────────────────
const {
  detectExecutorLane,
  executeLocalAppend,
  executeLocalReplace,
  executeLocalCreateFile,
  executeLocalSmallPatch,
  executeDeepSeekHandoff,
  executeBlocked,
  defaultExecutor,
} = require('../tools/kosame-runner-queue');

// ── Version check ──
console.log(`===== v${MIN_VERSION} executor lane smoke =====`);
if (compareVersions(PKG.version, MIN_VERSION) < 0) {
  console.error(`FAIL: package version must be >= ${MIN_VERSION} (got ${PKG.version})`);
  process.exit(1);
}
console.log(`  PASS: version ${PKG.version}`);

// ── Setup: save original test.html and restore canonical state ──────────────
const TEST_HTML_PATH = path.join(ROOT, 'public', 'test.html');
const TEST_HTML_BAK  = path.join(ROOT, 'public', '.test.html.bak.112');
fs.writeFileSync(TEST_HTML_BAK, fs.readFileSync(TEST_HTML_PATH));

// Canonical test.html: h1 = Hello World, no extra markers beyond existing
const CANONICAL_HTML = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';
fs.writeFileSync(TEST_HTML_PATH, CANONICAL_HTML);

// ── Lane Detection Tests ──────────────────────────────────────────────────────

test('detectExecutorLane local_append', () => {
  const lane = detectExecutorLane({
    prompt_text: `public/test.html に ${APPEND_MARKER} を追記してください`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'local_append', `expected local_append, got ${lane.lane}`);
  assert(lane.filePath === 'public/test.html');
  assert(lane.content === APPEND_MARKER);
});

test('detectExecutorLane local_replace', () => {
  const lane = detectExecutorLane({
    prompt_text: `public/test.html の Hello World を Hello KOSAME に置換`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'local_replace', `expected local_replace, got ${lane.lane}`);
  assert(lane.oldText === 'Hello World');
  assert(lane.newText === 'Hello KOSAME');
});

test('detectExecutorLane local_create_file', () => {
  const lane = detectExecutorLane({
    prompt_text: `public/test2.html を作成して ${CREATE_MARKER} を入れる`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'local_create_file', `expected local_create_file, got ${lane.lane}`);
  assert(lane.filePath === 'public/test2.html');
  assert(lane.content === CREATE_MARKER);
});

test('detectExecutorLane local_small_html_css_patch', () => {
  const lane = detectExecutorLane({
    prompt_text: `public/test.html のh1を ${HEADING_MARKER} に変更`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'local_small_html_css_patch', `expected local_small_html_css_patch, got ${lane.lane}`);
  assert(lane.patchType === 'heading');
  assert(lane.newContent === HEADING_MARKER);
});

test('detectExecutorLane deepseek_patch_required', () => {
  const lane = detectExecutorLane({
    prompt_text: `public/test.html のスクリプトをリファクタして関数を分割してください`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'deepseek_patch_required', `expected deepseek_patch_required, got ${lane.lane}`);
});

test('detectExecutorLane blocked_with_reason path traversal', () => {
  const lane = detectExecutorLane({
    prompt_text: `KOSAME_TEST を ../secret.txt に追記`,
    target_repo: ROOT,
  });
  assert(lane.lane === 'blocked_with_reason');
  assert(lane.reason.includes('path traversal'));
});

test('detectExecutorLane blocked_with_reason target_repo mismatch', () => {
  const lane = detectExecutorLane({
    prompt_text: `/home/lavie/repos/kosame-sales-dx のファイルを修正`,
    target_repo: '/home/lavie/repos/kosame-sales-dx',
  });
  assert(lane.lane === 'blocked_with_reason');
  assert(lane.reason.includes('target_repo'));
});

// ── Execution Tests ───────────────────────────────────────────────────────────

test('executeLocalAppend appends marker and records hash/diff', () => {
  const runDir = makeRunDir('append');
  const result = executeLocalAppend(
    { id: 'smoke-112-append', prompt_text: `public/test.html に ${APPEND_MARKER} を追記`, target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', content: APPEND_MARKER }
  );
  assert(result.ok === true, `expected ok=true, got ${JSON.stringify(result)}`);
  const updated = fs.readFileSync(TEST_HTML_PATH, 'utf8');
  assert(updated.includes(APPEND_MARKER), `marker ${APPEND_MARKER} not found`);
  const outputMd = fs.readFileSync(path.join(runDir, 'output.md'), 'utf8');
  assert(outputMd.includes('after_hash') || outputMd.includes('git diff'),
    `output.md should contain hash or diff info, got: ${outputMd.slice(0, 200)}`);
});

test('executeLocalReplace replaces text and records hash/diff', () => {
  // Ensure h1 says Hello World
  const current = fs.readFileSync(TEST_HTML_PATH, 'utf8');
  if (!current.includes('Hello World')) {
    const restored = current.replace(/<h1[^>]*>.*?<\/h1>/i, '<h1>Hello World</h1>');
    fs.writeFileSync(TEST_HTML_PATH, restored, 'utf8');
  }
  const beforeHash = sha1(TEST_HTML_PATH);

  const runDir = makeRunDir('replace');
  const result = executeLocalReplace(
    { id: 'smoke-112-replace', prompt_text: `public/test.html の Hello World を Hello KOSAME に置換`, target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', oldText: 'Hello World', newText: 'Hello KOSAME' }
  );
  assert(result.ok === true, `expected ok=true, got ${JSON.stringify(result)}`);

  const afterHash = sha1(TEST_HTML_PATH);
  assert(beforeHash !== afterHash, 'file hash should change after replace');

  const updated = fs.readFileSync(TEST_HTML_PATH, 'utf8');
  assert(updated.includes('Hello KOSAME'), 'Hello KOSAME should be present');
});

test('executeLocalCreateFile creates file with marker', () => {
  const testPath = path.join(ROOT, 'public', 'test3.html');
  if (fs.existsSync(testPath)) fs.unlinkSync(testPath);

  const runDir = makeRunDir('create');
  const result = executeLocalCreateFile(
    { id: 'smoke-112-create', prompt_text: `public/test3.html を作成して ${CREATE_MARKER} を入れる`, target_repo: ROOT },
    runDir,
    { filePath: 'public/test3.html', content: CREATE_MARKER }
  );
  assert(result.ok === true, `expected ok=true, got ${JSON.stringify(result)}`);
  assert(fs.existsSync(testPath), 'test3.html should exist');
  assert(fs.readFileSync(testPath, 'utf8').includes(CREATE_MARKER));
  fs.unlinkSync(testPath);

  const outputMd = fs.readFileSync(path.join(runDir, 'output.md'), 'utf8');
  assert(outputMd.includes('after_hash') || outputMd.includes('git diff'),
    `output.md should contain hash or diff info`);
});

test('executeLocalSmallPatch changes h1 heading', () => {
  // Ensure h1 says something different from HEADING_MARKER
  const current = fs.readFileSync(TEST_HTML_PATH, 'utf8');
  const restored = current.replace(/<h1[^>]*>.*?<\/h1>/i, '<h1>Hello World</h1>');
  fs.writeFileSync(TEST_HTML_PATH, restored, 'utf8');
  const beforeHash = sha1(TEST_HTML_PATH);

  const runDir = makeRunDir('heading');
  const result = executeLocalSmallPatch(
    { id: 'smoke-112-heading', prompt_text: `public/test.html のh1を ${HEADING_MARKER} に変更`, target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', newContent: HEADING_MARKER, patchType: 'heading' }
  );
  assert(result.ok === true, `expected ok=true, got ${JSON.stringify(result)}`);

  const afterHash = sha1(TEST_HTML_PATH);
  assert(beforeHash !== afterHash, 'file hash should change after heading patch');

  const updated = fs.readFileSync(TEST_HTML_PATH, 'utf8');
  assert(updated.includes(`<h1>${HEADING_MARKER}</h1>`),
    `expected h1 with ${HEADING_MARKER}`);
});

test('executeLocalReplace no-op on non-existent oldText', () => {
  const runDir = makeRunDir('noop');
  const result = executeLocalReplace(
    { id: 'smoke-112-noop', prompt_text: `public/test.html の NONEXISTENT_GHOST_TEXT を Hello に置換`, target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', oldText: 'NONEXISTENT_GHOST_TEXT', newText: 'Hello' }
  );
  assert(result.ok === false, `expected ok=false for no-op, got ${JSON.stringify(result)}`);
  assert(result.error && result.error.includes('not found'),
    `error should mention not found, got ${result.error}`);
});

test('executeDeepSeekHandoff generates handoff doc', () => {
  const runDir = makeRunDir('deepseek');
  const result = executeDeepSeekHandoff(
    { id: 'smoke-112-ds', title: 'JS refactor',
      prompt_text: 'public/test.html のスクリプトをリファクタ', target_repo: ROOT },
    runDir,
    { reason: 'complex JS refactoring required' }
  );
  assert(result.executorStatus === 'deepseek_patch_required',
    `expected deepseek_patch_required, got ${result.executorStatus}`);

  const outputMd = fs.readFileSync(path.join(runDir, 'output.md'), 'utf8');
  assert(outputMd.includes('DeepSeek Patch Required'), 'output.md should mention DeepSeek');
  assert(outputMd.includes('complex JS refactoring required'), 'output.md should include reason');

  const verifyLog = fs.readFileSync(path.join(runDir, 'verify.log'), 'utf8');
  assert(verifyLog.includes('deepseek_patch_required'), 'verify.log should indicate status');
});

test('executeBlocked writes blocked reason', () => {
  const runDir = makeRunDir('blocked');
  const result = executeBlocked(
    { id: 'smoke-112-blocked', prompt_text: '../secret.txt を修正', target_repo: ROOT },
    runDir,
    { reason: 'test blocked reason' }
  );
  assert(result.executorStatus === 'blocked_with_reason',
    `expected blocked_with_reason, got ${result.executorStatus}`);
  assert(result.error === 'test blocked reason');

  const outputMd = fs.readFileSync(path.join(runDir, 'output.md'), 'utf8');
  assert(outputMd.includes('test blocked reason'), 'output.md should include reason');
});

test('defaultExecutor routes append through lane router', () => {
  const runDir = makeRunDir('router-append');
  const result = defaultExecutor(
    { id: 'smoke-112-router', prompt_text: `public/test.html に KOSAME_ROUTER_TEST を追記`, target_repo: ROOT },
    runDir
  );
  assert(result.ok === true, `expected ok=true from lane router, got ${JSON.stringify(result)}`);
});

test('defaultExecutor routes blocked through lane router', () => {
  const runDir = makeRunDir('router-blocked');
  const result = defaultExecutor(
    { id: 'smoke-112-blocked-router', prompt_text: `KOSAME_TEST を ../escaped.txt に追記`, target_repo: ROOT },
    runDir
  );
  assert(result.ok === false, `expected ok=false for blocked, got ${JSON.stringify(result)}`);
});

test('no sales-dx / transcriber contamination', () => {
  const badPaths = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (const bad of badPaths) {
    assert(!ROOT.includes(bad), `target_repo must NOT contain ${bad}`);
  }
});

// ── Teardown: restore original test.html ──────────────────────────────────────
fs.writeFileSync(TEST_HTML_PATH, fs.readFileSync(TEST_HTML_BAK));
fs.unlinkSync(TEST_HTML_BAK);

// ── Summary ──────────────────────────────────────────────────────────────────
const total = passed + failed;
console.log('');
if (failed === 0) {
  console.log(`✅ v${MIN_VERSION} executor lane smoke PASSED (${passed}/${total})`);
} else {
  console.error(`❌ v${MIN_VERSION} executor lane smoke FAILED (${passed}/${total}, ${failed} failures)`);
  process.exit(1);
}
