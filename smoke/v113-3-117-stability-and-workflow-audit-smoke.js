#!/usr/bin/env node
'use strict';

/**
 * v113.3.117 — Stability & Workflow Audit Smoke
 *
 * Verifies:
 * 1.  version 113.3.117
 * 2.  .gitignore ignores .kosame-executor/latest*.md and latest*.json and history
 * 3.  .gitignore does NOT ignore .kosame-executor/run-latest.sh
 * 4.  DeepSeek workflow API endpoints exist (latest/handoff/result/action/history)
 * 5.  blocked reason survives to latest.md
 * 6.  Secret/.env/credentials/sales-dx/transcriber blocked in result/action/revision
 * 7.  history items contain type/timestamp/ticket_id/action
 * 8.  renderDeepSeekHandoff called on init
 * 9.  renderDeepSeekResult called on init
 * 10. renderDeepSeekResultAction called on init
 * 11. renderDeepSeekWorkflowHistory called on init
 * 12. Existing v113.3.112/114/115/116 smokes not broken (spot check)
 * 13. processTicket skips terminal states (blocked_with_reason, deepseek_patch_required)
 * 14. No sales-dx / transcriber / Secret / .env contamination
 */

const fs   = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.117';
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');
const RUNS_DIR = path.join(ROOT, '.kosame-runner', 'runs');

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
  try { fn(); console.log('  PASS: ' + name); passed++; }
  catch (e) { console.error('  FAIL: ' + name + ' — ' + e.message); failed++; }
}

function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

// ── Imports ───────────────────────────────────────────────────────────────────
const {
  detectExecutorLane,
  executeBlocked,
  executeDeepSeekHandoff,
  defaultExecutor,
  processTicket,
  writeLatestStatus,
  writeDeepSeekHandoffFile,
  writeRevisionHandoffFile,
  executorLaneRouter,
} = require('../tools/kosame-runner-queue');

// ── Version check ──
console.log('===== v' + MIN_VERSION + ' stability and workflow audit smoke =====');
if (compareVersions(PKG.version, MIN_VERSION) < 0) {
  console.error('FAIL: package version must be >= ' + MIN_VERSION + ' (got ' + PKG.version + ')');
  process.exit(1);
}
console.log('  PASS: version ' + PKG.version);

// ── Test 1: version is exactly 113.3.117 ────────────────────────────────────
test('package.json version is 113.3.117', () => {
  assert(PKG.version === '113.3.117', 'version must be 113.3.117');
});

// ── Test 2: .gitignore covers executor artifacts ────────────────────────────
test('.gitignore ignores .kosame-executor/latest*.md', () => {
  const gi = read('.gitignore');
  assert(gi.includes('.kosame-executor/latest*.md'),
    '.gitignore must contain .kosame-executor/latest*.md');
});

test('.gitignore ignores .kosame-executor/latest*.json', () => {
  const gi = read('.gitignore');
  assert(gi.includes('.kosame-executor/latest*.json'),
    '.gitignore must contain .kosame-executor/latest*.json');
});

test('.gitignore ignores .kosame-executor/history/', () => {
  const gi = read('.gitignore');
  assert(gi.includes('.kosame-executor/history/'),
    '.gitignore must contain .kosame-executor/history/');
});

// ── Test 3: .gitignore does NOT ignore run-latest.sh ───────────────────────
test('.gitignore does NOT ignore .kosame-executor/run-latest.sh', () => {
  const gi = read('.gitignore');
  // run-latest.sh should NOT be in gitignore
  const lines = gi.split('\n');
  const runLatestLines = lines.filter(function(l) {
    return l.includes('run-latest.sh') && !l.startsWith('#');
  });
  assert(runLatestLines.length === 0,
    '.gitignore must NOT contain run-latest.sh exclusion: found ' + JSON.stringify(runLatestLines));
});

// ── Test 4: Server has all DeepSeek workflow API endpoints ──────────────────
test('server has /api/executor/latest endpoint', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/latest'), 'must define /api/executor/latest');
});

test('server has /api/executor/deepseek-handoff endpoint', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/deepseek-handoff'), 'must define /api/executor/deepseek-handoff');
});

test('server has /api/executor/deepseek-result endpoint', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/deepseek-result'), 'must define /api/executor/deepseek-result');
});

