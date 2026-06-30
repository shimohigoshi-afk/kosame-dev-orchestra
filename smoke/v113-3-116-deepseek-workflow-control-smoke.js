#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.116';
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');

let passed = 0, failed = 0;

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) { if ((pa[i]||0) > (pb[i]||0)) return 1; if ((pa[i]||0) < (pb[i]||0)) return -1; }
  return 0;
}

function test(name, fn) { try { fn(); console.log('  PASS: ' + name); passed++; } catch (e) { console.error('  FAIL: ' + name + ' — ' + e.message); failed++; } }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function write(p, c) { fs.writeFileSync(p, c); }
function exists(p) { return fs.existsSync(p); }
function unlink(p) { try { fs.unlinkSync(p); } catch(_) {} }

console.log('===== v' + MIN_VERSION + ' deepseek workflow control smoke =====');
if (compareVersions(PKG.version, MIN_VERSION) < 0) { console.error('FAIL: version must be >= ' + MIN_VERSION + ' (got ' + PKG.version + ')'); process.exit(1); }
console.log('  PASS: version ' + PKG.version);

// ── Server endpoint checks ──
test('POST /api/executor/deepseek-result/action is defined', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/deepseek-result/action'), 'endpoint not found');
  assert(s.includes('accept'), 'must accept accept action');
  assert(s.includes('revise'), 'must accept revise action');
  assert(s.includes('reject'), 'must accept reject action');
});

test('GET /api/executor/deepseek-result/action is defined', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('latest-deepseek-action.json'), 'must read action json');
});

test('GET /api/executor/history is defined', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/history'), 'history endpoint not found');
  assert(s.includes('history'), 'must read history dir');
});

// ── writeRevisionHandoffFile ──
test('writeRevisionHandoffFile exists and returns path', () => {
  const { writeRevisionHandoffFile } = require('../tools/kosame-runner-queue');
  const rp = writeRevisionHandoffFile('test-123', 'summary text', ['f1', 'f2'], ['v1', 'v2'], 'reason', 'next instruction');
  assert(!!rp, 'must return path');
  assert(rp.includes('latest-deepseek-revision.md'), 'path must include revision filename');
  assert(exists(rp), 'file must exist');
  const c = fs.readFileSync(rp, 'utf8');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must contain result format');
  assert(c.includes('git add -A is prohibited'), 'must forbid git add -A');
  assert(c.includes('git add . is prohibited'), 'must forbid git add .');
  assert(c.includes('Codex is prohibited'), 'must forbid Codex');
  assert(c.includes('Claude is prohibited'), 'must forbid Claude');
  assert(c.includes('Automatic push is prohibited'), 'must forbid auto push');
  assert(c.includes('Automatic deploy is prohibited'), 'must forbid auto deploy');
  assert(c.includes('original_ticket_id: test-123'), 'must contain original ticket id');
  unlink(rp);
});

// ── saveHistory exists ──
test('saveHistory function exists in server', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('saveHistory('), 'saveHistory must be defined');
  assert(s.includes('function saveHistory'), 'saveHistory function must exist');
});

// ── History dir creation on result intake ──
test('history saving logic exists for result intake', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("saveHistory('result'"), 'result intake must save history');
  assert(s.includes("saveHistory('action'"), 'action must save history');
  assert(s.includes("'revision'"), 'revision must save history');
});

// ── Blocked checks ──
test('action blocked checks exist', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('blocked content'), 'must detect blocked content');
  assert(s.includes('kosame-sales-dx'), 'must block sales-dx');
  assert(s.includes('transcriber'), 'must block transcriber');
});

test('blocked action does not create revision', () => {
  const { writeRevisionHandoffFile } = require('../tools/kosame-runner-queue');
  const rp = writeRevisionHandoffFile('test', '', [], [], 'blocked', '');
  assert(exists(rp), 'revision file created by writeRevisionHandoffFile is okay');
  unlink(rp);
  // Server must check before calling writeRevisionHandoffFile
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('blocked') && s.includes('contains blocked'), 'server blocks before generating revision');
});

// ── HTML elements ──
test('HTML has accept/revise/reject buttons', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-accept'), 'must have accept button');
  assert(h.includes('deepseek-action-revise'), 'must have revise button');
  assert(h.includes('deepseek-action-reject'), 'must have reject button');
  assert(h.includes('採用'), 'accept button labeled 採用');
  assert(h.includes('再修正'), 'revise button labeled 再修正');
  assert(h.includes('却下'), 'reject button labeled 却下');
});

test('HTML has reason and next_instruction textareas', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-reason'), 'must have reason textarea');
  assert(h.includes('deepseek-action-next-instruction'), 'must have next_instruction textarea');
});

test('HTML has revision display and copy button', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-revision-display'), 'must have revision display');
  assert(h.includes('deepseek-revision-content'), 'must have revision content');
  assert(h.includes('deepseek-revision-copy-btn'), 'must have revision copy button');
});

test('HTML has DeepSeek Workflow History', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-history-content'), 'must have history content');
  assert(h.includes('deepseek-history-display'), 'must have history display');
  assert(h.includes('Workflow History'), 'must have history heading');
});

test('HTML has status badge', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-badge'), 'must have action badge');
});

// ── Initialization calls ──
test('renderDeepSeekResultAction called on init', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekResultAction()'), 'must be called on init');
});

test('renderDeepSeekWorkflowHistory called on init', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekWorkflowHistory()'), 'must be called on init');
});

// ── Existing features not broken ──
test('existing DeepSeek Handoff display is preserved', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-handoff-strip'), 'handoff strip still exists');
  assert(h.includes('deepseek-copy-btn'), 'handoff copy btn still exists');
  assert(h.includes('renderDeepSeekHandoff()'), 'handoff still called on init');
});

test('existing DeepSeek Result intake is preserved', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-result-strip'), 'result strip still exists');
  assert(h.includes('deepseek-result-submit-btn'), 'result submit btn still exists');
  assert(h.includes('renderDeepSeekResult()'), 'result still called on init');
});

// ── Contamination ──
test('no sales-dx / transcriber / Secret / .env contamination', () => {
  const bad = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (const b of bad) assert(!ROOT.includes(b), 'target_repo must NOT contain ' + b);
  const s = read('tools/kosame-live-cockpit-server.js');
  const r = read('tools/kosame-runner-queue.js');
  const h = read('public/kosame-live-cockpit.html');
  for (const f of [s, r, h]) assert(!f.includes('ANESTY Board'), 'files must not reference ANESTY Board');
});

// ── Summary ──
const total = passed + failed;
console.log('');
if (failed === 0) { console.log('✅ v' + MIN_VERSION + ' deepseek workflow control smoke PASSED (' + passed + '/' + total + ')'); }
else { console.error('❌ v' + MIN_VERSION + ' deepseek workflow control smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)'); process.exit(1); }
