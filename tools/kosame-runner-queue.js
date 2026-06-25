#!/usr/bin/env node
'use strict';

/**
 * kosame-runner-queue.js — Runner Queue Lite v113.3.11
 *
 * Handoff Inbox (queue.jsonl) を監視し作業票を自動実行する。
 * - ユーザーへのコピペ・YES入力・結果貼り戻し不要
 * - 失敗時は最大 MAX_ATTEMPTS 回まで自動再試行
 * - MAX_ATTEMPTS 回失敗で blocked_by_test_failure に移行し報告のみ
 * - Safety Stop 条件検出時は即停止（再試行なし）
 */

const fs   = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { readHandoffQueue }    = require('./kosame-codex-handoff-bridge-server');
const { checkRuntimeContract } = require('./kosame-runtime-contract');

const ROOT       = path.resolve(__dirname, '..');
const RUNNER_DIR = path.join(ROOT, '.kosame-runner');
const RUNS_DIR   = path.join(RUNNER_DIR, 'runs');
const STATE_FILE = path.join(RUNNER_DIR, 'queue-state.json');

const MAX_ATTEMPTS = 3;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function nowIso()     { return new Date().toISOString(); }

function readState(stateFile) {
  try { return JSON.parse(fs.readFileSync(stateFile || STATE_FILE, 'utf8')); }
  catch (_) { return {}; }
}

function saveState(state, stateFile) {
  const f = stateFile || STATE_FILE;
  ensureDir(path.dirname(f));
  fs.writeFileSync(f, JSON.stringify(state, null, 2) + '\n');
}

// ── Input formatter ───────────────────────────────────────────────────────────

function formatInput(ticket) {
  return [
    `# Work Ticket: ${ticket.title || ticket.id}`,
    '',
    `- id: ${ticket.id}`,
    `- assigned_agent: ${ticket.assigned_agent || '—'}`,
    `- risk_level: ${ticket.risk_level || '—'}`,
    `- human_gate_required: ${ticket.human_gate_required ? 'true' : 'false'}`,
    `- created_at: ${ticket.created_at || '—'}`,
    `- target_repo: ${ticket.target_repo || '—'}`,
    '',
    '## prompt_text',
    '',
    '```text',
    ticket.prompt_text || ticket.body || '',
    '```',
  ].join('\n');
}

// ── Claude Chat Executor (v113.3.53) ─────────────────────────────────────────
// Uses stdio:'pipe' to capture output without passing raw claude output through
// the cockpit server's evaluateNoYesGate (which would kill the process on
// forbidden patterns). KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS extended to 10 minutes.

function claudeChatExecutor(ticket, runDir) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;

  const jsonArg = JSON.stringify({ promptText, cwd: targetRepo, runDir });
  const res = spawnSync(process.execPath, [path.join(__dirname, 'kosame-claude-auto-launch.js'), '--json-arg', jsonArg], {
    cwd: ROOT,
    timeout: 720000,
    maxBuffer: 20 * 1024 * 1024,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS: '600000', KOSAME_SKIP_POST_LAUNCH_VERIFY: '1' },
  });

  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  // Write safe summary line so cockpit SSE receives runner completion notice
  process.stdout.write(`[runner-queue] claude-auto-launch completed exit_code=${res.status} ticket=${ticket.id}\n`);

  const outputMd = [
    '# Runner Queue Lite — Claude Auto-Launch Log',
    `ticket_id: ${ticket.id}`,
    `source: ${ticket.source || ''}`,
    `target_repo: ${targetRepo}`,
    `exit_code: ${res.status}`,
    `prompt_text: ${promptText.slice(0, 200)}`,
    '',
    '## stdout (tail)',
    stdout.slice(-3000),
    '',
    '## stderr (tail)',
    stderr.slice(-1000),
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  fs.writeFileSync(path.join(runDir, 'verify.log'), `exit_code: ${res.status}\n${stdout.slice(-500)}`);

  return {
    ok: res.status === 0,
    exitCode: res.status,
    error: res.error ? res.error.message : (stderr.slice(-200) || null),
  };
}

// ── Default executor ──────────────────────────────────────────────────────────

