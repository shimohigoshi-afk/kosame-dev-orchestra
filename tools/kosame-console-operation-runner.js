#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const cp   = require('node:child_process');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const EXECUTOR_DIR = path.join(ROOT, '.kosame-executor');
const PKG = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let port = 0, baseUrl = '', serverProcess = null, serverLog = '';
let passed = 0, failed = 0;
const checks = [];
const results = [];

function log(msg) { console.log('  [OP] ' + msg); }

function findFreePort() {
  var net = require('node:net');
  for (var p = 9200; p < 9400; p++) {
    try { var s = new net.Server(); s.listen(p, '127.0.0.1'); s.close(); return p; } catch (_) {}
  }
  return 0;
}

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

async function run() {
  console.log('KOSAME_CONSOLE_OPERATION_BEGIN');

  // ── Start server ─────────────────────────────────────────────────────────
  port = findFreePort();
  if (!port) { console.log('status: blocked'); console.log('reason: no free port'); process.exit(1); }
  baseUrl = 'http://127.0.0.1:' + port;
  log('Starting server on port ' + port);

  serverProcess = cp.spawn(process.execPath,
    [path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js')],
    { cwd: ROOT, env: { ...process.env, PORT: String(port), KOSAME_AGENT_LIVE_CALLS_ENABLED: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });

  if (serverProcess.stdout) serverProcess.stdout.on('data', function(d) { serverLog += d.toString(); });
  if (serverProcess.stderr) serverProcess.stderr.on('data', function(d) { serverLog += d.toString(); });

  // Wait for server
  var ready = false;
  for (var i = 0; i < 30; i++) {
    try {
      var resp = await new Promise(function(rv, rj) {
        var h = http.get(baseUrl + '/healthz', { timeout: 2000 }, function(res) {
          var raw = ''; res.setEncoding('utf8'); res.on('data', function(c) { raw += c; }); res.on('end', function() { rv(raw); });
        });
        h.on('error', function() { rv(''); }); h.on('timeout', function() { h.destroy(); rv(''); });
      });
      if (resp.trim() === 'ok') { ready = true; break; }
    } catch (_) {}
    await new Promise(function(r) { setTimeout(r, 500); });
  }

  if (!ready) {
    console.log('status: blocked'); console.log('reason: server start timeout'); killServer(); process.exit(1);
  }
  log('Server ready');
  checks.push('server_start: PASS');

  // ── HTML check ───────────────────────────────────────────────────────────
  try {
    var html = await new Promise(function(rv, rj) {
      http.get(baseUrl + '/', { timeout: 3000 }, function(res) {
        var raw = ''; res.setEncoding('utf8');
        res.on('data', function(c) { raw += c; }); res.on('end', function() { rv(raw); });
      }).on('error', rj);
    });
    if (html.includes('KOSAME Console') && html.includes('chat-input')) {
      checks.push('html_console: PASS');
    } else {
      checks.push('html_console: FAIL (missing key elements)');
    }
  } catch (_) { checks.push('html_console: FAIL'); }

  // ── API checks ───────────────────────────────────────────────────────────
  var apis = ['/api/executor/latest', '/api/executor/deepseek-handoff', '/api/executor/readiness',
    '/api/executor/release-gate', '/api/executor/judge', '/api/executor/history', '/api/executor/field-ops-report',
    '/api/executor/limit-break-report', '/api/executor/operational-evidence', '/api/executor/real-run-readiness'];
  for (var a = 0; a < apis.length; a++) {
    try {
      var d = await httpGet(apis[a]);
      if (d && d.ok !== undefined) { checks.push('api_' + apis[a].replace(/\/api\/executor\//,'') + ': PASS'); }
      else { checks.push('api_' + apis[a].replace(/\/api\/executor\//,'') + ': FAIL'); }
    } catch (_) { checks.push('api_' + apis[a].replace(/\/api\/executor\//,'') + ': ERROR'); }
  }

  // ── DOM elements check (via HTML content) ────────────────────────────────
  var keyElements = ['chat-input', 'chat-proceed', 'chat-sound-badge', 'agent-stream-log',
    'deepseek-handoff-strip', 'deepseek-result-strip', 'deepseek-action-strip',
    'rc100-gate-content', 'rc100-judge-status', 'field-ops-panel', 'limit-break-status',
    'deepseek-history-content', 'release-readiness-display'];
  var htmlContent = await new Promise(function(rv) {
    http.get(baseUrl + '/', { timeout: 3000 }, function(res) {
      var raw = ''; res.setEncoding('utf8'); res.on('data', function(c) { raw += c; }); res.on('end', function() { rv(raw); });
    }).on('error', function() { rv(''); });
  });
  for (var e = 0; e < keyElements.length; e++) {
    if (htmlContent.includes(keyElements[e])) {
      checks.push('dom_' + keyElements[e] + ': PASS');
    } else {
      checks.push('dom_' + keyElements[e] + ': FAIL');
    }
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────
  killServer();
  var totalPassed = checks.filter(function(c) { return c.includes('PASS'); }).length;
  var totalFailed = checks.length - totalPassed;

  var status = totalFailed === 0 ? 'ready' : totalFailed <= 3 ? 'caution' : 'blocked';
  console.log('status: ' + status);
  checks.forEach(function(c) { console.log('check: ' + c); });
  console.log('total_checks: ' + checks.length);
  console.log('passed: ' + totalPassed);
  console.log('failed: ' + totalFailed);
  console.log('KOSAME_CONSOLE_OPERATION_END');

  // Write report
  var report = ['# KOSAME Console Operation Report', 'version: ' + PKG.version, 'status: ' + status,
    'total_checks: ' + checks.length, 'passed: ' + totalPassed, 'failed: ' + totalFailed, '',
    '## Checks', checks.map(function(c) { return '- ' + c; }).join('\n'), '',
    'generated_at: ' + new Date().toISOString(),
  ].join('\n');
  fs.mkdirSync(EXECUTOR_DIR, { recursive: true });
  fs.writeFileSync(path.join(EXECUTOR_DIR, 'console-operation-report.md'), report);
  process.exit(totalFailed > 3 ? 1 : totalFailed > 0 ? 2 : 0);
}

function killServer() {
  if (serverProcess) { try { serverProcess.kill('SIGTERM'); } catch (_) {} serverProcess = null; }
}

process.on('exit', killServer);
process.on('SIGINT', function() { killServer(); process.exit(1); });

run().catch(function(e) {
  console.log('status: blocked');
  console.log('reason: ' + (e.message || e));
  killServer();
  process.exit(1);
});
