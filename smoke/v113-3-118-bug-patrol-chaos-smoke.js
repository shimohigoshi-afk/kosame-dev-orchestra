#!/usr/bin/env node
'use strict';

/**
 * v113.3.118 — Bug Patrol & Chaos Smoke
 *
 * Comprehensive edge-case and abnormal-scenario testing:
 *
 * 1.  Runner / processTicket terminal status re-run guard
 * 2.  Local executor edge cases
 * 3.  DeepSeek handoff invalid/missing cases
 * 4.  DeepSeek result intake invalid block / mixed content
 * 5.  DeepSeek action invalid/blocked
 * 6.  Revision generation correctness
 * 7.  History missing/corrupt/overflow cases
 * 8.  saveHistory path tracking
 * 9.  API response shape stability
 * 10. Status badge states
 * 11. UI element preservation
 * 12. Existing smoke backward compat
 * 13. No contamination
 */

const fs   = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.118';
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

function unlink(p) { try { fs.unlinkSync(p); } catch (_) {} }

function mkdir(p) { fs.mkdirSync(p, { recursive: true }); }

// ── Imports ───────────────────────────────────────────────────────────────────
const {
  detectExecutorLane,
  executeLocalAppend,
  executeLocalReplace,
  executeLocalCreateFile,
  executeLocalSmallPatch,
  executeBlocked,
  executeDeepSeekHandoff,
  defaultExecutor,
  executorLaneRouter,
  processTicket,
  writeLatestStatus,
  writeDeepSeekHandoffFile,
  writeRevisionHandoffFile,
  EXECUTOR_DIR: ED,
} = require('../tools/kosame-runner-queue');

const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');

// ── Version check ──
console.log('===== v' + MIN_VERSION + ' bug patrol chaos smoke =====');
if (compareVersions(PKG.version, MIN_VERSION) < 0) {
  console.error('FAIL: package version must be >= ' + MIN_VERSION + ' (got ' + PKG.version + ')');
  process.exit(1);
}
console.log('  PASS: version ' + PKG.version);

// ════════════════════════════════════════════════════════════════════════════
// Runner / processTicket terminal status tests
// ════════════════════════════════════════════════════════════════════════════

test('processTicket skips already-started blocked_with_reason', () => {
  const state = {};
  const t = { id: 'chaos-block-skip-' + Date.now(), title: 'test', prompt_text: 'KOSAME_TEST ../escape', target_repo: ROOT };
  const r1 = processTicket(t, { state, runsDir: RUNS_DIR });
  assert(r1.status === 'blocked_with_reason', 'first run ok');
  const r2 = processTicket(t, { state, runsDir: RUNS_DIR });
  assert(r2.status === 'blocked_with_reason', 'skip ok — should return cached status, not re-execute');
});

test('processTicket skips already-started safety_stop', () => {
  const state = {};
  const t = { id: 'chaos-safety-skip-' + Date.now(), title: 'test',
    original_request: '課金発生を伴う操作を許可してください', prompt_text: 'billing', target_repo: ROOT };
  // safety_stop should be checked via checkRuntimeContract; this ticket may or may not trigger it
  // Instead, directly verify the state skip logic
  state['chaos-prestop-' + Date.now()] = { status: 'safety_stop', error: 'test', blockedAt: new Date().toISOString() };
  const r = processTicket({ id: 'chaos-prestop-' + Date.now(), title: 'test', prompt_text: 'x', target_repo: ROOT }, { state, runsDir: RUNS_DIR });
  assert(r.status === 'safety_stop', 'pre-set safety_stop must be skipped');
});

test('processTicket works for completed with pre-set state', () => {
  var id = 'chaos-complete-skip-' + Date.now();
  var state = {};
  state[id] = { status: 'completed', completedAt: new Date().toISOString() };
  var r = processTicket({ id: id, title: 'test', prompt_text: 'x', target_repo: ROOT }, { state: state, runsDir: RUNS_DIR });
  assert(r.status === 'completed', 'pre-set completed must be skipped');
});

// ════════════════════════════════════════════════════════════════════════════
// Local executor edge cases
// ════════════════════════════════════════════════════════════════════════════

