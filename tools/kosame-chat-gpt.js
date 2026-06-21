#!/usr/bin/env node
'use strict';

// KOSAME Chat GPT caller — connects KOSAME CHAT to OpenAI API with こさめ persona.
// Gate: OPENAI_API_KEY must be present AND KOSAME_AGENT_LIVE_CALLS_ENABLED=true.
// Dry-run fallback when gate is not met — never throws.
// API key value is NEVER logged.

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PERSONA_PATH = path.join(ROOT, 'config', 'kosame-cockpit-chat-persona.md');
const PROVIDER_CONFIG_PATH = path.join(ROOT, 'providers', 'provider-config.json');
const DEFAULT_MODEL = 'gpt-4o-mini';
const CHAT_MAX_TOKENS = 500;
const CHAT_TIMEOUT_MS = 20000;

function loadPersona() {
  try { return fs.readFileSync(PERSONA_PATH, 'utf8').trim(); }
  catch { return 'あなたはこさめです。じゅんやさんの相談AIです。危険操作は止めてください。'; }
}

function loadProviderConfig() {
  try { return JSON.parse(fs.readFileSync(PROVIDER_CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function isLiveEnabled() {
  const keyPresent = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
  const liveEnabled = process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED === 'true';
  return keyPresent && liveEnabled;
}

function getModel() {
  const envModel = process.env.KOSAME_AGENT_MODEL_OPENAI;
  return typeof envModel === 'string' && envModel.length > 0 ? envModel : DEFAULT_MODEL;
}

/**
 * Call OpenAI API with こさめ persona from provider-config.json.
 * @param {Array<{role: string, content: string}>} messages - conversation history
 * @param {object} opts
 *   opts.contextSummary {string} - optional context to append to system prompt
 *   opts.maxTokens {number}
 *   opts.timeoutMs {number}
 * @returns {Promise<{ ok: boolean, reply: string|null, dryRun: boolean, reason: string|null }>}
 */
async function callKosameGPT(messages, opts = {}) {
  if (!isLiveEnabled()) {
    const keyPresent = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
    return {
      ok: false,
      reply: null,
      dryRun: true,
      reason: keyPresent
        ? 'dry-run: KOSAME_AGENT_LIVE_CALLS_ENABLED not set to true'
        : 'dry-run: OPENAI_API_KEY not set',
    };
  }

  const persona = loadPersona();
  const contextSummary = opts.contextSummary ? String(opts.contextSummary).slice(0, 400).trim() : '';
  const systemContent = contextSummary
    ? `${persona}\n\n現在の状況:\n${contextSummary}`
    : persona;

  const model = getModel();
  const maxTokens = Math.min(Number.isFinite(Number(opts.maxTokens)) ? Number(opts.maxTokens) : CHAT_MAX_TOKENS, 1000);
  const timeoutMs = Math.min(Number.isFinite(Number(opts.timeoutMs)) ? Number(opts.timeoutMs) : CHAT_TIMEOUT_MS, 30000);

  const msgArray = Array.isArray(messages) && messages.length > 0
    ? messages.filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
    : [];
  if (!msgArray.length) {
    return { ok: false, reply: null, dryRun: false, reason: 'no valid messages to send' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemContent }, ...msgArray],
        max_tokens: maxTokens,
        temperature: 0.7,
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      return {
        ok: false,
        reply: null,
        dryRun: false,
        reason: `OpenAI API error: ${res.status} ${res.statusText}`,
      };
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? null;
    if (!text) {
      return { ok: false, reply: null, dryRun: false, reason: 'OpenAI returned empty content' };
    }

    return { ok: true, reply: text.trim(), dryRun: false, reason: null };
  } catch (e) {
    clearTimeout(timer);
    return {
      ok: false,
      reply: null,
      dryRun: false,
      reason: `fetch error: ${e.message}`,
    };
  }
}

module.exports = {
  callKosameGPT,
  isLiveEnabled,
  loadPersona,
  loadProviderConfig,
  getModel,
  DEFAULT_MODEL,
  CHAT_MAX_TOKENS,
  PERSONA_PATH,
};
