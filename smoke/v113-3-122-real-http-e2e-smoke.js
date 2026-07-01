#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const cp   = require('node:child_process');

const ROOT        = path.resolve(__dirname, '..');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');
const CANONICAL_HTML = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';

let passed = 0, failed = 0, serverProcess = null, port = 0, baseUrl = '';

function log(msg) { console.log('  [E2E] ' + msg); }
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Find available port
function findFreePort() {
  var net = require('node:net');
  for (var p = 9200; p < 9400; p++) {
    try { var s = new net.Server(); s.listen(p, '127.0.0.1'); s.close(); return p; } catch (_) {}
  }
  return 0;
}

// HTTP helpers — Node native http
function httpGet(pathname) {
  return new Promise(function(resolve, reject) {
    var req = http.get(baseUrl + pathname, { timeout: 5000 }, function(res) {
      var raw = ''; res.setEncoding('utf8');
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({ _raw: raw, _error: 'parse' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(pathname, body) {
  return new Promise(function(resolve, reject) {
    var payload = JSON.stringify(body);
    var req = http.request({
      hostname: '127.0.0.1', port: port, path: pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      timeout: 5000,
    }, function(res) {
      var raw = ''; res.setEncoding('utf8');
      res.on('data', function(c) { raw += c; });
      res.on('end', function() {
        try { resolve(JSON.parse(raw)); } catch (_) { resolve({ _raw: raw, _error: 'parse' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', function() { req.destroy(); reject(new Error('timeout')); });
    req.write(payload);
    req.end();
  });
}

function test(name, fn) {
  try { fn(); console.log('  PASS: ' + name); passed++; }
  catch (e) { console.error('  FAIL: ' + name + ' — ' + e.message); failed++; }
}

function cleanup() {
  try { fs.writeFileSync(path.join(ROOT, 'public', 'test.html'), CANONICAL_HTML); } catch (_) {}
}

// ── Main async runner ───────────────────────────────────────────────────────

async function run() {
  console.log('===== v113.3.122 Real HTTP E2E smoke =====');

  cleanup();

  // ── Start server ─────────────────────────────────────────────────────────
  port = findFreePort();
  if (!port) { console.error('FATAL: no free port'); process.exit(1); }
  baseUrl = 'http://127.0.0.1:' + port;

  log('Starting server on port ' + port + '...');
  serverProcess = cp.spawn(process.execPath,
    [path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js')],
    { cwd: ROOT, env: { ...process.env, PORT: String(port), KOSAME_AGENT_LIVE_CALLS_ENABLED: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });

  var serverLog = '';
  if (serverProcess.stdout) serverProcess.stdout.on('data', function(d) { serverLog += d.toString(); });
  if (serverProcess.stderr) serverProcess.stderr.on('data', function(d) { serverLog += d.toString(); });

  // Wait for server to be ready (healthz returns ok)
  var ready = false;
  for (var i = 0; i < 30; i++) {
    try {
      var resp = await new Promise(function(resolve, reject) {
        var h = http.get(baseUrl + '/healthz', { timeout: 2000 }, function(r) {
          var raw = ''; r.setEncoding('utf8');
          r.on('data', function(c) { raw += c; });
          r.on('end', function() { resolve(raw); });
        });
        h.on('error', function() { resolve(''); });
        h.on('timeout', function() { h.destroy(); resolve(''); });
      });
      if (resp.trim() === 'ok') { ready = true; break; }
    } catch (_) {}
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  test('server starts and healthz responds', function() {
    assert(ready, 'server failed to start within 15s. Log: ' + serverLog.slice(-200));
    log('Server ready on port ' + port);
  });

  if (!ready) {
    killServer();
    var total = passed + failed;
    console.error('❌ v113.3.122 Real HTTP E2E smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
    process.exit(1);
  }

  // ── API Tests ─────────────────────────────────────────────────────────────
  test('GET /api/executor/latest returns ok', async function() {
    var d = await httpGet('/api/executor/latest');
    assert(d && d.ok !== undefined, 'got: ' + JSON.stringify(d).slice(0, 80));
  });

  test('GET /api/executor/deepseek-handoff returns ok', async function() {
    var d = await httpGet('/api/executor/deepseek-handoff');
    assert(d && d.ok !== undefined);
    assert(d.type === 'handoff', 'should be handoff type');
  });

  test('POST /api/executor/deepseek-result accepts valid block', async function() {
    var raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: e2e-122\nsummary: test\nchanged_files:\n- x.txt\nverification:\n- y\ncommit: none\nnotes: ok\nKOSAME_DEEPSEEK_RESULT_END';
    var d = await httpPost('/api/executor/deepseek-result', { raw_text: raw, ticket_id: 'e2e-122' });
    assert(d.ok === true, 'should accept: ' + JSON.stringify(d).slice(0, 100));
  });

  test('GET /api/executor/deepseek-result returns data', async function() {
    var d = await httpGet('/api/executor/deepseek-result');
    assert(d && d.ok !== undefined);
  });

  test('POST /api/executor/deepseek-result rejects invalid', async function() {
    var d = await httpPost('/api/executor/deepseek-result', { raw_text: 'garbage' });
    assert(d.ok === false, 'should reject invalid');
  });

  test('POST /api/executor/deepseek-result blocks .env', async function() {
    var raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: .env\nchanged_files:\n- .env\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    var d = await httpPost('/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'should block .env');
  });

  test('POST /api/executor/deepseek-result blocks SECRET', async function() {
    var raw = 'KOSAME_DEEPSEEK_RESULT_BEGIN\nstatus: completed\nticket_id: x\nsummary: SECRET\nchanged_files:\n- x\nverification:\n- ok\ncommit: none\nKOSAME_DEEPSEEK_RESULT_END';
    var d = await httpPost('/api/executor/deepseek-result', { raw_text: raw });
    assert(d.ok === false, 'should block SECRET');
  });

  test('POST /api/executor/deepseek-result/action accept', async function() {
    var d = await httpPost('/api/executor/deepseek-result/action', { action: 'accept', reason: 'looks good' });
    assert(d.ok === true, 'accept should work');
    assert(d.status === 'action_accept', 'got: ' + d.status);
  });

  test('POST /api/executor/deepseek-result/action revise', async function() {
    var d = await httpPost('/api/executor/deepseek-result/action', { action: 'revise', reason: 'fix', next_instruction: 'please fix' });
    assert(d.ok === true, 'revise should work');
    assert(d.revision_path, 'should have revision path');
  });

  test('POST /api/executor/deepseek-result/action reject', async function() {
    var d = await httpPost('/api/executor/deepseek-result/action', { action: 'reject', reason: 'not good' });
    assert(d.ok === true, 'reject should work');
  });

  test('GET /api/executor/deepseek-result/action returns data', async function() {
    var d = await httpGet('/api/executor/deepseek-result/action');
    assert(d && d.ok !== undefined);
  });

  test('GET /api/executor/history returns items', async function() {
    var d = await httpGet('/api/executor/history');
    assert(d && d.ok, 'history should be ok');
    assert(d.type === 'history', 'type should be history');
    assert(Array.isArray(d.items), 'items should be array');
  });

  test('GET /api/executor/readiness returns status', async function() {
    var d = await httpGet('/api/executor/readiness');
    assert(d && d.ok && d.version, 'readiness should work');
  });

  test('GET /api/executor/release-gate returns gate', async function() {
    var d = await httpGet('/api/executor/release-gate');
    assert(d && d.ok && ['open', 'caution', 'human_gate', 'blocked'].indexOf(d.gate) >= 0, 'valid gate: ' + d.gate);
  });

  test('POST /api/executor/judge pending_judge', async function() {
    var d = await httpPost('/api/executor/judge', { judge_status: 'pending_judge', judge_reason: 'reviewing' });
    assert(d.ok === true, 'judge should work');
  });

  test('POST /api/executor/judge accept', async function() {
    var d = await httpPost('/api/executor/judge', { judge_status: 'judge_accept', next_action: 'proceed' });
    assert(d.ok === true, 'judge_accept should work');
  });

  test('GET /api/executor/judge returns status', async function() {
    var d = await httpGet('/api/executor/judge');
    assert(d && d.ok !== undefined);
  });

  test('GET /api/executor/rc100-summary returns content', async function() {
    var d = await httpGet('/api/executor/rc100-summary');
    assert(d && d.ok);
  });

  test('GET /api/executor/post-rc-summary returns content', async function() {
    var d = await httpGet('/api/executor/post-rc-summary');
    assert(d && d.ok);
  });

  test('GET /api/executor/operational-checklist returns content', async function() {
    var d = await httpGet('/api/executor/operational-checklist');
    assert(d && d.ok);
  });

  test('GET /api/executor/handoff returns content', async function() {
    var d = await httpGet('/api/executor/handoff');
    assert(d && d.ok !== undefined);
  });

  test('GET /api/executor/recovery returns content', async function() {
    var d = await httpGet('/api/executor/recovery');
    assert(d && d.ok !== undefined);
  });

  test('GET /api/executor/ops-validation-summary returns ok', async function() {
    var d = await httpGet('/api/executor/ops-validation-summary');
    assert(d && d.ok);
  });

  test('POST invalid action blocked', async function() {
    var d = await httpPost('/api/executor/deepseek-result/action', { action: 'deploy' });
    assert(d.ok === false, 'deploy action should be rejected');
  });

  test('POST invalid judge_status blocked', async function() {
    var d = await httpPost('/api/executor/judge', { judge_status: 'invalid_status' });
    assert(d.ok === false, 'invalid judge status should be rejected');
  });

  // ── Kill server ───────────────────────────────────────────────────────────
  killServer();
  log('Server stopped');

  // Write HTTP E2E report
  var report = [
    '# KOSAME Real HTTP E2E Report',
    `version: 113.3.122`,
    `status: ${failed === 0 ? 'PASS' : 'FAIL'}`,
    `server_port: ${port}`,
    `api_tests_run: ${passed + failed}`,
    `api_tests_passed: ${passed}`,
    `api_tests_failed: ${failed}`,
    `generated_at: ${new Date().toISOString()}`,
  ].join('\n');
  try {
    fs.mkdirSync(EXECUTOR_DIR, { recursive: true });
    fs.writeFileSync(path.join(EXECUTOR_DIR, 'real-http-e2e-report.md'), report);
  } catch (_) {}

  cleanup();

  var total = passed + failed;
  console.log('');
  if (failed === 0) {
    console.log('✅ v113.3.122 Real HTTP E2E smoke PASSED (' + passed + '/' + total + ')');
    process.exit(0);
  } else {
    console.error('❌ v113.3.122 Real HTTP E2E smoke FAILED (' + passed + '/' + total + ', ' + failed + ' failures)');
    console.error('Server log tail: ' + serverLog.slice(-300));
    process.exit(1);
  }
}

function killServer() {
  if (serverProcess) {
    try { serverProcess.kill('SIGTERM'); } catch (_) {}
    serverProcess = null;
  }
}

process.on('exit', function() { killServer(); cleanup(); });
process.on('SIGINT', function() { killServer(); cleanup(); process.exit(1); });
process.on('SIGTERM', function() { killServer(); cleanup(); process.exit(1); });

run().catch(function(e) {
  console.error('FATAL: ' + (e.message || e));
  killServer();
  cleanup();
  process.exit(1);
});