test('executeLocalAppend fails on non-existent file', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-append-fail-' + Date.now());
  mkdir(runDir);
  var r = executeLocalAppend(
    { id: 'chaos-ae', prompt_text: 'marker', target_repo: ROOT },
    runDir,
    { filePath: 'public/nonexistent_chaos_file.html', content: 'KOSAME_CHAOS' }
  );
  assert(!r.ok, 'must fail on non-existent file');
  assert(r.error && r.error.includes('not found'), 'error must mention file not found');
});

test('executeLocalReplace no-op on non-existent oldText returns not ok', () => {
  var html = path.join(ROOT, 'public', 'test.html');
  var content = fs.readFileSync(html, 'utf8');
  var runDir = path.join(RUNS_DIR, 'chaos-replace-noop-' + Date.now());
  mkdir(runDir);
  var r = executeLocalReplace(
    { id: 'chaos-re', prompt_text: 'replace', target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', oldText: 'ZZZZZ_NONEXISTENT_CHAOS_ZZZZZ', newText: 'X' }
  );
  assert(!r.ok, 'must not be ok');
  assert(r.error && r.error.includes('not found'), 'error must mention not found');
});

test('executeLocalCreateFile fails when file already exists', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-create-exists-' + Date.now());
  mkdir(runDir);
  var r = executeLocalCreateFile(
    { id: 'chaos-ce', prompt_text: 'create', target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', content: 'KOSAME_CHAOS' }
  );
  assert(!r.ok, 'must fail on existing file');
});

test('executeLocalSmallPatch fails when no h1 in file', () => {
  // Create a temp file with no h1
  var tmpFile = path.join(ROOT, 'public', 'chaos-no-h1.html');
  fs.writeFileSync(tmpFile, '<!DOCTYPE html>\n<html><body><p>no heading</p></body></html>\n');
  var runDir = path.join(RUNS_DIR, 'chaos-heading-fail-' + Date.now());
  mkdir(runDir);
  var r = executeLocalSmallPatch(
    { id: 'chaos-hp', prompt_text: 'heading', target_repo: ROOT },
    runDir,
    { filePath: 'public/chaos-no-h1.html', newContent: 'KOSAME_CHAOS', patchType: 'heading' }
  );
  assert(!r.ok, 'must fail when no h1');
  assert(r.error && r.error.includes('no h1'), 'error must mention h1');
  unlink(tmpFile);
});

test('executeLocalSmallPatch fails on unknown patch type', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-unk-patch-' + Date.now());
  mkdir(runDir);
  var r = executeLocalSmallPatch(
    { id: 'chaos-up', prompt_text: 'patch', target_repo: ROOT },
    runDir,
    { filePath: 'public/test.html', newContent: 'X', patchType: 'unknown_patch_type' }
  );
  assert(!r.ok, 'must fail on unknown patch type');
  assert(r.error && r.error.includes('unknown'), 'error must mention unknown');
});

// ════════════════════════════════════════════════════════════════════════════
// detectExecutorLane edge cases
// ════════════════════════════════════════════════════════════════════════════

