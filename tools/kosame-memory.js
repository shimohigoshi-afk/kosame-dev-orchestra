'use strict';

// KOSAME Memory — persistent key decisions across sessions.
// Reads .kosame-state/memory.json and returns formatted context block.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.kosame-state');
const MEMORY_FILE = path.join(STATE_DIR, 'memory.json');

const DEFAULT_MEMORY = {
  entries: [
    { key: 'sales_dx_status', value: '営業DXはv0.8.0まで完成。それ以降の開発は行わない。' },
    { key: 'model_priority', value: 'モデル優先順位は Claude → Gemini → Llama / Groq。' },
    { key: 'fk_omiya_repo', value: 'FK大宮は別リポジトリ。KOSAME Sales Consoleとして本リポジトリとは別管理。' },
  ],
  updated: new Date().toISOString(),
};

function _ensureDir() {
  if (!fs.existsSync(STATE_DIR)) {
    fs.mkdirSync(STATE_DIR, { recursive: true });
  }
}

function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_FILE)) return DEFAULT_MEMORY;
    const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
    return JSON.parse(raw);
  } catch { return DEFAULT_MEMORY; }
}

function formatMemoryForContext(memory) {
  const entries = (memory && Array.isArray(memory.entries)) ? memory.entries : DEFAULT_MEMORY.entries;
  if (entries.length === 0) return '';
  const lines = entries.map(e => `- ${e.value}`);
  return `【KOSAME Memory — 重要な方針・決定事項】\n${lines.join('\n')}`;
}

module.exports = {
  loadMemory,
  formatMemoryForContext,
  MEMORY_FILE,
  DEFAULT_MEMORY,
};
