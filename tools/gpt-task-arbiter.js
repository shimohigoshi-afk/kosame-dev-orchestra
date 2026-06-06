'use strict';

/**
 * GPT Task Arbiter v110.13.0
 *
 * GPT を裁定者として使い、タスクを Gemini, Claude Code, Grok タスクに分割する。
 * --live なしはヒューリスティック裁定（API コールなし、dryRun: true）。
 */

const { getConfig } = require('../providers/provider-config');

// ── Heuristic routing ─────────────────────────────────────────────────────────

const GEMINI_SIGNALS = [
  'generate', 'summarize', 'summary', 'draft', 'write', 'bulk', 'document',
  'survey', 'list', 'report', 'translate', 'outline', 'content', 'diff', 'json',
  '生成', '要約', '文章', '一覧', 'ドラフト', 'リスト', '案', '仕様', 'プロンプト',
];
const CLAUDE_SIGNALS = [
  'implement', 'code', 'fix', 'verify', 'edit', 'refactor', 'debug',
  'test', 'smoke', 'build', 'function', 'class', 'script', 'module',
  '実装', '修正', 'コード', '検証', 'スモーク', 'ビルド',
];
const GROK_SIGNALS = [
  'review', 'check', 'missing', 'audit', 'validation',
  'レビュー', '抜け漏れ', 'チェック', '監査', '妥当性',
];
const CLAUDE_EXCLUDE_SIGNALS = [
  'claude unavailable', 'claude stopped', 'claude limit', 'claudeには振らない',
  'claudeなし', 'claude不可',
];

function heuristicRoute(task) {
  const lower = task.toLowerCase();

  const isClaudeExcluded = CLAUDE_EXCLUDE_SIGNALS.some(k => lower.includes(k));
  const isGrokRequested = GROK_SIGNALS.some(k => lower.includes(k));

  const gScore = GEMINI_SIGNALS.filter(k => lower.includes(k)).length;
  const cScore = isClaudeExcluded ? -1 : CLAUDE_SIGNALS.filter(k => lower.includes(k)).length;
  const rScore = isGrokRequested ? 1 : GROK_SIGNALS.filter(k => lower.includes(k)).length;

  const res = {
    gemini: [],
    claudeCode: [],
    grok: [],
    method: 'heuristic',
  };

  if (gScore > 0) res.gemini.push(task);
  if (cScore > 0) res.claudeCode.push(task);
  if (rScore > 0) res.grok.push(task);

  // Tie-break / Default if nothing matched
  if (res.gemini.length === 0 && res.claudeCode.length === 0 && res.grok.length === 0) {
    if (isClaudeExcluded) {
      res.gemini.push(task);
      res.method = 'heuristic_fallback_gemini';
    } else {
      res.claudeCode.push(task);
      res.method = 'heuristic_fallback_claude';
    }
  }

  return res;
}

// ── GPT live arbiter ──────────────────────────────────────────────────────────

const ARBITER_SYSTEM_PROMPT = `You are a task routing arbiter for KOSAME Dev Orchestra.
Classify the task into three buckets:
  - "gemini": bulk text generation, summarization, document writing, content drafts, implementation diffs, JSON specs
  - "claudeCode": code implementation, file edits, verification, smoke tests
  - "grok": technical review, missing parts check, security audit, validation

Rules:
1. A task may go to one, two, or all three agents.
2. If mixed, split into specific subtasks per agent.
3. Preserve the original language (Japanese/English).
4. If "Claude unavailable" or similar is mentioned, DO NOT use "claudeCode".

Reply ONLY with valid JSON: { "gemini": [strings], "claudeCode": [strings], "grok": [strings], "reasoning": "string" }`;

async function liveArbit(task, config) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: config.openaiModel,
        messages: [
          { role: 'system', content: ARBITER_SYSTEM_PROMPT },
          { role: 'user', content: task },
        ],
        max_tokens: 512,
        response_format: { type: 'json_object' },
      }),
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`GPT API error ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const raw = data?.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(raw);

    return {
      gemini: Array.isArray(parsed.gemini) ? parsed.gemini : [],
      claudeCode: Array.isArray(parsed.claudeCode) ? parsed.claudeCode : [],
      grok: Array.isArray(parsed.grok) ? parsed.grok : [],
      method: 'gpt_live',
      reasoning: parsed.reasoning ?? '',
      model: config.openaiModel,
    };
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`GPT arbiter failed: ${err.message}`);
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Arbitrate a task description into Gemini / Claude Code / Grok subtasks.
 *
 * @param {string} task - Task description
 * @param {{ live?: boolean }} options
 * @returns {Promise<{
 *   gemini: string[],
 *   claudeCode: string[],
 *   grok: string[],
 *   reasoning: string,
 *   method: string,
 *   dryRun: boolean,
 *   model?: string
 * }>}
 */
async function arbitrate(task, options = {}) {
  if (!task || !task.trim()) {
    throw new Error('arbitrate: task description is required');
  }

  const config = getConfig();
  const shouldLive = options.live === true && config.openaiLiveEnabled;

  if (!shouldLive) {
    const heuristic = heuristicRoute(task);
    return {
      ...heuristic,
      reasoning: `[heuristic] gpt not called — ${config.reason}`,
      dryRun: true,
    };
  }

  const result = await liveArbit(task, config);
  return { ...result, dryRun: false };
}

module.exports = {
  arbitrate,
  heuristicRoute,
  GEMINI_SIGNALS,
  CLAUDE_SIGNALS,
  GROK_SIGNALS,
  CLAUDE_EXCLUDE_SIGNALS
};

if (require.main === module) {
  const input = process.argv.slice(2).find(a => a.startsWith('--input='))?.slice(8)
    ?? 'Implement smoke test and summarize existing test coverage';
  const live = process.argv.includes('--live');

  arbitrate(input, { live }).then(r => console.log(JSON.stringify(r, null, 2)));
}
