#!/usr/bin/env node
'use strict';

const fs        = require('node:fs');
const path      = require('node:path');
const cp        = require('node:child_process');

const ROOT       = path.resolve(__dirname, '..');
const PKG        = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const MIN_VERSION = '113.3.119';

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

// ── Start server, do HTTP tests via curl, then stop ────────────────────────
let PORT = 0;
let SERVER = null;
let BASE = '';

function startServer() {
  const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
  const s = createLiveCockpitServer({ port: 0, host: '127.0.0.1' });
  return new Promise((resolve, reject) => {
    s.server.on('error', reject);
    s.server.listen(0, '127.0.0.1', () => {
      PORT = s.server.address().port;
      SERVER = s.server;
      BASE = 'http://127.0.0.1:' + PORT;
      resolve();
    });
  });
}

function stopServer() {
  return new Promise((resolve) => {
    if (SERVER) { SERVER.close(() => resolve()); } else { resolve(); }
  });
}

function curl(method, path, body) {
  const args = ['-s', '-m', '5'];
  if (method !== 'GET') args.push('-X', method);
  if (body) {
    const j = JSON.stringify(body);
    args.push('-H', 'Content-Type: application/json', '-d', j);
  }
  args.push(BASE + path);
  try {
    const r = cp.spawnSync('curl', args, { encoding: 'utf8', timeout: 8000, maxBuffer: 1024 * 1024 });
    const raw = (r.stdout || '').trim();
    if (!raw) return { _error: 'empty response' };
    return JSON.parse(raw);
  } catch (e) {
    return { _error: String(e.message || e) };
  }
}

