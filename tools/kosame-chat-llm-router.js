#!/usr/bin/env node
'use strict';

// KOSAME casual-chat LLM router — routes casual (non-task) chat messages
// through a configurable model chain (.kosame-state/chat-model-config.json,
// hot-reloaded every call), with the こさめ persona, Memory, and chat history
// injected into the system prompt. DeepSeek/advisory candidates are always
// passed through the sensitive-data auto-masker first.
//
// Anthropic/Gemini/OpenAI-compatible candidates stream tokens live via
// streamChatLLMChain(userText, opts, onChunk); DeepSeek (sanitizedAdvisory,
// no streaming support wired) is fetched in one shot and delivered to
// onChunk as a single chunk, so callers always see the same chunk/done
// shape regardless of which candidate answered.
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

// 雑談用は文脈(Memory+履歴)を含めても十分な長さで完結させたいので、
// 500 → 1500 に拡大。「〜じゅんやさんが「こ」で切れる」ような
// トークン上限による尻切れを防ぐ。
const CHAT_LLM_MAX_TOKENS = 1500;
// 非ストリーミング(DeepSeek等)向けの固定タイムアウト。
const CHAT_LLM_TIMEOUT_MS = 20000;
// ストリーミング向け: トークンが流れている限り延長するアイドルタイムアウト。
// 最後にチャンクを受信してからこの時間内に次のチャンクが来なければ中断する。
const CHAT_LLM_IDLE_TIMEOUT_MS = 20000;

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

// ストリーミング実装済みのprovider。それ以外(deepseek等)は一括取得して
// 単一チャンクとしてonChunkに渡す。
const STREAMING_PROVIDERS = new Set(['anthropic', 'gemini', 'openai']);

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

// finish_reason/stop_reasonがトークン上限による打ち切りを示すかどうか。
function isTruncatedFinish(provider, finishReason) {
  if (!finishReason) return false;
  if (provider === 'anthropic') return finishReason === 'max_tokens';
  if (provider === 'gemini') return finishReason === 'MAX_TOKENS';
  return finishReason === 'length'; // openai-compatible (openai/deepseek)
}

// ── 汎用SSE行リーダー: event:/data: 行を読み取ってonEvent(event, dataStr)を呼ぶ ─
async function _readSSEBody(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let currentEvent = null;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      const trimmed = line.trim();
      if (!trimmed) { currentEvent = null; continue; }
      if (trimmed.startsWith('event:')) { currentEvent = trimmed.slice(6).trim(); continue; }
      if (trimmed.startsWith('data:')) { onEvent(currentEvent, trimmed.slice(5).trim()); }
    }
  }
}

// idle-timeout付きのAbortControllerを作る。外部のabortSignal(ユーザーの
// キャンセル操作等)が発火した場合も追従して中断する。chunk受信毎にonChunk
// ラッパー内でtouch()を呼び、アイドル時間をリセットする。
function _makeIdleController(opts) {
  const controller = new AbortController();
  if (opts.abortSignal) {
    if (opts.abortSignal.aborted) controller.abort();
    else opts.abortSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }
  const idleMs = opts.idleTimeoutMs || CHAT_LLM_IDLE_TIMEOUT_MS;
  let idleTimer = setTimeout(() => controller.abort(), idleMs);
  function touch() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), idleMs);
  }
  function clear() { clearTimeout(idleTimer); }
  return { controller, touch, clear };
}

async function streamAnthropicCandidate(candidate, systemPrompt, userText, opts, onChunk) {
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
    stream: true,
  });
  const { controller, touch, clear } = _makeIdleController(opts);
  let fullText = '';
  let finishReason = null;
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers, body, signal: controller.signal });
    if (!res.ok) { clear(); return { ok: false, reason: `anthropic API error: ${res.status} ${res.statusText}` }; }
    await _readSSEBody(res, (event, dataStr) => {
      touch();
      if (!dataStr || dataStr === '[DONE]') return;
      let data;
      try { data = JSON.parse(dataStr); } catch (_) { return; }
      if (event === 'content_block_delta' && data.delta && data.delta.type === 'text_delta') {
        fullText += data.delta.text;
        onChunk(data.delta.text);
      } else if (event === 'message_delta' && data.delta && data.delta.stop_reason) {
        finishReason = data.delta.stop_reason;
      }
    });
    clear();
    process.stderr.write(`[chat-llm-router] anthropic finish_reason=${finishReason || 'unknown'}\n`);
    if (!fullText) return { ok: false, reason: 'anthropic returned empty content' };
    return { ok: true, reply: fullText.trim(), finishReason };
  } catch (e) {
    clear();
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
}

