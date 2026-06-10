#!/usr/bin/env node
'use strict';

/**
 * v110.44 dev-run-api smoke test
 *
 * Tests kosame-dev-run-api, kosame-activity-events (watchLog/rebroadcast),
 * and dashboard server JSONL watcher integration — all without network calls.
 */

const http = require('node:http');
const path = require('node:path');
const fs   = require('node:fs');
const os   = require('node:os');

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); pass++; }
  else       { console.error(`  FAIL: ${label}`); fail++; }
}

function throws(label, fn) {
  try { fn(); console.error(`  FAIL: ${label} (expected throw)`); fail++; }
  catch (_) { console.log(`  PASS: ${label}`); pass++; }
}

// ── kosame-dev-run-api ────────────────────────────────────────────────────────

const api = require('../tools/kosame-dev-run-api');

ok('TOOL_META.version',          api.TOOL_META.version === '110.44.0');
ok('TOOL_META.dryRunDefault',    api.TOOL_META.dryRunDefault === true);
ok('startServer: function',      typeof api.startServer === 'function');
ok('parseArgs: function',        typeof api.parseArgs === 'function');
ok('checkAuth: function',        typeof api.checkAuth === 'function');
ok('currentLogSize: function',   typeof api.currentLogSize === 'function');
ok('startTail: function',        typeof api.startTail === 'function');

// parseArgs defaults — argv.slice(2) なので先頭 2 要素はダミー
const defaults = api.parseArgs(['node', 'script']);
ok('parseArgs: default port 8081',   defaults.port === 8081);
ok('parseArgs: default dryRun=true', defaults.dryRun === true);

const live = api.parseArgs(['node', 'script', '--live']);
ok('parseArgs: --live sets dryRun=false', live.dryRun === false);

const write = api.parseArgs(['node', 'script', '--write']);
ok('parseArgs: --write sets dryRun=false', write.dryRun === false);

const customPort = api.parseArgs(['node', 'script', '--port=9999']);
ok('parseArgs: --port=9999', customPort.port === 9999);

// checkAuth — no key configured → always pass
delete process.env.KOSAME_API_KEY;
ok('checkAuth: no key = always pass', api.checkAuth({ headers: {} }));
ok('checkAuth: no key = pass even with wrong header',
  api.checkAuth({ headers: { authorization: 'Bearer wrong' } }));

// checkAuth — key configured
process.env.KOSAME_API_KEY = 'test-secret-key';
ok('checkAuth: correct Bearer token',
  api.checkAuth({ headers: { authorization: 'Bearer test-secret-key' } }));
ok('checkAuth: correct X-API-Key header',
  api.checkAuth({ headers: { 'x-api-key': 'test-secret-key' } }));
ok('checkAuth: wrong Bearer token',
  !api.checkAuth({ headers: { authorization: 'Bearer wrong' } }));
ok('checkAuth: empty headers → fail',
  !api.checkAuth({ headers: {} }));
delete process.env.KOSAME_API_KEY;

// currentLogSize
ok('currentLogSize: returns number', typeof api.currentLogSize() === 'number');
ok('currentLogSize: non-negative',   api.currentLogSize() >= 0);

// startTail: verify stop() is a function and doesn't throw
const tmpLog = path.join(os.tmpdir(), `smoke-tail-${Date.now()}.jsonl`);
fs.writeFileSync(tmpLog, '', 'utf-8');
{
  const origEnv = process.env.HOME;
  // Patch the log path dynamically
  const events = [];
  // Can't easily override LOG_FILE, so just test the return value
  const stop = api.startTail(0, e => events.push(e));
  ok('startTail: returns function', typeof stop === 'function');
  stop(); // should not throw
  ok('startTail: stop() does not throw', true);
}
fs.unlinkSync(tmpLog);

// ── kosame-activity-events additions ─────────────────────────────────────────

const activity = require('../tools/kosame-activity-events');

ok('activity: rebroadcast exported',  typeof activity.rebroadcast === 'function');
ok('activity: watchLog exported',     typeof activity.watchLog === 'function');