async function run() {
  console.log('===== v' + MIN_VERSION + ' HTTP E2E smoke =====');

  // Version
  test('package.json version >= 113.3.119', () => {
    assert(compareVersions(PKG.version, MIN_VERSION) >= 0, 'version must be >= ' + MIN_VERSION + ', got ' + PKG.version);
  });

  // Start server
  try { await startServer(); } catch (e) {
    console.error('FAIL: server start — ' + e.message);
    process.exit(1);
  }
  console.log('  Server started on port ' + PORT);

  // ── GET latest ──
  test('GET /api/executor/latest returns ok', () => {
    const d = curl('GET', '/api/executor/latest');
    assert(d && d.ok !== undefined, 'must have ok field');
  });

  // ── GET deepseek-handoff ──
  test('GET /api/executor/deepseek-handoff returns valid response', () => {
    const d = curl('GET', '/api/executor/deepseek-handoff');
    assert(d && d.ok !== undefined, 'must have ok field');
    assert(d.type === 'handoff', 'must have type handoff');
  });

  // ── POST result — valid ──
  test('POST /api/executor/deepseek-result accepts valid result', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: http-119-1\nsummary: e2e pass\nchanged_files:\n- test.txt\nverification:\n- check\ncommit: none\nnotes: ok\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === true, 'must accept valid: ' + JSON.stringify(d));
    assert(d.type === 'result', 'must have type');
  });

  // ── POST result — invalid (no block) ──
  test('POST /api/executor/deepseek-result rejects invalid block', () => {
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: 'garbage' });
    assert(d.ok === false, 'must reject invalid');
    assert(d.reason, 'must have reason');
  });

  // ── POST result — secret blocked ──
  test('POST /api/executor/deepseek-result blocks .env', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: added .env\nchanged_files:\n- .env\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'must block .env');
  });

  // ── POST result — credentials blocked ──
  test('POST /api/executor/deepseek-result blocks credentials', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: credentials\nchanged_files:\n- credentials.json\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'must block credentials');
  });

  // ── POST result — SECRET blocked ──
  test('POST /api/executor/deepseek-result blocks SECRET', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: SECRET key\nchanged_files:\n- config.js\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'must block SECRET');
  });

  // ── POST result — sales-dx blocked ──
  test('POST /api/executor/deepseek-result blocks sales-dx', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: fix\nchanged_files:\n- /home/lavie/repos/kosame-sales-dx/s.js\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'must block sales-dx');
  });

  // ── POST result — transcriber blocked ──
  test('POST /api/executor/deepseek-result blocks transcriber', () => {
    const raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: fix\nchanged_files:\n- /home/lavie/repos/transcriber/t.js\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    const d = curl('POST', '/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'must block transcriber');
  });

  // ── GET result ──
  test('GET /api/executor/deepseek-result returns data', () => {
    const d = curl('GET', '/api/executor/deepseek-result');
    assert(d && d.ok !== undefined, 'must return object');
  });

  // ── POST action — accept ──
  test('POST action accept works', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'accept', reason: 'good' });
    assert(d.ok === true, 'must accept');
    assert(d.status === 'action_accept', 'must have accept status: got ' + d.status);
  });

  // ── POST action — revise ──
  test('POST action revise generates revision', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'revise', reason: 'fix', next_instruction: 'do better' });
    assert(d.ok === true, 'must revise');
    assert(d.revision_path, 'must have revision path');
  });

  // ── POST action — reject ──
  test('POST action reject works', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'reject', reason: 'bad' });
    assert(d.ok === true, 'must reject');
  });

  // ── POST action — invalid action ──
  test('POST action with invalid action is rejected', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'deploy' });
    assert(d.ok === false, 'must reject deploy');
  });

  // ── POST action — blocked content in reason ──
  test('POST action with .env in reason is blocked', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'accept', reason: 'add .env' });
    assert(d.ok === false, 'must block');
  });

  // ── POST action — sales-dx in reason is blocked ──
  test('POST action with sales-dx in reason is blocked', () => {
    const d = curl('POST', '/api/executor/deepseek-result/action', { action: 'accept', reason: 'checked kosame-sales-dx' });
    assert(d.ok === false, 'must block');
  });

  // ── GET action ──
  test('GET /api/executor/deepseek-result/action returns data', () => {
    const d = curl('GET', '/api/executor/deepseek-result/action');
    assert(d && d.ok !== undefined, 'must return object');
  });

  // ── GET history ──
  test('GET /api/executor/history returns typed items', () => {
    const d = curl('GET', '/api/executor/history');
    assert(d && d.ok, 'must be ok');
    assert(d.type === 'history', 'must have type');
    assert(d.count !== undefined, 'must have count');
    assert(Array.isArray(d.items), 'must have items');
  });

  // ── GET readiness ──
  test('GET /api/executor/readiness returns readiness', () => {
    const d = curl('GET', '/api/executor/readiness');
    assert(d && d.ok, 'must be ok');
    assert(['ready', 'caution', 'blocked'].indexOf(d.readiness) >= 0, 'must be valid readiness: ' + d.readiness);
    assert(d.version === '113.3.119', 'must have version 113.3.119');
    assert(Array.isArray(d.blockers), 'must have blockers');
    assert(Array.isArray(d.warnings), 'must have warnings');
    assert(Array.isArray(d.next_actions), 'must have next_actions');
    assert(typeof d.rc_summary === 'string', 'must have rc_summary');
  });

  // ── GET rc-summary ──
  test('GET /api/executor/rc-summary returns content', () => {
    const d = curl('GET', '/api/executor/rc-summary');
    assert(d && d.ok, 'must be ok');
  });

  // ── GET healthz ──
  test('GET /healthz returns ok', () => {
    const args = ['-s', '-m', '3', BASE + '/healthz'];
    const r = cp.spawnSync('curl', args, { encoding: 'utf8', timeout: 5000 });
    assert((r.stdout || '').trim() === 'ok', 'healthz must be ok');
  });

  // ── Server still alive ──
  test('server is running (healthz ok)', () => {
    const args = ['-s', '-m', '3', BASE + '/healthz'];
    const r = cp.spawnSync('curl', args, { encoding: 'utf8', timeout: 5000 });
    assert((r.stdout || '').trim() === 'ok', 'still alive');
  });

  // ── Stop server ──
  await stopServer();

  // ── Summary ──
  const total = passed + failed;
  console.log('');
  if (failed === 0) {
    console.log('✅ v' + MIN_VERSION + ' HTTP E2E smoke PASSED (' + passed + '/' + total + ')');
    process.exit(0);
  } else {
    console.error('❌ v' + MIN_VERSION + ' HTTP E2E smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
    process.exit(1);
  }
}

run().catch(function(e) {
  console.error('FATAL: ' + (e.message || e));
  if (SERVER) { try { SERVER.close(); } catch (_) {} }
  process.exit(1);
});