async function streamGeminiCandidate(candidate, systemPrompt, userText, opts, onChunk) {
  const apiKey = process.env[candidate.keyEnv];
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${candidate.model}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: { maxOutputTokens: opts.maxTokens || CHAT_LLM_MAX_TOKENS, temperature: 0.7 },
  });
  const { controller, touch, clear } = _makeIdleController(opts);
  let fullText = '';
  let finishReason = null;
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal });
    if (!res.ok) { clear(); return { ok: false, reason: `gemini API error: ${res.status} ${res.statusText}` }; }
    await _readSSEBody(res, (event, dataStr) => {
      touch();
      if (!dataStr) return;
      let data;
      try { data = JSON.parse(dataStr); } catch (_) { return; }
      const cand = data.candidates && data.candidates[0];
      const text = cand && cand.content && cand.content.parts && cand.content.parts[0] ? cand.content.parts[0].text : null;
      if (text) { fullText += text; onChunk(text); }
      if (cand && cand.finishReason) finishReason = cand.finishReason;
    });
    clear();
    process.stderr.write(`[chat-llm-router] gemini finish_reason=${finishReason || 'unknown'}\n`);
    if (!fullText) return { ok: false, reason: 'gemini returned empty content' };
    return { ok: true, reply: fullText.trim(), finishReason };
  } catch (e) {
    clear();
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
}

async function streamOpenAICompatCandidate(candidate, apiUrl, systemPrompt, userText, opts, onChunk) {
  const authHeader = `Bearer ${process.env[candidate.keyEnv]}`;
  const body = JSON.stringify({
    model: candidate.model,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
    max_tokens: opts.maxTokens || CHAT_LLM_MAX_TOKENS,
    temperature: 0.7,
    stream: true,
  });
  const { controller, touch, clear } = _makeIdleController(opts);
  let fullText = '';
  let finishReason = null;
  try {
    const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authHeader }, body, signal: controller.signal });
    if (!res.ok) { clear(); return { ok: false, reason: `${candidate.provider} API error: ${res.status} ${res.statusText}` }; }
    await _readSSEBody(res, (event, dataStr) => {
      touch();
      if (!dataStr || dataStr === '[DONE]') return;
      let data;
      try { data = JSON.parse(dataStr); } catch (_) { return; }
      const choice = data.choices && data.choices[0];
      if (choice && choice.delta && typeof choice.delta.content === 'string') {
        fullText += choice.delta.content;
        onChunk(choice.delta.content);
      }
      if (choice && choice.finish_reason) finishReason = choice.finish_reason;
    });
    clear();
    process.stderr.write(`[chat-llm-router] ${candidate.provider} finish_reason=${finishReason || 'unknown'}\n`);
    if (!fullText) return { ok: false, reason: `${candidate.provider} returned empty content` };
    return { ok: true, reply: fullText.trim(), finishReason };
  } catch (e) {
    clear();
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
}

async function streamCandidate(candidate, systemPrompt, userText, opts, onChunk) {
  if (candidate.provider === 'anthropic') return streamAnthropicCandidate(candidate, systemPrompt, userText, opts, onChunk);
  if (candidate.provider === 'gemini') return streamGeminiCandidate(candidate, systemPrompt, userText, opts, onChunk);
  if (candidate.provider === 'openai') return streamOpenAICompatCandidate(candidate, 'https://api.openai.com/v1/chat/completions', systemPrompt, userText, opts, onChunk);
  return { ok: false, reason: `streaming not supported for provider: ${candidate.provider}` };
}

// 非ストリーミング(DeepSeek等sanitizedAdvisory)の一括呼び出し。
async function callCandidateBlocking(candidate, apiUrl, systemPrompt, userText, opts) {
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
    const choice = data && data.choices && data.choices[0];
    const text = choice && choice.message ? choice.message.content : null;
    if (!text) return { ok: false, reason: `${candidate.provider} returned empty content` };
    process.stderr.write(`[chat-llm-router] ${candidate.provider} finish_reason=${(choice && choice.finish_reason) || 'unknown'}\n`);
    return { ok: true, reply: text.trim(), finishReason: choice && choice.finish_reason };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, reason: `fetch error: ${e.message}` };
  }
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
 * 雑談チャットLLM呼び出し。ストリーミング対応candidateはトークン到着ごとに
 * onChunk(deltaText)を呼び、非対応(DeepSeek等)は一括取得後に丸ごと1回
 * onChunkへ渡す。呼び出し側はどちらの場合もonChunkだけを見ていれば良い。
 *
 * @param {string} userText
 * @param {{ difficulty?: string, maxTokens?: number, timeoutMs?: number, idleTimeoutMs?: number, abortSignal?: AbortSignal }} opts
 * @param {(deltaText: string) => void} onChunk
 * @returns {Promise<{ ok: boolean, reply: string|null, modelUsed: string|null, difficulty: string, attempts: Array, rateLimited?: boolean, allFailed?: boolean, escalated?: boolean, truncated?: boolean, aborted?: boolean }>}
 */
