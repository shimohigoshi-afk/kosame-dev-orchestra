'use strict';

const TOOL_META = {
  version: '110.9.0',
  title: 'Colored Section Logger',
  slug: 'colored-section-logger'
};

// ANSI color palette
const C = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  cyan:    '\x1b[36m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m'
};

const LEVEL_COLORS = {
  info:    C.cyan,
  success: C.green,
  warn:    C.yellow,
  error:   C.red,
  debug:   C.dim
};

const LEVEL_PREFIXES = {
  info:    'INFO ',
  success: 'OK   ',
  warn:    'WARN ',
  error:   'ERR  ',
  debug:   'DBG  '
};

function _ts() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

function _noColor() {
  return process.env.NO_COLOR === '1' || process.env.TERM === 'dumb';
}

function _c(code) {
  return _noColor() ? '' : code;
}

function _line(char, width) {
  return char.repeat(width);
}

/**
 * Print colored section open marker.
 * Example: ══════════════ ===ここから=== [sectionName] ══════════════
 */
function sectionStart(sectionName, opts) {
  const { width = 56, color = C.green, out = console.log } = opts || {};
  const label  = sectionName ? ` [${sectionName}]` : '';
  const marker = `===ここから===${label}`;
  const pad    = Math.max(0, Math.floor((width - marker.length - 2) / 2));
  const bar    = _line('═', pad);
  out(`${_c(C.bold)}${_c(color)}${bar} ${marker} ${bar}${_c(C.reset)}`);
}

/**
 * Print colored section close marker.
 * Example: ══════════════ ===ここまで=== [sectionName] ══════════════
 */
function sectionEnd(sectionName, opts) {
  const { width = 56, color = C.cyan, out = console.log } = opts || {};
  const label  = sectionName ? ` [${sectionName}]` : '';
  const marker = `===ここまで===${label}`;
  const pad    = Math.max(0, Math.floor((width - marker.length - 2) / 2));
  const bar    = _line('═', pad);
  out(`${_c(C.bold)}${_c(color)}${bar} ${marker} ${bar}${_c(C.reset)}`);
}

/**
 * Log a single line with level-based color.
 * @param {'info'|'success'|'warn'|'error'|'debug'} level
 * @param {string} message
 * @param {object} [opts]  { ts: bool, out: function }
 */
function log(level, message, opts) {
  const { ts = false, out = console.log } = opts || {};
  const lvl    = (level || 'info').toLowerCase();
  const color  = LEVEL_COLORS[lvl]   || C.white;
  const prefix = LEVEL_PREFIXES[lvl] || '     ';
  const time   = ts ? `${_c(C.dim)}[${_ts()}] ${_c(C.reset)}` : '';
  out(`${time}${_c(C.bold)}${_c(color)}${prefix}${_c(C.reset)}${message}`);
}

/**
 * Run fn() wrapped in section open/close markers.
 * Returns whatever fn() returns.
 */
function section(sectionName, fn, opts) {
  sectionStart(sectionName, opts);
  let result;
  try {
    result = fn();
  } finally {
    sectionEnd(sectionName, opts);
  }
  return result;
}

/**
 * Async version of section().
 */
async function sectionAsync(sectionName, fn, opts) {
  sectionStart(sectionName, opts);
  let result;
  try {
    result = await fn();
  } finally {
    sectionEnd(sectionName, opts);
  }
  return result;
}

function main() {
  sectionStart('Secret Manager 読み込み');
  log('info',    'GCP プロジェクト: kosame-prod');
  log('success', 'OPENAI_API_KEY — Secret Manager から取得');
  log('warn',    'GEMINI_API_KEY — env fallback を使用');
  log('error',   'UNKNOWN_KEY — 取得失敗');
  sectionEnd('Secret Manager 読み込み');

  console.log('');
  sectionStart('キーロード完了', { color: '\x1b[35m' });
  log('success', '全キー解決完了 (1/3 SM, 1/3 env, 1/3 missing)');
  sectionEnd('キーロード完了', { color: '\x1b[35m' });
}

if (require.main === module) main();

module.exports = {
  TOOL_META,
  C,
  LEVEL_COLORS,
  sectionStart,
  sectionEnd,
  log,
  section,
  sectionAsync
};