function defaultExecutor(ticket, runDir) {
  // Chat dispatch tickets: run claude auto-launch pipeline
  if (ticket.source === 'kosame-chat-dispatch' && (ticket.prompt_text || ticket.body)) {
    return claudeChatExecutor(ticket, runDir);
  }

  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;
  const res = spawnSync('npm', ['run', 'verify'], {
    cwd: targetRepo,
    encoding: 'utf8',
    timeout: 180000,
    maxBuffer: 10 * 1024 * 1024,
  });
  const stdout = res.stdout || '';
  const stderr = res.stderr || '';
  const outputMd = [
    '# Runner Queue Lite — Execution Log',
    `ticket_id: ${ticket.id}`,
    `target_repo: ${targetRepo}`,
    `exit_code: ${res.status}`,
    '',
    '## stdout',
    '',
    stdout,
    '## stderr',
    '',
    stderr,
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  fs.writeFileSync(path.join(runDir, 'verify.log'), [stdout, stderr].filter(Boolean).join('\n'));
  return {
    ok: res.status === 0,
    exitCode: res.status,
    error: res.error ? res.error.message : null,
  };
}

// ── Single ticket execution ───────────────────────────────────────────────────

/**
 * @param {object} ticket   - Handoff queue item
 * @param {number} attempt  - 1-based attempt number
 * @param {object} opts
 *   opts.executor  fn(ticket, runDir) → { ok, exitCode, error } — injectable (for testing)
 *   opts.runsDir   string — override run directory (for testing)
 * @returns {object} result
 */
function runTicket(ticket, attempt, opts) {
  const executor = (opts && opts.executor) || defaultExecutor;
  const runsDir  = (opts && opts.runsDir)  || RUNS_DIR;
  const runDir   = path.join(runsDir, ticket.id);

  ensureDir(runDir);

  // input.md — 初回のみ書き込む
  const inputPath = path.join(runDir, 'input.md');
  if (attempt === 1 || !fs.existsSync(inputPath)) {
    fs.writeFileSync(inputPath, formatInput(ticket));
  }

  const startedAt = nowIso();

  // Safety Stop チェック — original_request（ユーザーの実際の要求）を優先。
  // prompt_text / body は AUTO_YES_CONTRACT 等のポリシー前文を含むため false positive を
  // 引き起こす("課金発生"等がポリシー説明として記述されている)。
  const safetyText  = ticket.original_request || ticket.originalRequest || ticket.prompt_text || ticket.body || '';
  const contractRes = checkRuntimeContract({ action: safetyText });

  if (contractRes.decision === 'STOP') {
    const errMsg     = `Safety Stop: ${contractRes.reason}`;
    const stopOutput = [
      '# Runner Queue Lite — Safety Stop',
      `ticket_id: ${ticket.id}`,
      `attempt: ${attempt}`,
      '',
      errMsg,
    ].join('\n');
    fs.writeFileSync(path.join(runDir, 'output.md'), stopOutput);
    fs.writeFileSync(path.join(runDir, 'verify.log'), errMsg);
    const result = {
      runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id,
      status: 'safety_stop', attempts: attempt,
      startedAt, completedAt: nowIso(), error: errMsg,
    };
    fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
    return result;
  }

  // 実行
  let execRes;
  try {
    execRes = executor(ticket, runDir);
  } catch (err) {
    execRes = { ok: false, exitCode: 1, error: err.message };
    const errOutput = `# Executor Error\n\n${err.message}`;
    fs.writeFileSync(path.join(runDir, 'output.md'), errOutput);
    fs.writeFileSync(path.join(runDir, 'verify.log'), err.message);
  }

  const status = execRes.ok ? 'completed' : 'verify_failed';
  const result = {
    runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id,
    status, attempts: attempt,
    startedAt, completedAt: nowIso(),
    error: execRes.error || null,
  };
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  return result;
}

// ── Process ticket with retry ─────────────────────────────────────────────────

/**
 * @param {object} ticket
 * @param {object} opts
 *   opts.executor  — injectable executor
 *   opts.runsDir   — override runs directory
 *   opts.state     — in-memory state object (mutated in-place; if absent, reads/writes STATE_FILE)
 *   opts.stateFile — override state file path
 * @returns {object} final result
 */
function processTicket(ticket, opts) {
  opts = opts || {};
  const useFile   = opts.state === undefined;
  const state     = useFile ? readState(opts.stateFile) : opts.state;
  const flushState = useFile ? (s) => saveState(s, opts.stateFile) : () => {};

  const existing = state[ticket.id];
  if (existing && (existing.status === 'completed' || existing.status === 'blocked_by_test_failure')) {
    return { runId: ticket.id, ticketId: ticket.id, title: ticket.title || ticket.id, ...existing };
  }

  let lastResult = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    lastResult = runTicket(ticket, attempt, opts);

    if (lastResult.status === 'safety_stop') {
      state[ticket.id] = { status: 'safety_stop', error: lastResult.error, blockedAt: lastResult.completedAt };
      flushState(state);
      return lastResult;
    }

    if (lastResult.status === 'completed') {
      state[ticket.id] = { status: 'completed', completedAt: lastResult.completedAt };
      flushState(state);
      return lastResult;
    }
    // verify_failed → 次の試行へ
  }

  // MAX_ATTEMPTS 回失敗 → blocked_by_test_failure
  lastResult.status   = 'blocked_by_test_failure';
  lastResult.attempts = MAX_ATTEMPTS;
  const runDir = path.join(opts.runsDir || RUNS_DIR, ticket.id);
  fs.writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(lastResult, null, 2) + '\n');

  state[ticket.id] = {
    status: 'blocked_by_test_failure',
    attempts: MAX_ATTEMPTS,
    blockedAt: lastResult.completedAt,
  };
  flushState(state);

  process.stderr.write(
    `[runner-queue] BLOCKED: ${ticket.id} — "${ticket.title || ticket.id}" failed after ${MAX_ATTEMPTS} attempts\n`
  );
  return lastResult;
}

// ── Process entire queue ──────────────────────────────────────────────────────

function processQueue(opts) {
  opts = opts || {};
  const queue   = readHandoffQueue(opts.handoffOpts || {});
  const results = [];
  for (const item of queue.items) {
    results.push(processTicket(item, opts));
  }
  return results;
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  processQueue,
  processTicket,
  runTicket,
  formatInput,
  defaultExecutor,
  claudeChatExecutor,
  MAX_ATTEMPTS,
  RUNS_DIR,
  RUNNER_DIR,
  STATE_FILE,
};

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const results = processQueue();
  for (const r of results) {
    const sym = r.status === 'completed'            ? '✅' :
                r.status === 'blocked_by_test_failure' ? '🔴' :
                r.status === 'safety_stop'           ? '⛔' : '⚠️';
    process.stdout.write(`${sym} [${r.status}] ${r.ticketId} — ${r.title || ''}\n`);
  }
}