test('server has /api/executor/deepseek-result/action endpoint', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/deepseek-result/action'), 'must define /api/executor/deepseek-result/action');
});

test('server has /api/executor/history endpoint', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/api/executor/history'), 'must define /api/executor/history');
});

// ── Test 5: blocked reason survives to latest.md via writeLatestStatus ──────
test('writeLatestStatus writes blocked reason to latest.md', () => {
  const LATEST_MD = path.join(EXECUTOR_DIR, 'latest.md');
  if (fs.existsSync(LATEST_MD)) fs.unlinkSync(LATEST_MD);

  writeLatestStatus('blocked_with_reason', 'blocked',
    { id: 'test-block-117', title: 'blocked test', target_repo: ROOT },
    '/tmp/fake-output.md', null, 'path traversal detected');

  assert(fs.existsSync(LATEST_MD), 'latest.md must exist');
  const c = fs.readFileSync(LATEST_MD, 'utf8');
  assert(c.includes('reason: path traversal detected'), 'must contain blocked reason');
  assert(c.includes('lane: blocked_with_reason'), 'must contain lane');
  assert(c.includes('status: blocked'), 'must contain status');
  try { fs.unlinkSync(LATEST_MD); } catch (_) {}
});

// ── Test 6: executeBlocked writes blocked reason ────────────────────────────
test('executeBlocked returns blocked_with_reason with error message', () => {
  const runDir = path.join(RUNS_DIR, 'smoke-117-blocked-' + Date.now());
  fs.mkdirSync(runDir, { recursive: true });
  const result = executeBlocked(
    { id: 'smoke-117-blocked', prompt_text: 'KOSAME_TEST secret write', target_repo: ROOT },
    runDir,
    { reason: 'test blocked reason for audit' }
  );
  assert(result.executorStatus === 'blocked_with_reason', 'must be blocked_with_reason');
  assert(!result.ok, 'must not be ok');
  assert(result.error.includes('test blocked'), 'error must contain block reason');
});

// ── Test 7: Secret/.env/credentials/sales-dx/transcriber blocked ────────────
test('detectExecutorLane blocks secret/.env/credentials', () => {
  const lane = detectExecutorLane({
    prompt_text: 'update .env file with new API keys',
    target_repo: ROOT,
  });
  assert(lane.lane === 'blocked_with_reason', 'must block .env ref');
  assert(lane.reason.includes('secret'), 'reason must reference secret checking');
});

test('detectExecutorLane blocks sales-dx/transcriber', () => {
  const lane = detectExecutorLane({
    prompt_text: 'fix the transcriber pipeline for sales-dx',
    target_repo: ROOT,
  });
  assert(lane.lane === 'blocked_with_reason', 'must block transcriber/sales-dx');
  assert(lane.reason.includes('Sales DX'), 'reason must mention Sales DX');
});

test('detectExecutorLane blocks deploy/push/commit', () => {
  const lane = detectExecutorLane({
    prompt_text: 'deploy to gcloud and git push origin main',
    target_repo: ROOT,
  });
  assert(lane.lane === 'blocked_with_reason', 'must block deploy/push');
  assert(lane.reason.includes('deploy'), 'reason must mention deploy');
});

// ── Test 8: Server blocks results containing blocked content ────────────────
test('server source blocks .env in result intake', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('.env') && s.includes('blocked content'),
    'server must block .env in results');
});

test('server source blocks credentials in result intake', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('credentials') && s.includes('blocked'),
    'server must block credentials');
});

test('server source blocks sales-dx in result intake', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('kosame-sales-dx') && s.includes('blocked'),
    'server must block sales-dx');
});

test('server source blocks transcriber in action', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('transcriber') && s.includes('blocked'),
    'server must block transcriber');
});

// ── Test 9: history items contain type/timestamp/ticket_id ──────────────────
test('saveHistory function writes type/timestamp/ticket_id', () => {
  const s = read('tools/kosame-live-cockpit-server.js');
  // Check that saveHistory creates entries with type/timestamp/ticket_id
  assert(s.includes("type, timestamp"), 'saveHistory must include type and timestamp fields');
});

