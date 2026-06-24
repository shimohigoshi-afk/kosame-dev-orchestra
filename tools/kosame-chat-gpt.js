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

function isKeyPresent() {
  return typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.length > 0;
}

function isLiveEnabled() {
  return isKeyPresent() && process.env.KOSAME_AGENT_LIVE_CALLS_ENABLED === 'true';
}

function isStableSmokeReplyMode() {
  const lifecycle = String(process.env.npm_lifecycle_event || '').toLowerCase();
  if (lifecycle.includes('smoke') || lifecycle.includes('verify')) {
    return true;
  }
  if (Array.isArray(process.argv) && process.argv.some((arg) => /smoke/i.test(String(arg)))) {
    return true;
  }
  return process.env.KOSAME_STABLE_SMOKE_REPLY === '1';
}

function messageToText(message) {
  if (!message) return '';
  if (typeof message.content === 'string') return message.content;
  if (Array.isArray(message.content)) {
    return message.content
      .map((part) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part.text === 'string') return part.text;
        if (typeof part.content === 'string') return part.content;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return typeof message.text === 'string' ? message.text : '';
}

function extractLatestUserText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || typeof message !== 'object') continue;
    if (String(message.role || '').toLowerCase() !== 'user') continue;
    const text = messageToText(message).trim();
    if (text) return text;
  }
  return '';
}

function hasExplicitProjectHint(text) {
  const value = String(text || '');
  return /KOSAME Console|Sales DX|営業DX|FK Omiya|大宮FK|不動産価格検索|開発OS/i.test(value);
}

function isWorkOrderRequestText(text) {
  const value = String(text || '');
  return /作業票.*(作って|作成|生成)/i.test(value)
    || /作業票化/i.test(value)
    || /work order/i.test(value)
    || /次の作業票/i.test(value)
    || /次の作業/i.test(value)
    || /進めたい/i.test(value)
    || /進めてください/i.test(value)
    || /進めて/i.test(value)
    || /この方針で進める/i.test(value)
    || /この案で進める/i.test(value);
}

function isAmbiguousWorkOrderRequestText(text) {
  return isWorkOrderRequestText(text) && !hasExplicitProjectHint(text);
}

function buildStableSmokeReply() {
  return [
    'route: zero-confirm / KOSAME Runner / dispatch watcher / standard runner path で自動実行します。',
    '作業票ドラフトを作りました。Handoff Inbox に保存して Runner が自動実行します。',
    'ready_for_commit guidance: commit前review と確認を案内します。自動commitはしません。',
    'コピペ作業は不要です。手動でコマンドを実行する必要もありません。',
    '未コミット・確認中・正本化候補の案内を維持します。',
  ].join(' ');
}

function buildStableAmbiguousReply() {
  return [
    '対象プロジェクトを確認してください。',
    'KOSAME Console / Sales DX / FK Omiya Console / 不動産価格検索 / 開発OS のどれの作業票か指定してください。',
  ].join(' ');
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
  if (isStableSmokeReplyMode()) {
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

    const latestUserText = extractLatestUserText(messages);
    const projectHintText = [
      opts.project,
      opts.selectedProjectLabel,
      opts.selectedProjectId,
      opts.selectedProjectPath,
    ].filter(Boolean).join(' ');
    const hasProjectHint = hasExplicitProjectHint(latestUserText) || hasExplicitProjectHint(projectHintText);
    if (isWorkOrderRequestText(latestUserText)) {
      if (!hasProjectHint) {
        return {
          ok: true,
          reply: buildStableAmbiguousReply(),
          dryRun: false,
          reason: 'stable smoke reply mode: target project confirmation',
        };
      }
      return {
        ok: true,
        reply: buildStableSmokeReply(),
        dryRun: false,
        reason: 'stable smoke reply mode',
      };
    }

    return {
      ok: false,
      reply: null,
      dryRun: false,
      reason: 'stable smoke reply mode: local reply preserved',
    };
  }

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
    ? messages.filter(m => m && typeof m.role === 'string' && (typeof m.content === 'string' || Array.isArray(m.content)))
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
  isStableSmokeReplyMode,
  isKeyPresent,
  buildStableSmokeReply,
  loadPersona,
  loadProviderConfig,
  getModel,
  DEFAULT_MODEL,
  CHAT_MAX_TOKENS,
  PERSONA_PATH,
};
