#!/usr/bin/env node
'use strict';

// KOSAME casual-chat LLM router — routes casual (non-task) chat messages
// through a configurable model chain (.kosame-state/chat-model-config.json,
// hot-reloaded every call), with the こさめ persona, Memory, and chat history
// injected into the system prompt. DeepSeek/advisory candidates are always
// passed through the sensitive-data auto-masker first.
//
// All-provider failure falls back to the caller's local reply (the caller is
// expected to append the "ローカル回答（全API接続失敗）" label).

const fs = require('node:fs');
const path = require('node:path');
const { autoMask } = require('./sensitive-data-auto-masker');
const { loadMemory, formatMemoryForContext } = require('./kosame-memory');
const { loadChatHistory, formatHistoryForContext } = require('./kosame-chat-history');

const ROOT = path.resolve(__dirname, '..');
const STATE_DIR = path.join(ROOT, '.kosame-state');
const PERSONA_LITE_PATH = path.join(STATE_DIR, 'kosame-persona-lite.md');
const PERSONA_FULL_PATH = path.join(STATE_DIR, 'kosame-persona.md');
const CHAT_MODEL_CONFIG_PATH = path.join(STATE_DIR, 'chat-model-config.json');

const DEFAULT_PERSONA_LITE = 'あなたは「こさめ」。KOSAME Dev Orchestraの開発アシスタントAI。一人称は「こさめ」。呼びかけは「じゅんやさん」。柔らかい可愛い敬語(〜ですっ)で答えてください。';
const DEFAULT_PERSONA_FULL = DEFAULT_PERSONA_LITE;

const CHAT_LLM_MAX_TOKENS = 500;
const CHAT_LLM_TIMEOUT_MS = 15000;

// 雑談チャット専用のモデルチェーン。既知のモデル名 → provider/keyEnv の対応。
// chat-model-config.json はモデル名の文字列だけを指定するので、実際の
// 呼び出し方法(provider/keyEnv/sanitizedAdvisory)はここで解決する。
const MODEL_REGISTRY = {
  'claude-haiku-4-5': { provider: 'anthropic', keyEnv: 'ANTHROPIC_API_KEY' },
  'claude-sonnet-4-6': { provider: 'anthropic', keyEnv: 'ANTHROPIC_API_KEY' },
  'gemini-2.5-flash': { provider: 'gemini', keyEnv: 'GEMINI_API_KEY' },
  'gemini-2.5-pro': { provider: 'gemini', keyEnv: 'GEMINI_API_KEY' },
  'gpt-4o-mini': { provider: 'openai', keyEnv: 'OPENAI_API_KEY' },
  'gpt-4o': { provider: 'openai', keyEnv: 'OPENAI_API_KEY' },
  'deepseek-chat': { provider: 'deepseek', keyEnv: 'DEEPSEEK_API_KEY', sanitizedAdvisory: true },
};

const DEFAULT_CHAT_MODEL_CONFIG = {
  chain: ['claude-haiku-4-5', 'gemini-2.5-flash', 'gpt-4o-mini'],
  escalation: 'claude-sonnet-4-6',
};

function buildCandidateFromModelName(name) {
  const entry = MODEL_REGISTRY[name];
  if (!entry) return null;
  return { model: name, ...entry };
}

// ── chat-model-config.json: 毎回読み込む(再起動なしで編集を反映) ────────────
function loadChatModelConfig() {
  try {
    const raw = fs.readFileSync(CHAT_MODEL_CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const chain = Array.isArray(parsed.chain) && parsed.chain.length ? parsed.chain : DEFAULT_CHAT_MODEL_CONFIG.chain;
    const escalation = typeof parsed.escalation === 'string' && parsed.escalation ? parsed.escalation : DEFAULT_CHAT_MODEL_CONFIG.escalation;
    return { chain, escalation };
  } catch (_) {
    return DEFAULT_CHAT_MODEL_CONFIG;
  }
}

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

async function callAnthropicCandidate(candidate, systemPrompt, userText, opts) {
  const apiUrl = 'https://api.anthropic.com/v1/messages';
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': `${process.env[candidate.keyEnv]}`,
    'anthropic-version': '2023-06-01',
  };
  const body = JSON.stringify({
    model: candidate.model,
    max_tokens: opts.maxTokens || CHAT_LLM_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userText }],
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs || CHAT_LLM_TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers, body, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, reason: `anthropic API error: ${res.status} ${res.statusText}` };
    const data = await res.json();
    const text = data && data.content && data.content[0] ? data.content[0].text : null;
    if (!text) return { ok: false, reason: 'anthropic returned empty content' };
    return { ok: true, reply: text.trim() };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
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
  if (candidate.provider === 'anthropic') return callAnthropicCandidate(candidate, systemPrompt, userText, opts);
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

async function _tryCandidate(candidate, systemPrompt, userText, opts, attempts) {
  if (!candidate) return null;
  if (candidate.keyEnv && !keyPresent(candidate.keyEnv)) {
    attempts.push({ model: candidate.model, skipped: true, reason: 'no API key' });
    return null;
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
  return result.ok ? result : null;
}

/**
 * @param {string} userText
 * @param {{ difficulty?: string, maxTokens?: number, timeoutMs?: number }} opts
 * @returns {Promise<{ ok: boolean, reply: string|null, modelUsed: string|null, difficulty: string, attempts: Array, rateLimited?: boolean, allFailed?: boolean, escalated?: boolean }>}
 */
async function callChatLLMChain(userText, opts = {}) {
  const difficulty = opts.difficulty || pickDifficulty(userText);
  const isEscalated = difficulty !== 'light';

  if (!checkRateLimit()) {
    return { ok: false, reply: null, modelUsed: null, difficulty, attempts: [], rateLimited: true, reason: 'rate limit exceeded (5 req/min)' };
  }

  const systemPrompt = buildSystemPrompt(difficulty);
  const attempts = [];
  const config = loadChatModelConfig();

  // 文脈参照等でmedium/highと判定された場合、まずエスカレーション先の
  // 単一モデル(既定: claude-sonnet-4-6)を試す。使えなければ通常チェーンに
  // フォールスルーする(エスカレーション先が使えない場合の保険)。
  if (isEscalated) {
    const escalationCandidate = buildCandidateFromModelName(config.escalation);
    const result = await _tryCandidate(escalationCandidate, systemPrompt, userText, opts, attempts);
    if (result) {
      return { ok: true, reply: result.reply, modelUsed: escalationCandidate.model, difficulty, attempts, escalated: true };
    }
  }

  for (const name of config.chain) {
    const candidate = buildCandidateFromModelName(name);
    if (!candidate) {
      attempts.push({ model: name, skipped: true, reason: 'unknown model (not in MODEL_REGISTRY)' });
      continue;
    }
    const result = await _tryCandidate(candidate, systemPrompt, userText, opts, attempts);
    if (result) {
      return { ok: true, reply: result.reply, modelUsed: candidate.model, difficulty, attempts, escalated: false };
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
  loadChatModelConfig,
  buildCandidateFromModelName,
  MODEL_REGISTRY,
  DEFAULT_CHAT_MODEL_CONFIG,
  PERSONA_LITE_PATH,
  PERSONA_FULL_PATH,
  CHAT_MODEL_CONFIG_PATH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  _resetRateLimitForTest,
};