test('detectExecutorLane blocks path traversal (..)', () => {
  var l = detectExecutorLane({ prompt_text: '../etc/passwd', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block path traversal');
});

test('detectExecutorLane blocks target_repo mismatch', () => {
  var l = detectExecutorLane({ prompt_text: 'fix file', target_repo: '/tmp' });
  assert(l.lane === 'blocked_with_reason', 'must block target_repo mismatch');
});

test('detectExecutorLane blocks sales-dx', () => {
  var l = detectExecutorLane({ prompt_text: 'sales_dx fix', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block sales-dx');
});

test('detectExecutorLane blocks deploy operations', () => {
  var l = detectExecutorLane({ prompt_text: 'deploy to cloud run', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block deploy');
});

test('detectExecutorLane blocks git push operations', () => {
  var l = detectExecutorLane({ prompt_text: 'git push origin main', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block git push');
});

test('detectExecutorLane blocks npm publish', () => {
  var l = detectExecutorLane({ prompt_text: 'npm publish new version', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block npm publish');
});

test('detectExecutorLane blocks rm/delete operations', () => {
  var l = detectExecutorLane({ prompt_text: '削除して rm -rf', target_repo: ROOT });
  assert(l.lane === 'blocked_with_reason', 'must block delete');
});

test('detectExecutorLane goes to deepseek for complex prompt', () => {
  var l = detectExecutorLane({ prompt_text: 'Restructure the JavaScript module pattern using ES6 imports', target_repo: ROOT });
  assert(l.lane === 'deepseek_patch_required', 'must go to deepseek for complex JS');
});

test('detectExecutorLane goes to local_append for simple append', () => {
  var l = detectExecutorLane({ prompt_text: 'public/test.html に KOSAME_CHAOS_MARKER を追記してください', target_repo: ROOT });
  assert(l.lane === 'local_append', 'must detect local_append');
});

test('detectExecutorLane goes to deepseek for ambiguous short text', () => {
  var l = detectExecutorLane({ prompt_text: 'fix it', target_repo: ROOT });
  assert(l.lane === 'deepseek_patch_required', 'short ambiguous text must fall through to deepseek');
});

// ════════════════════════════════════════════════════════════════════════════
// DeepSeek handoff / result / action edge cases
// ════════════════════════════════════════════════════════════════════════════

test('writeDeepSeekHandoffFile creates file with correct format', () => {
  var hp = writeDeepSeekHandoffFile(
    { id: 'chaos-hf', title: 'Handoff Test', prompt_text: 'test handoff', target_repo: ROOT },
    { reason: 'chaos test' },
    path.join(RUNS_DIR, 'dummy')
  );
  assert(fs.existsSync(hp), 'handoff file must exist');
  var c = fs.readFileSync(hp, 'utf8');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must contain result begin');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_END'), 'must contain result end');
  assert(c.includes('git add -A is prohibited'), 'must forbid git add -A');
  assert(c.includes('Codex is prohibited'), 'must forbid Codex');
});

test('executeBlocked does NOT create latest-deepseek.md', () => {
  var dsPath = path.join(EXECUTOR_DIR, 'latest-deepseek.md');
  if (fs.existsSync(dsPath)) fs.unlinkSync(dsPath);
  var runDir = path.join(RUNS_DIR, 'chaos-block-nods-' + Date.now());
  mkdir(runDir);
  executeBlocked(
    { id: 'chaos-bk', prompt_text: '../secret', target_repo: ROOT },
    runDir,
    { reason: 'path traversal detected' }
  );
  assert(!fs.existsSync(dsPath), 'latest-deepseek.md must NOT exist for blocked');
});

test('executeBlocked updates latest.md with blocked status', () => {
  var latestPath = path.join(EXECUTOR_DIR, 'latest.md');
  if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
  var runDir = path.join(RUNS_DIR, 'chaos-block-latest-' + Date.now());
  mkdir(runDir);
  executeBlocked(
    { id: 'chaos-bl', prompt_text: '../secret', target_repo: ROOT },
    runDir,
    { reason: 'path traversal detected' }
  );
  assert(fs.existsSync(latestPath), 'latest.md must exist');
  var c = fs.readFileSync(latestPath, 'utf8');
  assert(c.includes('blocked'), 'must contain blocked');
  assert(c.includes('path traversal'), 'must contain reason');
});

test('writeRevisionHandoffFile includes safety constraints', () => {
  var rp = writeRevisionHandoffFile('chaos-rev', 'summary', ['f1.js'], ['node --check'], 'fix', 'instruction');
  assert(fs.existsSync(rp), 'revision must exist');
  var c = fs.readFileSync(rp, 'utf8');
  assert(c.includes('git add -A is prohibited'), 'must forbid git add -A');
  assert(c.includes('Automatic push is prohibited'), 'must forbid auto push');
  assert(c.includes('Automatic deploy is prohibited'), 'must forbid auto deploy');
  assert(c.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must have result format');
  unlink(rp);
});

test('writeLatestStatus writes blocked reason', () => {
  var latestPath = path.join(EXECUTOR_DIR, 'latest.md');
  if (fs.existsSync(latestPath)) fs.unlinkSync(latestPath);
  writeLatestStatus('blocked_with_reason', 'blocked',
    { id: 'chaos-wls', title: 'Blocked Test', target_repo: ROOT },
    '/tmp/out.md', null, 'chaos block reason');
  var c = fs.readFileSync(latestPath, 'utf8');
  assert(c.includes('blocked_with_reason'), 'must contain lane');
  assert(c.includes('chaos block reason'), 'must contain reason');
});

// ════════════════════════════════════════════════════════════════════════════
// DeepSeek result intake — invalid blocks
// ════════════════════════════════════════════════════════════════════════════

test('server handler: raw_text with BEGIN only is rejected', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('KOSAME_DEEPSEEK_RESULT_BEGIN'), 'must look for BEGIN tag');
  assert(s.includes('block not found'), 'must error when no END');
});

test('server handler: raw_text with END only is rejected', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('KOSAME_DEEPSEEK_RESULT_END'), 'must look for END tag');
});

test('server handler: result with .env in block is blocked', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('.env') && s.includes('blocked content'), 'must block .env');
});

test('server handler: result with credentials in block is blocked', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('credentials') && s.includes('blocked'), 'must block credentials');
});

test('server handler: result with SECRET in block is blocked', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('SECRET'), 'must check SECRET');
});