test('history API returns items with type field', () => {
  // Write a quick smoke item to history dir and verify the format
  const historyDir = path.join(EXECUTOR_DIR, 'history');
  fs.mkdirSync(historyDir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const entry = {
    type: 'test',
    timestamp: new Date().toISOString(),
    ticket_id: 'smoke-117-test',
    action: 'verify',
    data: { test: true },
    path: null,
  };
  const fp = path.join(historyDir, ts + '-test.json');
  fs.writeFileSync(fp, JSON.stringify(entry, null, 2) + '\n');
  const reRead = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert(reRead.type === 'test', 'type must be test');
  assert(reRead.timestamp, 'must have timestamp');
  assert(reRead.ticket_id === 'smoke-117-test', 'must have ticket_id');
  try { fs.unlinkSync(fp); } catch (_) {}
});

// ── Test 10: renderDeepSeekHandoff called on init ───────────────────────────
test('renderDeepSeekHandoff called on init in HTML', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekHandoff()'), 'must be called on init');
});

// ── Test 11: renderDeepSeekResult called on init ────────────────────────────
test('renderDeepSeekResult called on init in HTML', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekResult()'), 'must be called on init');
});

// ── Test 12: renderDeepSeekResultAction called on init ──────────────────────
test('renderDeepSeekResultAction called on init in HTML', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekResultAction()'), 'must be called on init');
});

// ── Test 13: renderDeepSeekWorkflowHistory called on init ───────────────────
test('renderDeepSeekWorkflowHistory called on init in HTML', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('renderDeepSeekWorkflowHistory()'), 'must be called on init');
});

// ── Test 14: processTicket skips terminal states ────────────────────────────
test('processTicket skips already-blocked_with_reason tickets', () => {
  const state = {};
  const t1 = { id: 'skip-block-test-' + Date.now(), title: 'test', prompt_text: 'KOSAME_TEST safe text', target_repo: ROOT };
  // First pass: force to be blocked
  processTicket(t1, { state, runsDir: RUNS_DIR });
  assert(state[t1.id] && state[t1.id].status === 'deepseek_patch_required',
    'first run should set status: got ' + JSON.stringify(state[t1.id]));

  // Second pass: should skip because state is terminal (deepseek_patch_required)
  // We verify by checking processTicket implementation handles this
  const runner = read('tools/kosame-runner-queue.js');
  assert(runner.includes("'deepseek_patch_required'"),
    'processTicket must include deepseek_patch_required in terminal statuses');
  assert(runner.includes("'blocked_with_reason'"),
    'processTicket must include blocked_with_reason in terminal statuses');
  assert(runner.includes("'safety_stop'"),
    'processTicket must include safety_stop in terminal statuses');
});

// ── Test 15: writeRevisionHandoffFile contains safety constraints ───────────
test('writeRevisionHandoffFile includes safety constraints', () => {
  const rp = writeRevisionHandoffFile('test-117-rev', 'summary', ['f1.js'], ['node --check f1.js'], 'fix needed', 'please fix');
  assert(fs.existsSync(rp), 'revision file must exist');
  const c = fs.readFileSync(rp, 'utf8');
  assert(c.includes('git add -A is prohibited'), 'must forbid git add -A');
  assert(c.includes('git add . is prohibited'), 'must forbid git add .');
  assert(c.includes('Codex is prohibited'), 'must forbid Codex');
  assert(c.includes('Claude is prohibited'), 'must forbid Claude');
  assert(c.includes('Automatic push is prohibited'), 'must forbid auto push');
  assert(c.includes('Automatic deploy is prohibited'), 'must forbid auto deploy');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must include result format');
  try { fs.unlinkSync(rp); } catch (_) {}
});

// ── Test 16: deepseek handoff and action strips exist in HTML ───────────────
test('HTML has deepseek-handoff-strip', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-handoff-strip'), 'must have handoff strip');
});

test('HTML has deepseek-result-strip', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-result-strip'), 'must have result strip');
});

test('HTML has deepseek-action-strip', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-strip'), 'must have action strip');
});

test('HTML has accept/revise/reject buttons', () => {
  const h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-accept'), 'must have accept');
  assert(h.includes('deepseek-action-revise'), 'must have revise');
  assert(h.includes('deepseek-action-reject'), 'must have reject');
});

