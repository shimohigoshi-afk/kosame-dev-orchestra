#!/usr/bin/env node
'use strict';

/**
 * KOSAME Learning Log v110.24.0
 *
 * タスク実行結果を ~/.kosame/learning-log.jsonl に追記する（書き込み専用）。
 * 読み取り実装は後回し（v110.25 以降予定）。
 *
 * 記録スキーマ:
 *   ts          ISO8601 タイムスタンプ
 *   taskInput   タスク説明（先頭 120 文字）
 *   taskType    'smoke' | 'fix' | 'implement' | 'design' | 'deploy' | 'other'
 *   difficulty  'light' | 'medium' | 'high'
 *   model       使用モデル名
 *   provider    プロバイダー名
 *   costUsd     実コスト（不明は null）
 *   durationMs  所要時間 ms（不明は null）
 *   success     true | false | null（不明）
 *   escalated   フォールバックが発生したか
 *   dryRun      true | false
 *
 * Usage:
 *   npm run learning:log                              # ファイルパスと最新エントリ数を表示
 *   node tools/kosame-learning-log.js --tail=5       # 最新 5 件表示（メタのみ）
 *   node tools/kosame-learning-log.js --append --json='{"taskType":"fix",...}'
 */

const fs   = require('node:fs');
const path = require('node:path');
const os   = require('node:os');

const TOOL_META = {
  version: '110.24.0',
  feature: 'v110-24-learning-log',
  slug:    'kosame-learning-log',
};

const KOSAME_DIR = path.join(os.homedir(), '.kosame');
const LOG_FILE   = path.join(KOSAME_DIR, 'learning-log.jsonl');

const VALID_TASK_TYPES  = ['smoke', 'test', 'fix', 'implement', 'design', 'deploy', 'release', 'other'];
const VALID_DIFFICULTIES = ['light', 'medium', 'high'];

// ── Helpers ───────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green:  '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan:   '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

function ensureDir() {
  if (!fs.existsSync(KOSAME_DIR)) {
    fs.mkdirSync(KOSAME_DIR, { recursive: true, mode: 0o700 });
  }
}

// ── Entry builder ─────────────────────────────────────────────────────────────

/**
 * ログエントリを正規化する。
 */
function buildEntry(raw = {}) {
  const {
    taskInput   = '',
    taskType    = 'other',
    difficulty  = 'medium',
    model       = 'unknown',
    provider    = 'unknown',
    costUsd     = null,
    durationMs  = null,
    success     = null,
    escalated   = false,
    dryRun      = true,
    meta        = {},
  } = raw;

  const type  = VALID_TASK_TYPES.includes(taskType)   ? taskType  : 'other';
  const diff  = VALID_DIFFICULTIES.includes(difficulty) ? difficulty : 'medium';
  const cost  = typeof costUsd   === 'number' ? costUsd   : null;
  const dur   = typeof durationMs === 'number' ? durationMs : null;
  const ok    = typeof success   === 'boolean' ? success  : null;

  return {
    ts:         new Date().toISOString(),
    taskInput:  String(taskInput).slice(0, 120),
    taskType:   type,
    difficulty: diff,
    model:      String(model).slice(0, 64),
    provider:   String(provider).slice(0, 32),
    costUsd:    cost,
    durationMs: dur,
    success:    ok,
    escalated:  !!escalated,
    dryRun:     !!dryRun,
    meta,
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

/**
 * エントリを learning-log.jsonl に追記する。
 *
 * @param {object} raw  appendLog({ taskType, difficulty, model, ... })
 * @param {object} opts { dryRun }
 * @returns {{ ok, entry, dryRun, logFile }}
 */
function appendLog(raw = {}, opts = {}) {
  const { dryRun = true } = opts;
  const entry = buildEntry({ ...raw, dryRun });
  const line  = JSON.stringify(entry);

  if (!dryRun) {
    ensureDir();
    fs.appendFileSync(LOG_FILE, line + '\n', { encoding: 'utf8', mode: 0o600 });
  }

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    ok:      true,
    dryRun,
    logFile: LOG_FILE,
    entry,
    realProductActionsExecuted: !dryRun,
  };
}

// ── Status / tail ─────────────────────────────────────────────────────────────

function logStatus() {
  const exists  = fs.existsSync(LOG_FILE);
  let lineCount = 0;
  let sizeBytes = 0;
  if (exists) {
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    lineCount = content.split('\n').filter(Boolean).length;
    sizeBytes = Buffer.byteLength(content, 'utf8');
  }
  return { logFile: LOG_FILE, exists, lineCount, sizeBytes };
}

function tailLog(n = 10) {
  if (!fs.existsSync(LOG_FILE)) return [];
  const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean);
  return lines.slice(-n).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let tail = 0, appendMode = false, jsonStr = '', dryRun = true;
  for (const a of args) {
    if (a.startsWith('--tail='))  tail       = parseInt(a.slice(7), 10);
    if (a === '--append')         appendMode = true;
    if (a.startsWith('--json='))  jsonStr    = a.slice(7);
    if (a === '--write')          dryRun     = false;
  }
  return { tail, appendMode, jsonStr, dryRun };
}

function main() {
  const { tail, appendMode, jsonStr, dryRun } = parseArgs(process.argv);
  const status = logStatus();

  if (appendMode && jsonStr) {
    let raw;
    try { raw = JSON.parse(jsonStr); } catch {
      console.error('ERROR: invalid JSON for --json');
      process.exit(1);
    }
    const result = appendLog(raw, { dryRun });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Learning Log'))}  v${TOOL_META.version}`);
  console.log(`  ログファイル: ${c('cyan', LOG_FILE)}`);
  console.log(`  存在: ${status.exists ? c('green', 'yes') : c('gray', 'no (まだ書き込みなし)')}`);
  if (status.exists) {
    console.log(`  エントリ数  : ${status.lineCount}`);
    console.log(`  サイズ      : ${(status.sizeBytes / 1024).toFixed(1)} KB`);
  }

  const n = tail > 0 ? tail : (status.exists ? 3 : 0);
  if (n > 0 && status.exists) {
    const entries = tailLog(n);
    console.log(`\n  最新 ${entries.length} 件:`);
    for (const e of entries) {
      const ok = e.success === true ? c('green', '✓') : e.success === false ? c('red', '✗') : c('gray', '?');
      const cost = e.costUsd != null ? `$${e.costUsd.toFixed(6)}` : c('dim', 'n/a');
      const dur  = e.durationMs != null ? `${e.durationMs}ms` : c('dim', 'n/a');
      console.log(`    ${ok} [${e.difficulty.padEnd(6)}] ${e.model.padEnd(22)} ${cost}  ${dur}  ${c('dim', e.taskInput.slice(0, 35))}`);
    }
  }

  console.log(`\n  ${c('dim', '書き込み専用。読み取り機能は v110.25 以降で実装予定。')}`);
  console.log(`  追記コマンド: node tools/kosame-learning-log.js --append --json='{"taskType":"fix",...}' --write`);
  console.log('');
}

if (require.main === module) {
  try { main(); } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

module.exports = {
  TOOL_META,
  LOG_FILE,
  VALID_TASK_TYPES,
  VALID_DIFFICULTIES,
  buildEntry,
  appendLog,
  logStatus,
  tailLog,
};
