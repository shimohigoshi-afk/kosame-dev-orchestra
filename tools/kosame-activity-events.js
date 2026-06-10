#!/usr/bin/env node
'use strict';

/**
 * KOSAME Activity Events v110.43.0
 *
 * 開発実況イベント基盤 — append-only JSONL store + SSE emitter.
 *
 * NOTE on log rotation (trimLog):
 *   trimLog reads the entire file and rewrites it. If an emit() append
 *   happens during the read-write window, the append may be lost.
 *   This is acceptable for activity logs (non-critical, best-effort).
 *   In the future, consider flock (node:fs) or a separate rotation process.
 *
 * Usage:
 *   const events = require('./kosame-activity-events');
 *   events.emit('task_started', { project: 'kosame-dev-orchestra', taskId: 'T001', ... });
 *   events.getLatest(10).then(entries => ...);
 *   events.getTaskState('T001').then(state => ...);
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');
const readline = require('node:readline');

const TOOL_META = {
  version: '110.45.0',
  feature: 'v110-43-activity-events',
  slug:    'kosame-activity-events',
};

function _logDir()  { return path.join(process.env.HOME || os.homedir(), '.kosame'); }
function _logFile() { return path.join(_logDir(), 'activity-events.jsonl'); }
const MAX_EVENTS       = 2000;
const TRIM_TARGET      = 1000;
const DEDUP_WINDOW_MS  = 5000;
const MAX_SSE_CLIENTS  = 100;

// ── Event types ───────────────────────────────────────────────────────────────

const EVENT_TYPES = [
  'task_started', 'task_decomposed',
  'agent_assigned', 'agent_started',
  'file_read', 'file_changed',
  'verify_started', 'verify_passed', 'verify_failed',
  'repair_started',
  'review_started', 'review_passed', 'review_failed',
  'fallback_started',
  'human_gate',
  'task_completed', 'task_failed',
];

const AGENT_STATUS = {
  WORKING: 'WORKING', IDLE: 'IDLE', BLOCKED: 'BLOCKED',
  FAILED: 'FAILED', DONE: 'DONE',
};

// ── Redact (lightweight, consistent with auto-dev's redact) ────────────────────

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /AIza[0-9A-Za-z_-]{35,}/g,
  /xox[bpras]-[0-9A-Za-z-]{20,}/g,
  /gh[pousr]_[A-Za-z0-9]{36,}/g,
  /(?:^|[^a-zA-Z])(discord)?bot[._-]?token[=:]\s*\S{10,}/gi,
  /(?:^|[^a-zA-Z])api[._-]?key[=:]\s*\S{10,}/gi,
  /(?:^|[^a-zA-Z])secret[=:]\s*\S{10,}/gi,
];

function redact(text) {
  if (!text || typeof text !== 'string') return text || '';
  let result = text;
  for (const re of SECRET_PATTERNS) {
    result = result.replace(re, (m) => {
      if (m.length <= 8) return m;
      return m.slice(0, 4) + '[REDACTED]' + m.slice(-4);
    });
  }
  return result;
}

// ── Event builder ──────────────────────────────────────────────────────────────

let _idCounter = 0;
function buildEvent(eventType, data = {}) {
  if (!EVENT_TYPES.includes(eventType)) {
    throw new Error(`Unknown event type: ${eventType}`);
  }
  _idCounter++;
  const ts = new Date().toISOString();
  const meta = data.meta ? redact(JSON.stringify(data.meta)) : '{}';
  return {
    eventId:     `evt-${Date.now()}-${_idCounter}`,
    timestamp:   ts,
    eventType,
    project:     data.project    || '',
    taskId:      data.taskId     || '',
    parentTaskId: data.parentTaskId || '',
    mission:     data.mission    || '',
    agent:       data.agent      || '',
    provider:    data.provider   || '',
    model:       data.model      || '',
    stage:       data.stage      || '',
    status:      data.status     || '',
    progressCurrent: data.progressCurrent ?? null,
    progressTotal:   data.progressTotal   ?? null,
    progressPercent: data.progressPercent ?? null,
    currentFile: data.currentFile || '',
    elapsedMs:   data.elapsedMs   ?? null,
    message:     redact(String(data.message || '')).slice(0, 200),
    dryRun:      data.dryRun !== false,
    meta:        (() => { try { return JSON.parse(meta); } catch { return {}; } })(),
  };
}

// ── JSONL store ───────────────────────────────────────────────────────────────

function ensureLogFile() {
  const dir = _logDir();
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendToLog(event) {
  ensureLogFile();
  try {
    fs.appendFileSync(_logFile(), JSON.stringify(event) + '\n', { encoding: 'utf-8', mode: 0o600 });
  } catch (_) {}
}

async function readAll() {
  ensureLogFile();
  const lf = _logFile();
  if (!fs.existsSync(lf)) return [];
  const entries = [];
  try {
    const rl = readline.createInterface({ input: fs.createReadStream(lf, { encoding: 'utf-8' }), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try { entries.push(JSON.parse(line)); } catch (_) { /* skip broken lines */ }
    }
  } catch (_) {}
  return entries;
}

async function getLatest(n = 100) {
  const all = await readAll();
  return all.slice(-Math.min(n, all.length)).reverse();
}