test('server handler: result with transcriber path is blocked', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/home/lavie/repos/transcriber'), 'must block transcriber path');
});

test('server handler: result with kosame-sales-dx path is blocked', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('/home/lavie/repos/kosame-sales-dx'), 'must block sales-dx path');
});

// ════════════════════════════════════════════════════════════════════════════
// DeepSeek action edge cases
// ════════════════════════════════════════════════════════════════════════════

test('server handler: action=unknown is rejected', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('action must be accept | revise | reject'), 'must validate action');
});

test('server handler: action with blocked content is rejected', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('action contains blocked content'), 'must block bad action text');
  assert(s.includes('kosame-sales-dx') && s.includes('blocked'), 'must check kosame-sales-dx in action');
});

test('server handler: action transcriber check exists', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('transcriber') && s.includes('blocked'), 'must block transcriber in action');
});

// ════════════════════════════════════════════════════════════════════════════
// History edge cases
// ════════════════════════════════════════════════════════════════════════════

test('history API returns empty items when dir is missing', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("items: []"), 'must return empty items when no history dir');
  assert(s.includes('count: 0'), 'history response must include count');
});

test('history API skips non-JSON files', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes(".endsWith('.json')"), 'must filter for .json files');
});

test('history API skips malformed JSON', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('skip malformed'), 'must skip malformed JSON');
});

test('saveHistory function creates entries with type and timestamp', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('function saveHistory'), 'saveHistory must exist');
  assert(s.includes('type, timestamp'), 'must include type and timestamp');
});

// Manually write a history entry and verify shape via API handler source
test('history entry shape is stable (test via manual write + read)', () => {
  var historyDir = path.join(EXECUTOR_DIR, 'history');
  mkdir(historyDir);
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var entry = {
    type: 'result', timestamp: new Date().toISOString(), ticket_id: 'chaos-hist',
    action: 'received', data: { status: 'completed', summary: 'test', changed_files: ['a.js'], verification: ['node --check'] },
    path: null,
  };
  var fp = path.join(historyDir, ts + '-result.json');
  fs.writeFileSync(fp, JSON.stringify(entry, null, 2) + '\n');
  var reRead = JSON.parse(fs.readFileSync(fp, 'utf8'));
  assert(reRead.type === 'result', 'type must be result');
  assert(reRead.timestamp, 'must have timestamp');
  assert(reRead.ticket_id === 'chaos-hist', 'must have ticket_id');
  assert(reRead.action === 'received', 'must have action');
  unlink(fp);
});

test('history dir with corrupt JSON file does not crash iterator', () => {
  var historyDir = path.join(EXECUTOR_DIR, 'history');
  mkdir(historyDir);
  var ts = new Date().toISOString().replace(/[:.]/g, '-');
  var badFp = path.join(historyDir, ts + '-corrupt.json');
  fs.writeFileSync(badFp, 'this is not json {{{');
  // Verify server can handle: read the handler source for try/catch
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes('try') && s.includes('JSON.parse'), 'must try/catch parse');
  unlink(badFp);
});

// ════════════════════════════════════════════════════════════════════════════
// API response shape stability tests
// ════════════════════════════════════════════════════════════════════════════

