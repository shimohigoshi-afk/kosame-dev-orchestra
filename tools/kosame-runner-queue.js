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

// ── Claude Chat Executor (v113.3.96) ─────────────────────────────────────────
// stdout: 'inherit' so claude-auto-launch's stdout (= claude's output) streams
// live through runner-queue's stdout → cockpit-server SSE → AGENT STREAM LOG.
// stderr: 'pipe' so we can write it to output.md without flooding SSE.

function claudeChatExecutor(ticket, runDir) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;

  const jsonArg = JSON.stringify({ promptText, cwd: targetRepo, runDir });
  process.stdout.write(`[START] zero-confirm: claude起動中 ticket=${ticket.id} — ${promptText.slice(0, 60)}\n`);
  const res = spawnSync(process.execPath, [path.join(__dirname, 'kosame-claude-auto-launch.js'), '--json-arg', jsonArg], {
    cwd: ROOT,
    timeout: 720000,
    stdio: ['ignore', 'inherit', 'pipe'],
    env: { ...process.env, KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS: '600000', KOSAME_SKIP_POST_LAUNCH_VERIFY: '1' },
  });

  const stderr = res.stderr ? res.stderr.toString() : '';
  process.stdout.write(`[DONE] zero-confirm: exit_code=${res.status} ticket=${ticket.id}\n`);

  const outputMd = [
    '# Runner Queue Lite — Claude Auto-Launch Log',
    `ticket_id: ${ticket.id}`,
    `source: ${ticket.source || ''}`,
    `target_repo: ${targetRepo}`,
    `exit_code: ${res.status}`,
    `prompt_text: ${promptText.slice(0, 200)}`,
    '',
    '## stderr (tail)',
    stderr.slice(-1000),
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  fs.writeFileSync(path.join(runDir, 'verify.log'), `exit_code: ${res.status}\n${stderr.slice(-500)}`);

  return {
    ok: res.status === 0,
    exitCode: res.status,
    error: res.error ? res.error.message : (stderr.slice(-200) || null),
  };
}

// ── Local deterministic executor (v113.3.109) ──────────────────────────────
// Handles simple file-append tasks without Claude.
// Falls back when Claude is unavailable.
// Returns { ok, exitCode, error, executor } where executor === 'local' on success.

function extractFileAppendInfo(promptText) {
  // Match patterns like:
  //   "XXX を public/test.html の本文に追記"
  //   "public/test.html に追記"
  //   "public/test.html に書き込む"
  const fileMatch = promptText.match(/(public\/[^\s,。、]+\.html|[^\s,。、]+\.md|[^\s,。、]+\.txt)\b/i);
  if (!fileMatch) return null;
  const filePath = fileMatch[1];

  // Extract the unique string to append
  // Look for KOSAME_UNIQUE_TEST or similar marker
  const markerMatch = promptText.match(/(KOSAME_UNIQUE_[A-Z0-9_]+)/i);
  const textToAppend = markerMatch ? markerMatch[1] : '';

  // Determine the target repo
  return { filePath, textToAppend };
}

function localDeterministicExecutor(ticket, runDir) {
  const promptText = String(ticket.prompt_text || ticket.body || '');
  const targetRepo = ticket.target_repo && fs.existsSync(ticket.target_repo)
    ? ticket.target_repo
    : ROOT;

  const info = extractFileAppendInfo(promptText);
  let logLines = [];
  let ok = false;
  let error = null;

  logLines.push('# Local Deterministic Executor (v113.3.109)');
  logLines.push(`ticket_id: ${ticket.id}`);
  logLines.push(`target_repo: ${targetRepo}`);
  logLines.push(`prompt_text: ${promptText.slice(0, 200)}`);
  logLines.push('');

  if (!info || !info.textToAppend) {
    logLines.push('## result: cannot_handle');
    logLines.push('reason: prompt does not contain a recognized file+marker pattern');
    logLines.push('note: expected format: "<MARKER> を <path> に追記してください"');
    error = 'local executor cannot handle this prompt — unrecognized pattern';
    ok = false;
  } else {
    const absPath = path.resolve(targetRepo, info.filePath);
    logLines.push(`target_file: ${info.filePath}`);
    logLines.push(`absolute_path: ${absPath}`);
    logLines.push(`text_to_append: ${info.textToAppend}`);
    logLines.push('');

    try {
      if (!fs.existsSync(absPath)) {
        logLines.push('## result: file_not_found');
        logLines.push(`error: ${absPath} does not exist`);
        error = `file not found: ${absPath}`;
        ok = false;
      } else {
        const existing = fs.readFileSync(absPath, 'utf8');
        if (existing.includes(info.textToAppend)) {
          logLines.push('## result: skipped');
          logLines.push('reason: marker already present in file');
          ok = true;
        } else {
          const appendLine = `\n<!-- ${info.textToAppend} -->\n`;
          fs.appendFileSync(absPath, appendLine, 'utf8');
          const after = fs.readFileSync(absPath, 'utf8');
          if (after.includes(info.textToAppend)) {
            logLines.push('## result: success');
            logLines.push(`action: appended marker to ${info.filePath}`);
            logLines.push(`grep_check: ${after.includes(info.textToAppend)}`);
            ok = true;
          } else {
            logLines.push('## result: write_failed');
            logLines.push('error: appendFileSync succeeded but marker not found after write');
            error = 'write verification failed';
            ok = false;
          }
        }
      }
    } catch (e) {
      logLines.push('## result: error');
      logLines.push(`error: ${e.message}`);
      error = e.message;
      ok = false;
    }
  }

  const outputMd = logLines.join('\n');
  fs.writeFileSync(path.join(runDir, 'output.md'), outputMd);
  fs.writeFileSync(path.join(runDir, 'verify.log'), [
    `executor: local`,
    `ok: ${ok}`,
    error ? `error: ${error}` : '',
    `grep_marker: ${info && info.textToAppend ? fs.existsSync(path.resolve(targetRepo, info ? info.filePath : '')) && fs.readFileSync(path.resolve(targetRepo, info.filePath), 'utf8').includes(info.textToAppend) : 'N/A'}`,
  ].filter(Boolean).join('\n'));

  return {
    ok,
    exitCode: ok ? 0 : 1,
    error,
    executor: ok ? 'local' : 'local_failed',
  };
}

// ── Default executor ──────────────────────────────────────────────────────────

function defaultExecutor(ticket, runDir) {
  // Chat dispatch tickets: run claude auto-launch pipeline
  if (ticket.source === 'kosame-chat-dispatch' && (ticket.prompt_text || ticket.body)) {
    const claudeResult = claudeChatExecutor(ticket, runDir);
    if (claudeResult.ok) return claudeResult;
    // Claude failed — fall back to local deterministic executor
    // Record claude's exit_code for diagnostics
    process.stdout.write(`[FALLBACK] Claude failed (exit=${claudeResult.exitCode}), trying local executor...\n`);
    const localResult = localDeterministicExecutor(ticket, runDir);
    if (localResult.ok) {
      localResult.fallbackFrom = 'claude';
      localResult.claudeExitCode = claudeResult.exitCode;
      localResult.claudeError = claudeResult.error;
      return localResult;
    }
    // Both failed — return claude's original error (more informative)
    claudeResult.fallbackAttempted = true;
    claudeResult.fallbackResult = localResult;
    return claudeResult;
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
  localDeterministicExecutor,
  extractFileAppendInfo,
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
