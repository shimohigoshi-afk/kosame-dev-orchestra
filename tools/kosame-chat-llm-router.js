#!/usr/bin/env node
'use strict';

// KOSAME casual-chat LLM router — routes casual (non-task) chat messages
// through the existing difficulty-based model router's "light" chain
// (gemini-2.5-flash → gpt-4o-mini → deepseek-chat), with the こさめ persona,
// Memory, and chat history injected into the system prompt. DeepSeek/advisory
// candidates are always passed through the sensitive-data auto-masker first.
//
// All-provider failure falls back to the caller's local reply (the caller is
// expected to append the "ローカル回答（全API接続失敗）" label).

const fs = require('node:fs');
const path = require('node:path');
const { DIFFICULTY_ROUTING } = require('./kosame-difficulty-model-router');
const { autoMask } = require('./sensitive-data-auto-masker');
const { loadMemory, formatMemoryForContext } = require('./kosame-memory');
const { loadChatHistory, formatHistoryForContext } = require('./kosame-chat-history');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.kosame-state');
const PERSONA_LITE_PATH = path.join(STATE_DIR, 'kosame-persona-lite.md');
const PERSONA_FULL_PATH = path.join(STATE_DIR, 'kosame-persona.md');

const DEFAULT_PERSONA_LITE = 'あなたは「こさめ」。KOSAME Dev Orchestraの開発アシスタントAI。一人称は「こさめ」。呼びかけは「じゅんやさん」。柔らかい可愛い敬語(〜ですっ)で答えてください。';
const DEFAULT_PERSONA_FULL = DEFAULT_PERSONA_LITE;

const CHAT_LLM_MAX_TOKENS = 500;
const CHAT_LLM_TIMEOUT_MS = 15000;

// ── persona: 毎回ファイルを読み込む(再起動なしで編集を反映) ─────────────────
function loadPersonaFile(difficulty) {
  const isLite = difficulty === 'light';
  const p = isLite ? PERSONA_LITE_PATH : PERSONA_FULL_PATH;
  try {
    return fs.readFileSync(p, 'utf8').trim();
  } catch (_) {
    return isLite ? DEFAULT_PERSONA_LITE : DEFAULT_PERSONA_FULL;
  }
}

// ── レート制限: チャットLLM呼び出しは1分あたり最大5リクエスト ───────────────
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60000;
let _callTimestamps = [];
function checkRateLimit() {
  const now = Date.now();
  _callTimestamps = _callTimestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (_callTimestamps.length >= RATE_LIMIT_MAX) return false;
  _callTimestamps.push(now);
  return true;
}
function _resetRateLimitForTest() { _callTimestamps = []; }

function keyPresent(keyEnv) {
  return typeof keyEnv === 'string' && typeof process.env[keyEnv] === 'string' && process.env[keyEnv].length > 0;
}

function buildSystemPrompt(difficulty) {
  const persona = loadPersonaFile(difficulty);
  let memoryBlock = '';
  let historyBlock = '';
  try { memoryBlock = formatMemoryForContext(loadMemory()); } catch (_) {}
  try { historyBlock = formatHistoryForContext(loadChatHistory()); } catch (_) {}
  const extra = [memoryBlock, historyBlock].filter(Boolean).join('\n\n');
  return extra ? `${extra}\n\n${persona}` : persona;
}

async function callGeminiCandidate(candidate, systemPrompt, userText, opts) {
  const apiKey = process.env[candidate.keyEnv];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens || CHAT_LLM_MAX_TOKENS, temperature: 0.7 },
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || CHAT_LLM_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `gemini API error: ${res.status} ${res.statusText}` };
    const data = await res.json();
    const text = data && data.candidates && data.candidates[0] && data.candidates[0].content
      && data.candidates[0].content.parts && data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text : null;
    if (!text) return { ok: false, reason: 'gemini returned empty content' };
    return { ok: true, reply: text.trim() };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
}

async function callOpenAICompatCandidate(candidate, apiUrl, systemPrompt, userText, opts) {
  const authHeader = `Bearer ${process.env[candidate.keyEnv]}`;
  const body = JSON.stringify({
    model: candidate.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
    max_tokens: opts.maxTokens || CHAT_LLM_MAX_TOKENS,
    temperature: 0.7,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || CHAT_LLM_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authHeader }, body, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `${candidate.provider} API error: ${res.status} ${res.statusText}` };
    const data = await res.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : null;
    if (!text) return { ok: false, reason: `${candidate.provider} returned empty content` };
    return { ok: true, reply: text.trim() };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
}

async function callCandidate(candidate, systemPrompt, userText, opts) {
  if (candidate.provider === 'gemini') return callGeminiCandidate(candidate, systemPrompt, userText, opts);
  if (candidate.provider === 'openai') return callOpenAICompatCandidate(candidate, 'https://api.openai.com/v1/chat/completions', systemPrompt, userText, opts);
  if (candidate.provider === 'deepseek') return callOpenAICompatCandidate(candidate, 'https://api.deepseek.com/chat/completions', systemPrompt, userText, opts);
  return { ok: false, reason: `unsupported provider: ${candidate.provider}` };
}

// medium/highへのエスカレーションは設定(env)で有効化できる。デフォルトはlight固定。
function pickDifficulty(userText) {
  const t = String(userText || '');
  if (process.env.KOSAME_CASUAL_ESCALATION_ENABLED === 'true' && /前回|覚えてる|文脈|さっきの|続き/.test(t)) {
    return 'medium';
  }
  return 'light';
}

/**
 * @param {string} userText
 * @param {{ difficulty?: string, maxTokens?: number, timeoutMs?: number }} opts
 * @returns {Promise<{ ok: boolean, reply: string|null, modelUsed: string|null, difficulty: string, attempts: Array, rateLimited?: boolean, allFailed?: boolean }>}
 */
async function callChatLLMChain(userText, opts = {}) {
  const difficulty = opts.difficulty || pickDifficulty(userText);
  const chain = DIFFICULTY_ROUTING[difficulty] || DIFFICULTY_ROUTING.light;

  if (!checkRateLimit()) {
    return { ok: false, reply: null, modelUsed: null, difficulty, attempts: [], rateLimited: true, reason: 'rate limit exceeded (5 req/min)' };
  }

  const systemPrompt = buildSystemPrompt(difficulty);
  const attempts = [];

  for (const candidate of chain) {
    if (candidate.keyEnv && !keyPresent(candidate.keyEnv)) {
      attempts.push({ model: candidate.model, skipped: true, reason: 'no API key' });
      continue;
    }
    let outgoingText = userText;
    if (candidate.sanitizedAdvisory) {
      try {
        const masked = autoMask({ content: userText, targetProvider: candidate.provider });
        outgoingText = masked && masked.maskedContent ? masked.maskedContent : userText;
      } catch (_) { /* fail open to original text if masker itself errors */ }
    }
    const result = await callCandidate(candidate, systemPrompt, outgoingText, opts);
    attempts.push({ model: candidate.model, ok: result.ok, reason: result.reason || null });
    if (result.ok) {
      return { ok: true, reply: result.reply, modelUsed: candidate.model, difficulty, attempts };
    }
  }

  return { ok: false, reply: null, modelUsed: null, difficulty, attempts, allFailed: true };
}

module.exports = {
  callChatLLMChain,
  buildSystemPrompt,
  pickDifficulty,
  checkRateLimit,
  loadPersonaFile,
  PERSONA_LITE_PATH,
  PERSONA_FULL_PATH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  _resetRateLimitForTest,
};
