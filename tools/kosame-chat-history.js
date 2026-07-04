'use strict';

// KOSAME CHAT history persistence (JSONL).
// Saves all user messages + kosame replies to .kosame-state/chat-history.jsonl
// On load, returns last N entries for GPT context injection.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.kosame-state');
const HISTORY_FILE = path.join(STATE_DIR, 'chat-history.jsonl');
const MAX_LOAD_ENTRIES = 20;

function _ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function loadChatHistory(limit = MAX_LOAD_ENTRIES) {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const lines = raw.trim().split('\n').filter(Boolean);
    return lines.slice(-limit).map(line => {
      try { return JSON.parse(line); } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}

function appendChatHistory(entry) {
  _ensureDir();
  try {
    const line = JSON.stringify({
      role: entry.role || 'unknown',
      content: String(entry.content || '').slice(0, 2000),
      timestamp: entry.timestamp || new Date().toISOString(),
    }) + '\n';
    fs.appendFileSync(HISTORY_FILE, line, 'utf8');
  } catch (err) {
    process.stderr.write(`[chat-history] save error: ${err.message}\n`);
  }
}

function formatHistoryForContext(entries) {
  if (!entries || entries.length === 0) return '';
  const lines = entries.map(e => {
    const label = e.role === 'user' ? 'User' : 'こさめ';
    return `${label}: ${e.content.slice(0, 200)}`;
  });
  return `【最近の会話履歴（直近${entries.length}件）】\n${lines.join('\n')}`;
}

module.exports = {
  loadChatHistory,
  appendChatHistory,
  formatHistoryForContext,
  HISTORY_FILE,
  MAX_LOAD_ENTRIES,
};