async function getTaskState(taskId) {
  const all = await readAll();
  const taskEvents = all.filter(e => e.taskId === taskId);
  if (taskEvents.length === 0) return null;
  const last = taskEvents[taskEvents.length - 1];
  return {
    taskId,
    eventType:  last.eventType,
    status:     last.status,
    agent:      last.agent,
    model:      last.model,
    stage:      last.stage,
    progressCurrent: last.progressCurrent ?? 0,
    progressTotal:   last.progressTotal   ?? 0,
    progressPercent: last.progressPercent ?? 0,
    currentFile: last.currentFile || '',
    elapsedMs:  last.elapsedMs   ?? 0,
    updatedAt:  last.timestamp,
    dryRun:     last.dryRun,
  };
}

async function getAllTaskStates() {
  const all = await readAll();
  const taskMap = {};
  for (const e of all) {
    if (e.taskId) taskMap[e.taskId] = e;
  }
  const result = {};
  for (const [taskId, last] of Object.entries(taskMap)) {
    result[taskId] = {
      taskId,
      eventType:  last.eventType,
      status:     last.status,
      agent:      last.agent,
      model:      last.model,
      stage:      last.stage,
      progressCurrent: last.progressCurrent ?? 0,
      progressTotal:   last.progressTotal   ?? 0,
      progressPercent: last.progressPercent ?? 0,
      currentFile: last.currentFile || '',
      elapsedMs:  last.elapsedMs   ?? 0,
      updatedAt:  last.timestamp,
      dryRun:     last.dryRun,
    };
  }
  return result;
}

function trimLog() {
  ensureLogFile();
  const lf = _logFile();
  if (!fs.existsSync(lf)) return;
  try {
    const stat = fs.statSync(lf);
    if (stat.size > 500_000) {
      const all = fs.readFileSync(lf, 'utf-8').split('\n').filter(Boolean);
      if (all.length > MAX_EVENTS) {
        fs.writeFileSync(lf, all.slice(-TRIM_TARGET).join('\n') + '\n', { encoding: 'utf-8', mode: 0o600 });
      }
    }
  } catch (_) {}
}

// ── Dedup ──────────────────────────────────────────────────────────────────────

const _recentEvents = new Map();

function isDuplicate(event) {
  const key = `${event.taskId}:${event.eventType}`;
  const last = _recentEvents.get(key);
  if (last && (Date.now() - last) < DEDUP_WINDOW_MS) return true;
  _recentEvents.set(key, Date.now());
  return false;
}

// ── Locally-emitted event tracking (for cross-process watcher dedup) ──────────

const _locallyEmitted = new Set();
const _LOCAL_MAX = 500;

function _markLocal(eventId) {
  _locallyEmitted.add(eventId);
  if (_locallyEmitted.size > _LOCAL_MAX) {
    const iter = _locallyEmitted.values();
    _locallyEmitted.delete(iter.next().value);
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

function emit(eventType, data = {}) {
  const event = buildEvent(eventType, data);
  if (isDuplicate(event)) return event;
  appendToLog(event);
  _markLocal(event.eventId);
  _broadcast(event);
  return event;
}

// Broadcast an event that originated in another process (no JSONL append, no local mark).
function rebroadcast(event) {
  _broadcast(event);
}

// ── Cross-process log watcher ─────────────────────────────────────────────────
// Polls the JSONL log for events written by other processes (e.g. spawned subprocesses).
// Skips events emitted by this process (_locallyEmitted) to avoid double-broadcast.
// Returns a stop() function.

function watchLog(onEvent) {
  const lf = _logFile();
  let pos = 0;
  try { if (fs.existsSync(lf)) pos = fs.statSync(lf).size; } catch (_) {}

  const tick = () => {
    try {
      if (!fs.existsSync(lf)) return;
      const size = fs.statSync(lf).size;
      if (size <= pos) return;
      const len = size - pos;
      const buf = Buffer.alloc(len);
      const fd  = fs.openSync(lf, 'r');
      fs.readSync(fd, buf, 0, len, pos);
      fs.closeSync(fd);
      pos = size;
      for (const line of buf.toString('utf-8').split('\n')) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (_locallyEmitted.has(event.eventId)) continue; // skip own events
          onEvent(event);
        } catch (_) {}
      }
    } catch (_) {}
  };

  const timer = setInterval(tick, 500);
  timer.unref();
  return () => clearInterval(timer);
}

// ── SSE emission ───────────────────────────────────────────────────────────────

const _sseClients = new Set();

function _broadcast(event) {
  const text = JSON.stringify(event);
  const payload = `event: activity\ndata: ${text}\n\n`;
  for (const res of _sseClients) {
    try { res.write(payload); } catch (_) { _sseClients.delete(res); }
  }
}

function addSseClient(res) {
  if (_sseClients.size >= MAX_SSE_CLIENTS) {
    try { res.write('event: error\ndata: {"error":"too_many_clients"}\n\n'); res.end(); } catch (_) {}
    return;
  }
  _sseClients.add(res);
  res.write(': connected\n\n');
  res.on('close', () => _sseClients.delete(res));
}

function removeSseClient(res) {
  _sseClients.delete(res);
}

function sseClientCount() { return _sseClients.size; }

// ── Periodic trim ──────────────────────────────────────────────────────────────

setInterval(trimLog, 300_000).unref(); // every 5 minutes — unref so smoke tests exit cleanly

// ── Exports ────────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  EVENT_TYPES,
  AGENT_STATUS,
  buildEvent,
  emit,
  rebroadcast,
  watchLog,
  redact,
  appendToLog,
  readAll,
  getLatest,
  getTaskState,
  getAllTaskStates,
  trimLog,
  addSseClient,
  removeSseClient,
  sseClientCount,
};
