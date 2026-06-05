'use strict';

/**
 * GPT Task Arbiter v110.7.0
 *
 * GPT を裁定者として使い、タスクを Gemini タスクと Claude Code タスクに分割する。
 * --live なしはヒューリスティック裁定（API コールなし、dryRun: true）。
 */

const { getConfig } = require('../providers/provider-config');

// ── Heuristic routing ─────────────────────────────────────────────────────────

const GEMINI_SIGNALS = [
  'generate', 'summarize', 'summary', 'draft', 'write', 'bulk', 'document',
  'survey', 'list', 'report', 'translate', 'outline', 'content',
  '生成', '要約', '文章', '一覧', 'ドラフト', 'リスト',
];
const CLAUDE_SIGNALS = [
  'implement', 'code', 'fix', 'verify', 'edit', 'refactor', 'debug',
  'test', 'smoke', 'build', 'function', 'class', 'script', 'module',
  '実装', '修正', 'コード', '検証', 'スモーク', 'ビルド',
];

function heuristicRoute(task) {
  const lower = task.toLowerCase();
  const gScore = GEMINI_SIGNALS.filter(k => lower.includes(k)).length;
  const cScore = CLAUDE_SIGNALS.filter(k => lower.includes(k)).length;

  if (gScore > 0 && cScore > 0) {
    return {
      gemini: [`[Gemini] bulk/generation subtask: ${task}`],
      claudeCode: [`[Claude Code] implementation subtask: ${task}`],
      method: 'heuristic_split',
    };
  }
  if (gScore > cScore) {
    return { gemini: [task], claudeCode: [], method: 'heuristic_gemini_only' };
  }
  if (cScore > gScore) {
    return { gemini: [], claudeCode: [task], method: 'heuristic_claude_only' };
  }
  // Tie → both
  return { gemini: [task], claudeCode: [task], method: 'heuristic_both' };
}

// ── GPT live arbiter ──────────────────────────────────────────────────────────

const ARBITER_SYSTEM_PROMPT = `You are a task routing arbiter for KOSAME Dev Orchestra.
Classify the task into two buckets:
  - "gemini": bulk text generation, summarization, document writing, content drafts
  - "claudeCode": code implementation, file edits, verification, smoke tests

Rules:
1. A task may go to one or both agents.
2. If mixed, split into specific subtasks per agent.
3. Preserve the original language (Japanese/English).

Reply ONLY with valid JSON: { "gemini": [strings], "claudeCode": [strings], "reasoning": "string" }`;

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
 * Arbitrate a task description into Gemini / Claude Code subtasks.
 *
 * @param {string} task - Task description
 * @param {{ live?: boolean }} options
 * @returns {Promise<{
 *   gemini: string[],
 *   claudeCode: string[],
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

module.exports = { arbitrate, heuristicRoute, GEMINI_SIGNALS, CLAUDE_SIGNALS };

if (require.main === module) {
  const input = process.argv.slice(2).find(a => a.startsWith('--input='))?.slice(8)
    ?? 'Implement smoke test and summarize existing test coverage';
  const live = process.argv.includes('--live');

  arbitrate(input, { live }).then(r => console.log(JSON.stringify(r, null, 2)));
}