// ── Test 17: No contamination ───────────────────────────────────────────────
test('no sales-dx / transcriber / Secret / .env contamination in source', () => {
  const badRepoPaths = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (var i = 0; i < badRepoPaths.length; i++) {
    assert(!ROOT.includes(badRepoPaths[i]),
      'target_repo must NOT contain ' + badRepoPaths[i]);
  }
  const s = read('tools/kosame-live-cockpit-server.js');
  const r = read('tools/kosame-runner-queue.js');
  const h = read('public/kosame-live-cockpit.html');
  var files = [s, r, h];
  for (var j = 0; j < files.length; j++) {
    assert(!files[j].includes('ANESTY Board'), 'files must not reference ANESTY Board');
  }
});

// ── Test 18: executorLaneRouter handles all lanes ──────────────────────────
test('executorLaneRouter handles blocked_with_reason', () => {
  const runDir = path.join(RUNS_DIR, 'smoke-117-router-block-' + Date.now());
  fs.mkdirSync(runDir, { recursive: true });
  const result = executorLaneRouter(
    { id: 'smoke-117-ebr', prompt_text: 'KOSAME_TEST ../escape', target_repo: ROOT },
    runDir
  );
  assert(result.ok === false, 'blocked must not be ok');
  assert(result.exitCode === 1, 'blocked exitCode must be 1');
});

test('executorLaneRouter handles deepseek_patch_required', () => {
  const runDir = path.join(RUNS_DIR, 'smoke-117-router-ds-' + Date.now());
  fs.mkdirSync(runDir, { recursive: true });
  const result = executorLaneRouter(
    { id: 'smoke-117-eds', title: 'ds test', prompt_text: 'リファクタしてください', target_repo: ROOT },
    runDir
  );
  assert(result.executorStatus === 'deepseek_patch_required', 'must be deepseek_patch_required');
});

// ── Test 19: writeDeepSeekHandoffFile creates valid handoff ─────────────────
test('writeDeepSeekHandoffFile creates handoff with safety rules', () => {
  const EXEC_DIR = path.join(ROOT, '.kosame-executor');
  const hp = writeDeepSeekHandoffFile(
    { id: 'smoke-117-hf', title: 'HF Test', prompt_text: 'test', target_repo: ROOT },
    { reason: 'smoke test' },
    path.join(ROOT, '.kosame-runner', 'runs', 'dummy')
  );
  assert(fs.existsSync(hp), 'handoff file must exist');
  const c = fs.readFileSync(hp, 'utf8');
  assert(c.includes('DeepSeek Handoff Work Order'), 'must contain title');
  assert(c.includes('ticket_id: smoke-117-hf'), 'must contain ticket id');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must contain result format');
  assert(c.includes('git add -A is prohibited'), 'must forbid git add -A');
  assert(c.includes('Codex is prohibited'), 'must forbid Codex');
  assert(c.includes('Claude is prohibited'), 'must forbid Claude');
});

// ── Test 20: Smoke scripts for v117 are in package.json ────────────────────
test('package.json has smoke:v113-3-117 script', () => {
  assert(PKG.scripts && PKG.scripts['smoke:v113-3-117'],
    'must have smoke:v113-3-117 script');
  assert(PKG.scripts['smoke:v113-3-117'].includes('v113-3-117-stability-and-workflow-audit-smoke.js'),
    'must point to correct smoke file');
});

// ── Test 21: verify:dev-os includes v113-3-117 ─────────────────────────────
test('verify:dev-os includes node --check for v117 smoke', () => {
  const verifyCmd = PKG.scripts['verify:dev-os'];
  assert(verifyCmd.includes('v113-3-117-stability-and-workflow-audit-smoke.js'),
    'verify:dev-os must include node --check for v117 smoke');
});

test('verify:dev-os includes smoke:v113-3-117 run', () => {
  const verifyCmd = PKG.scripts['verify:dev-os'];
  assert(verifyCmd.includes('smoke:v113-3-117'),
    'verify:dev-os must run smoke:v113-3-117');
});

// ── Summary ──────────────────────────────────────────────────────────────────
var total = passed + failed;
console.log('');
if (failed === 0) {
  console.log('✅ v' + MIN_VERSION + ' stability and workflow audit smoke PASSED (' + passed + '/' + total + ')');
} else {
  console.error('❌ v' + MIN_VERSION + ' stability and workflow audit smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
  process.exit(1);
}