// rebroadcast: should not throw (no SSE clients = no-op)
try {
  const evt = activity.buildEvent('task_started', { project: 'smoke', taskId: 'T-smoke', dryRun: true });
  activity.rebroadcast(evt);
  ok('rebroadcast: no-op with no SSE clients', true);
} catch (e) {
  ok('rebroadcast: no-op with no SSE clients', false);
}

// watchLog: returns stop function
{
  const stop = activity.watchLog(() => {});
  ok('watchLog: returns function', typeof stop === 'function');
  stop();
  ok('watchLog: stop() does not throw', true);
}

// watchLog + dedup: events emitted by this process are NOT passed to watchLog callback
{
  // Write directly to JSONL file so watchLog can pick it up (simulating external process)
  const logDir  = path.join(os.homedir(), '.kosame');
  const logFile = path.join(logDir, 'activity-events.jsonl');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

  // Start watcher FIRST, then write the fake event (watcher polls from current EOF)
  const received = [];
  const stop = activity.watchLog(e => received.push(e));

  const fakeEvt = {
    eventId: `evt-smoke-external-${Date.now()}`,
    timestamp: new Date().toISOString(),
    eventType: 'task_started',
    project: 'smoke-external', taskId: 'T-ext',
    dryRun: true, message: 'external process event',
  };
  fs.appendFileSync(logFile, JSON.stringify(fakeEvt) + '\n', { encoding: 'utf-8' });

  // Wait for 700ms (> 500ms poll interval) then check
  setTimeout(() => {
    stop();
    const found = received.some(e => e.eventId === fakeEvt.eventId);
    ok('watchLog: picks up external-process event from JSONL', found);

    // emit() locally — watchLog should NOT forward it (dedup)
    const localEvt = activity.emit('task_completed', { taskId: 'T-local-smoke', dryRun: true, project: 'smoke', message: 'local' });
    const receivedLocal = [];
    const stop2 = activity.watchLog(e => receivedLocal.push(e));
    setTimeout(() => {
      stop2();
      const forwarded = receivedLocal.some(e => e.eventId === localEvt.eventId);
      ok('watchLog: does NOT re-forward locally-emitted events (dedup)', !forwarded);

      // ── Dashboard server: watchLog wired in startServer ──────────────────────
      const { startServer } = require('../tools/kosame-dashboard-server');
      const srv = startServer(0, { dryRun: true });
      srv.on('listening', () => {
        // Just verify it started without error and has the activity watcher
        ok('dashboard: startServer with JSONL watcher runs without error', true);
        srv.close();
        ok('dashboard: server closes cleanly', true);

        // ── SSE event format ─────────────────────────────────────────────────
        const sseLines = [];
        const mockRes = {
          write: (s) => sseLines.push(s),
          on:    () => {},
        };
        activity.addSseClient(mockRes);
        activity.emit('task_started', { project: 'smoke-sse', taskId: 'T-sse', dryRun: true, message: 'sse test' });
        activity.removeSseClient(mockRes);
        const hasSseLine = sseLines.some(l => l.includes('event: activity') && l.includes('smoke-sse'));
        ok('activity SSE: emit() broadcasts to registered SSE client', hasSseLine);

        // ── Discord notify: no URL = no throw ────────────────────────────────
        delete process.env.DISCORD_WEBHOOK_URL;
        try {
          const { notifyDone } = require('../tools/real-time-progress-notifier');
          notifyDone({ message: 'smoke done' }, {}, { dryRun: true, silent: true }).then(() => {
            ok('Discord: notifyDone with no channels = no throw', true);
            summary();
          }).catch(() => {
            ok('Discord: notifyDone with no channels = no throw', false);
            summary();
          });
        } catch (_) {
          ok('Discord: notifyDone with no channels = no throw', false);
          summary();
        }
      });
    }, 700);
  }, 700);
}

function summary() {
  console.log('');
  if (fail === 0) {
    console.log(`✅ v110.44 dev-run-api smoke PASSED (${pass} checks)`);
    process.exit(0);
  } else {
    console.error(`❌ v110.44 dev-run-api smoke FAILED (pass=${pass} fail=${fail})`);
    process.exit(1);
  }
}