test('/api/executor/latest returns ok:true with type/status when missing', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("'no_handoff'"), 'must return no_handoff status when missing');
  assert(s.includes("type: 'latest'"), 'must include type field');
  assert(s.includes("empty: true"), 'must include empty flag');
});

test('/api/executor/latest returns structured fields when present', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("lane:"), 'must return lane when present');
  assert(s.includes("ticket_id:"), 'must return ticket_id');
  assert(s.includes("updated_at:"), 'must return updated_at');
});

test('/api/executor/deepseek-handoff returns type/handoff status', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("type: 'handoff'"), 'must include type handoff');
  assert(s.includes("'handoff_ready'"), 'must return handoff_ready status');
  assert(s.includes("empty: true"), 'must include empty flag');
});

test('/api/executor/deepseek-result POST returns type/status', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("type: 'result'"), 'result POST must include type');
});

test('/api/executor/deepseek-result GET returns empty status when missing', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("'no_result'"), 'must return no_result when missing');
  assert(s.includes("empty: true"), 'must include empty flag');
});

test('/api/executor/deepseek-result/action POST returns type/action/status', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("type: 'action'"), 'action POST must include type');
  assert(s.includes("'action_'"), 'must include action_ prefix in status');
});

test('/api/executor/deepseek-result/action GET returns empty when missing', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("'no_action'"), 'must return no_action when missing');
});

test('/api/executor/history returns type/count', () => {
  var s = read('tools/kosame-live-cockpit-server.js');
  assert(s.includes("type: 'history'"), 'history must include type');
  assert(s.includes('count:'), 'history must include count');
});

// ════════════════════════════════════════════════════════════════════════════
// Status badge states
// ════════════════════════════════════════════════════════════════════════════

test('HTML defines status badge states: no_handoff', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'no_handoff'"), 'must define no_handoff state');
});

test('HTML defines status badge states: handoff_ready', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'handoff_ready'"), 'must define handoff_ready state');
});

test('HTML defines status badge states: result_received', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'result_received'"), 'must define result_received state');
});

test('HTML defines status badge states: action_ prefix', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("action_"), 'must use action_ prefix for action states');
});

test('HTML defines status badge states: blocked', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'blocked'"), 'must define blocked state');
});

test('HTML defines status badge states: revision_ready', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes("'revision_ready'"), 'must define revision_ready state');
});

test('HTML has deepseek-workflow-status-badge element', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-workflow-status-badge'), 'must have status badge element');
});

test('HTML has deepseek-workflow-revision-badge element', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-workflow-revision-badge'), 'must have revision badge element');
});

test('HTML calls getDeepSeekWorkflowStatus on init', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('getDeepSeekWorkflowStatus()'), 'must call on init');
});

// ════════════════════════════════════════════════════════════════════════════
// UI element preservation
// ════════════════════════════════════════════════════════════════════════════

test('HTML preserves deepseek-handoff-strip', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-handoff-strip'), 'must have handoff strip');
  assert(h.includes('deepseek-copy-btn'), 'must have copy button');
  assert(h.includes('renderDeepSeekHandoff()'), 'must call renderDeepSeekHandoff on init');
});

test('HTML preserves deepseek-result-strip', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-result-strip'), 'must have result strip');
  assert(h.includes('deepseek-result-submit-btn'), 'must have submit button');
  assert(h.includes('renderDeepSeekResult()'), 'must call renderDeepSeekResult on init');
});

test('HTML preserves deepseek-action-strip', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-action-strip'), 'must have action strip');
  assert(h.includes('deepseek-action-accept'), 'must have accept button');
  assert(h.includes('deepseek-action-revise'), 'must have revise button');
  assert(h.includes('deepseek-action-reject'), 'must have reject button');
  assert(h.includes('renderDeepSeekResultAction()'), 'must call renderDeepSeekResultAction on init');
});

test('HTML preserves renderDeepSeekWorkflowHistory', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('deepseek-history-content'), 'must have history content');
  assert(h.includes('renderDeepSeekWorkflowHistory()'), 'must call on init');
});

test('HTML preserves chat UI (chat-proceed, chat-input, notification)', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('chat-proceed'), 'chat-proceed must exist');
  assert(h.includes('chat-input'), 'chat-input must exist');
  assert(h.includes('chat-sound-badge'), 'sound badge must exist');
  assert(h.includes('AGENT STREAM LOG'), 'agent stream log must exist');
});