async function streamChatLLMChain(userText, opts = {}, onChunk = () => {}) {
  const difficulty = opts.difficulty || pickDifficulty(userText);
  const isEscalated = difficulty !== 'light';

  if (!checkRateLimit()) {
    return { ok: false, reply: null, modelUsed: null, difficulty, attempts: [], rateLimited: true, reason: 'rate limit exceeded (5 req/min)' };
  }

  const systemPrompt = buildSystemPrompt(difficulty);
  const attempts = [];
  const config = loadChatModelConfig();

  const candidateList = [];
  if (isEscalated) {
    const escalationCandidate = buildCandidateFromModelName(config.escalation);
    if (escalationCandidate) candidateList.push(escalationCandidate);
    else attempts.push({ model: config.escalation, skipped: true, reason: 'unknown model (not in MODEL_REGISTRY)' });
  }
  for (const name of config.chain) {
    const candidate = buildCandidateFromModelName(name);
    if (!candidate) { attempts.push({ model: name, skipped: true, reason: 'unknown model (not in MODEL_REGISTRY)' }); continue; }
    candidateList.push(candidate);
  }

  for (const candidate of candidateList) {
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

    let result;
    if (STREAMING_PROVIDERS.has(candidate.provider)) {
      result = await streamCandidate(candidate, systemPrompt, outgoingText, opts, onChunk);
    } else if (candidate.provider === 'deepseek') {
      result = await callCandidateBlocking(candidate, 'https://api.deepseek.com/chat/completions', systemPrompt, outgoingText, opts);
      if (result.ok) onChunk(result.reply);
    } else {
      result = { ok: false, reason: `unsupported provider: ${candidate.provider}` };
    }

    const aborted = !result.ok && opts.abortSignal && opts.abortSignal.aborted;
    attempts.push({ model: candidate.model, ok: result.ok, reason: result.reason || null, finishReason: result.finishReason || null });

    if (result.ok) {
      const truncated = isTruncatedFinish(candidate.provider, result.finishReason);
      let finalReply = result.reply;
      if (truncated) {
        finalReply = `${result.reply}\n\n…（続きあり）`;
        onChunk('\n\n…（続きあり）');
      }
      return { ok: true, reply: finalReply, modelUsed: candidate.model, difficulty, attempts, escalated: candidate.model === config.escalation, truncated };
    }
    if (aborted) {
      // ユーザーによる明示的なキャンセル: これ以上他candidateを試さず、
      // ここまで受信できたテキストは呼び出し側(streamで直接onChunkを
      // 受け取っている側)がすでに保持しているので、それを「確定」させる
      // ためaborted:trueを返して以降のフォールバックを止める。
      return { ok: false, reply: null, modelUsed: candidate.model, difficulty, attempts, aborted: true };
    }
  }

  return { ok: false, reply: null, modelUsed: null, difficulty, attempts, allFailed: true };
}

// 後方互換: ストリーミングせず最終テキストだけ欲しい呼び出し側向け。
async function callChatLLMChain(userText, opts = {}) {
  return streamChatLLMChain(userText, opts, () => {});
}

module.exports = {
  callChatLLMChain,
  streamChatLLMChain,
  buildSystemPrompt,
  pickDifficulty,
  checkRateLimit,
  loadPersonaFile,
  loadChatModelConfig,
  buildCandidateFromModelName,
  isTruncatedFinish,
  MODEL_REGISTRY,
  DEFAULT_CHAT_MODEL_CONFIG,
  PERSONA_LITE_PATH,
  PERSONA_FULL_PATH,
  CHAT_MODEL_CONFIG_PATH,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  CHAT_LLM_MAX_TOKENS,
  CHAT_LLM_IDLE_TIMEOUT_MS,
  _resetRateLimitForTest,
};
