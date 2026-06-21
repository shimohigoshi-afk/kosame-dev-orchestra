'use strict';

// KOSAME CHAT session persistence.
// Stores conversation history in .kosame-sessions/<sessionId>.json
// Max 200 messages stored per session; GPT receives last 20.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SESSIONS_DIR = path.join(ROOT, '.kosame-sessions');
const MAX_MESSAGES_TOTAL = 200;
const MAX_MESSAGES_FOR_GPT = 20;

function _sessionPath(sessionId) {
  const safe = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  if (!safe) return null;
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

function loadSession(sessionId) {
  const filePath = _sessionPath(sessionId);
  if (!filePath) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function appendToSession(sessionId, messages) {
  const filePath = _sessionPath(sessionId);
  if (!filePath) return;
  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }
    const current = loadSession(sessionId);
    const updated = [...current, ...messages].slice(-MAX_MESSAGES_TOTAL);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
  } catch (e) {
    process.stderr.write(`[sessions] write error: ${e.message}\n`);
  }
}

function getSessionForGPT(sessionId, maxMessages = MAX_MESSAGES_FOR_GPT) {
  const messages = loadSession(sessionId);
  return messages.slice(-maxMessages);
}

module.exports = { loadSession, appendToSession, getSessionForGPT, SESSIONS_DIR };