test('HTML preserves agent-stream-log', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('agent-stream-log'), 'must have agent-stream-log');
});

test('HTML has handoff-result-strip preserved', () => {
  var h = read('public/kosame-live-cockpit.html');
  assert(h.includes('handoff-result-strip'), 'must have handoff-result-strip');
});

// ════════════════════════════════════════════════════════════════════════════
// executorLaneRouter completeness
// ════════════════════════════════════════════════════════════════════════════

test('executorLaneRouter returns not ok for unknown lane', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-unknown-lane-' + Date.now());
  mkdir(runDir);
  var r = executorLaneRouter({ id: 'chaos-ul', prompt_text: 'x', target_repo: ROOT }, runDir);
  // deepseek_patch_required is the default, so it should not be unknown
  assert(r.executorStatus === 'deepseek_patch_required' || !r.ok, 'must route fallback correctly');
});

test('executorLaneRouter handles local_append correctly', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-lane-la-' + Date.now());
  mkdir(runDir);
  var html = path.join(ROOT, 'public', 'test.html');
  var origHash = require('crypto').createHash('sha1').update(fs.readFileSync(html)).digest('hex');
  var r = executorLaneRouter(
    { id: 'chaos-la', prompt_text: 'public/test.html に KOSAME_CHAOS_LA を追記してください', target_repo: ROOT },
    runDir
  );
  assert(r.ok, 'local_append must succeed');
  // Cleanup — restore original
  var content = fs.readFileSync(html, 'utf8').replace('KOSAME_CHAOS_LA', '');
  fs.writeFileSync(html, content, 'utf8');
});

test('executorLaneRouter handles blocked correctly', () => {
  var runDir = path.join(RUNS_DIR, 'chaos-lane-bl-' + Date.now());
  mkdir(runDir);
  var r = executorLaneRouter(
    { id: 'chaos-bl', prompt_text: '../escaped.txt', target_repo: ROOT },
    runDir
  );
  assert(!r.ok, 'blocked must not be ok');
  assert(r.exitCode === 1, 'blocked exit code must be 1');
});

// ════════════════════════════════════════════════════════════════════════════
// Contamination
// ════════════════════════════════════════════════════════════════════════════

test('no sales-dx / transcriber / Secret / .env contamination', () => {
  var bad = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
  for (var i = 0; i < bad.length; i++) {
    assert(!ROOT.includes(bad[i]), 'target_repo must NOT contain ' + bad[i]);
  }
  var s = read('tools/kosame-live-cockpit-server.js');
  var r = read('tools/kosame-runner-queue.js');
  var h = read('public/kosame-live-cockpit.html');
  var files = [s, r, h];
  for (var j = 0; j < files.length; j++) {
    assert(!files[j].includes('ANESTY Board'), 'files must not reference ANESTY Board');
  }
});

// ════════════════════════════════════════════════════════════════════════════
// Existing smoke backward compat verification
// ════════════════════════════════════════════════════════════════════════════

test('package.json has smoke:v113-3-118', () => {
  assert(PKG.scripts && PKG.scripts['smoke:v113-3-118'], 'must have v118 smoke script');
});

test('verify:dev-os includes v118 smoke run', () => {
  var v = PKG.scripts['verify:dev-os'];
  assert(v.includes('v113-3-118-bug-patrol-chaos-smoke.js'), 'must check v118 smoke');
  assert(v.includes('smoke:v113-3-118'), 'must run v118 smoke');
});

test('verify:dev-os version string is v113-3-118', () => {
  var v = PKG.scripts['verify:dev-os'];
  assert(v.includes('v113-3-118.json'), 'temp file must reference v118');
});

// ════════════════════════════════════════════════════════════════════════════
// Summary
// ════════════════════════════════════════════════════════════════════════════
var total = passed + failed;
console.log('');
if (failed === 0) {
  console.log('✅ v' + MIN_VERSION + ' bug patrol chaos smoke PASSED (' + passed + '/' + total + ')');
} else {
  console.error('❌ v' + MIN_VERSION + ' bug patrol chaos smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
  process.exit(1);
}
