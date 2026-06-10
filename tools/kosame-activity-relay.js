#!/usr/bin/env node
'use strict';

/**
 * KOSAME Activity Relay v110.45.0
 *
 * Watches the local activity-events.jsonl and relays events to Cloud Run
 * Dashboard's /api/activity/ingest endpoint.
 *
 * Design principles:
 *   - Local JSONL recording is preserved (primary store)
 *   - Cloud Run send failures do NOT stop auto-dev
 *   - Exponential backoff with max retries
 *   - Duplicate eventId prevention (in-memory set + queue file dedup)
 *   - Offline queue persisted to ~/.kosame/activity-relay-queue.jsonl
 *   - On restart, loads queue file and re-attempts pending sends
 *   - Secrets are NOT relayed (relies on upstream redact in activity-events.js)
 *   - Relay state recorded to learning-log
 *
 * Usage:
 *   KOSAME_CLOUD_RUN_URL=https://... KOSAME_API_KEY=... node tools/kosame-activity-relay.js
 *
 * Env:
 *   KOSAME_CLOUD_RUN_URL   (required) Cloud Run dashboard base URL
 *   KOSAME_API_KEY          (required) X-API-Key for ingest auth
 *   RELAY_POLL_MS           poll interval (default 1000)
 *   RELAY_MAX_RETRIES       max retries per event (default 5)
 *   RELAY_QUEUE_MAX         max queued events (default 500)
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const https = require('node:https');
const http = require('node:http');

const TOOL_META = {
  version: '110.45.0',
  feature: 'v110-45-activity-relay',
  slug:    'kosame-activity-relay',
};

const LOG_FILE    = path.join(os.homedir(), '.kosame', 'activity-events.jsonl');
const LEARN_LOG   = path.join(os.homedir(), '.kosame', 'learning-log.jsonl');
const QUEUE_FILE  = path.join(os.homedir(), '.kosame', 'activity-relay-queue.jsonl');

const RELAY_URL     = process.env.KOSAME_CLOUD_RUN_URL || '';
const API_KEY       = process.env.KOSAME_API_KEY       || '';
const POLL_MS       = parseInt(process.env.RELAY_POLL_MS || '1000', 10);
const MAX_RETRIES   = parseInt(process.env.RELAY_MAX_RETRIES || '5', 10);
const QUEUE_MAX     = parseInt(process.env.RELAY_QUEUE_MAX || '500', 10);
const QUEUE_FILE_MAX = 2000; // max lines before rotation

// ── State ────────────────────────────────────────────────────────────────────

let _pos     = 0;
let _stopped = false;

const _sent = new Set();
const _MAX_SENT = 10000;

const _queue = []; // { event, attempts, nextRetry, eventId }

let _relayOk    = 0;
let _relayFail  = 0;
let _lastSendMs = 0;

// ── Logging ──────────────────────────────────────────────────────────────────

function log(level, msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] [${level}] [relay] ${msg}`);
}

function recordLearningLog(entry) {
  try {
    const dir = path.dirname(LEARN_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      tool: 'kosame-activity-relay',
      version: TOOL_META.version,
      ...entry,
    }) + '\n';
    fs.appendFileSync(LEARN_LOG, line, { encoding: 'utf-8', mode: 0o600 });
  } catch (_) {}
}

// ── Queue file I/O ───────────────────────────────────────────────────────────

function ensureKosameDir() {
  const dir = path.dirname(QUEUE_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readQueueFile() {
  ensureKosameDir();
  if (!fs.existsSync(QUEUE_FILE)) return [];
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const events = [];
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      try {
        const parsed = JSON.parse(line);
        if (parsed && parsed.eventId) {
          events.push(parsed);
        }
      } catch (_) {}
    }
    return events;
  } catch (_) { return []; }
}

function appendQueueFile(entry) {
  ensureKosameDir();
  try {
    fs.appendFileSync(QUEUE_FILE, JSON.stringify(entry) + '\n', { encoding: 'utf-8', mode: 0o600 });
  } catch (_) {}
}

function removeFromQueueFile(eventId) {
  ensureKosameDir();
  if (!fs.existsSync(QUEUE_FILE)) return;
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const lines = raw.split('\n');
    const kept = lines.filter(line => {
      if (!line.trim()) return false;
      try {
        const p = JSON.parse(line);
        return p.eventId !== eventId;
      } catch (_) { return false; }
    });
    if (kept.length < lines.length) {
      fs.writeFileSync(QUEUE_FILE, kept.join('\n') + '\n', { encoding: 'utf-8', mode: 0o600 });
    }
  } catch (_) {}
}

function rotateQueueFile() {
  ensureKosameDir();
  if (!fs.existsSync(QUEUE_FILE)) return;
  try {
    const raw = fs.readFileSync(QUEUE_FILE, 'utf-8');
    const lines = raw.split('\n').filter(Boolean);
    if (lines.length > QUEUE_FILE_MAX) {
      fs.writeFileSync(QUEUE_FILE, lines.slice(-QUEUE_FILE_MAX).join('\n') + '\n', { encoding: 'utf-8', mode: 0o600 });
    }
  } catch (_) {}
}

// ── HTTP POST helper ─────────────────────────────────────────────────────────

function relayEvent(event) {
  if (!RELAY_URL) return Promise.resolve({ ok: false, error: 'no URL' });
  const url = RELAY_URL.replace(/\/+$/, '') + '/api/activity/ingest';
  const body = JSON.stringify(event);
  const isHttps = url.startsWith('https:');
  const mod = isHttps ? https : http;

  return new Promise((resolve) => {
    const parsed = new URL(url);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-API-Key': API_KEY,
      },
      timeout: 10000,
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        resolve({ ok, statusCode: res.statusCode });
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'timeout' });
    });

    req.write(body);
    req.end();
  });
}

// ── Queue flushing ───────────────────────────────────────────────────────────

let _flushing = false;

async function flushQueue() {
  if (_flushing || _queue.length === 0) return;
  _flushing = true;

  while (_queue.length > 0) {
    const item = _queue[0];
    const result = await relayEvent(item.event);
    if (result.ok) {
      _queue.shift();
      _markSent(item.event.eventId);
      removeFromQueueFile(item.event.eventId);
      _relayOk++;
      _lastSendMs = Date.now();
      log('info', `relayed ${item.event.eventType} ${item.event.eventId} (was queued)`);
    } else {
      item.attempts++;
      if (item.attempts >= MAX_RETRIES) {
        _queue.shift();
        removeFromQueueFile(item.event.eventId);
        _relayFail++;
        log('warn', `drop ${item.event.eventId} after ${item.attempts} retries`);
        recordLearningLog({
          eventType: 'relay_drop',
          eventId: item.event.eventId,
          reason: 'max_retries',
          taskId: item.event.taskId,
        });
      } else {
        const delay = Math.min(1000 * Math.pow(2, item.attempts), 30000);
        log('debug', `retry ${item.event.eventId} in ${delay}ms (attempt ${item.attempts})`);
        item.nextRetry = Date.now() + delay;
      }
      break;
    }
  }

  _flushing = false;
}

// ── Mark sent (dedup) ────────────────────────────────────────────────────────

function _markSent(eventId) {
  _sent.add(eventId);
  if (_sent.size > _MAX_SENT) {
    const iter = _sent.values();
    _sent.delete(iter.next().value);
  }
}

// ── Process a single event ───────────────────────────────────────────────────

async function processEvent(event) {
  if (!event || !event.eventId) return;
  const eventId = event.eventId;

  if (_sent.has(eventId)) return;
  if (_queue.some(q => q.event.eventId === eventId)) return;

  if (!RELAY_URL) return;

  const result = await relayEvent(event);
  if (result.ok) {
    _markSent(eventId);
    _relayOk++;
    _lastSendMs = Date.now();
  } else {
    _relayFail++;
    log('warn', `send failed ${eventId}: ${result.error || result.statusCode} — queued`);
    if (_queue.length < QUEUE_MAX) {
      const entry = { event, attempts: 0, nextRetry: 0, eventId };
      _queue.push(entry);
      appendQueueFile(entry);
    } else {
      log('warn', `queue full, drop ${eventId}`);
    }
    recordLearningLog({
      eventType: 'relay_failed',
      eventId,
      error: (result.error || String(result.statusCode)).slice(0, 80),
      taskId: event.taskId,
    });
  }
}

// ── JSONL watcher ────────────────────────────────────────────────────────────

function ensureLogFile() {
  const dir = path.dirname(LOG_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tick() {
  if (_stopped) return;

  try {
    ensureLogFile();
    if (!fs.existsSync(LOG_FILE)) return;
    const size = fs.statSync(LOG_FILE).size;
    if (size <= _pos) return;
    const len = size - _pos;
    const buf = Buffer.alloc(len);
    const fd  = fs.openSync(LOG_FILE, 'r');
    fs.readSync(fd, buf, 0, len, _pos);
    fs.closeSync(fd);
    _pos = size;

    const lines = buf.toString('utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        processEvent(event).catch(() => {});
      } catch (_) {}
    }
  } catch (_) {}

  flushQueue().catch(() => {});
  rotateQueueFile();
}

// ── Load persisted queue on startup ──────────────────────────────────────────

function loadPersistedQueue() {
  const persisted = readQueueFile();
  if (persisted.length === 0) return;
  log('info', `loading ${persisted.length} persisted queue entries`);
  for (const entry of persisted) {
    const eventId = entry.eventId || entry.event?.eventId;
    if (!eventId) continue;
    if (_sent.has(eventId)) {
      removeFromQueueFile(eventId);
      continue;
    }
    if (_queue.some(q => q.event.eventId === eventId)) continue;
    _queue.push({
      event: entry.event || entry,
      attempts: entry.attempts || 0,
      nextRetry: 0,
      eventId,
    });
  }
  if (_queue.length > 0) {
    log('info', `requeued ${_queue.length} events from persisted queue`);
  }
}

// ── Start / Stop ─────────────────────────────────────────────────────────────

function _stats() {
  return {
    ok: _relayOk,
    fail: _relayFail,
    queued: _queue.length,
    sent: _sent.size,
    lastSendMs: _lastSendMs,
    cloudRunUrl: RELAY_URL ? RELAY_URL.replace(/\/\/[^@]+@/, '//***@') : '',
  };
}

function start() {
  if (!RELAY_URL) {
    log('warn', 'KOSAME_CLOUD_RUN_URL not set — relay disabled');
    return { stop: () => {}, stats: _stats };
  }

  ensureLogFile();
  try { if (fs.existsSync(LOG_FILE)) _pos = fs.statSync(LOG_FILE).size; } catch (_) {}
  _pos = 0;
  _stopped = false;

  loadPersistedQueue();

  log('info', `relay started → ${RELAY_URL}`);
  log('info', `poll=${POLL_MS}ms maxRetries=${MAX_RETRIES} queueMax=${QUEUE_MAX}`);

  const timer = setInterval(tick, POLL_MS);
  timer.unref();

  recordLearningLog({
    eventType: 'relay_started',
    version: TOOL_META.version,
    cloudRunUrl: RELAY_URL.replace(/\/\/[^@]+@/, '//***@'),
  });

  return {
    stop: () => {
      _stopped = true;
      clearInterval(timer);
      log('info', `relay stopped (ok=${_relayOk} fail=${_relayFail} queued=${_queue.length})`);
      recordLearningLog({
        eventType: 'relay_stopped',
        relayOk: _relayOk,
        relayFail: _relayFail,
        queued: _queue.length,
      });
    },
    stats: _stats,
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const relay = start();
  process.on('SIGINT',  () => { relay.stop(); process.exit(0); });
  process.on('SIGTERM', () => { relay.stop(); process.exit(0); });
}

module.exports = { start };
