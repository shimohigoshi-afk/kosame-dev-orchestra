'use strict';

/**
 * Cost Tracker v110.11.0
 *
 * OpenAI / Gemini / Grok / DeepSeek / Kimi のコストを記録し、
 * 1タスクあたりのコストを集計する。
 * Claude Agent Team との比較レポートを出力する。
 *
 * 安全原則:
 *   - dryRun=true (デフォルト) では実際の課金は発生しない
 *   - 価格テーブルはローカル定数 (外部API不要)
 */

const { sectionStart, sectionEnd, log } = require('./colored-section-logger');

const TOOL_META = {
  version: '110.11.0',
  title:   'Cost Tracker',
  slug:    'cost-tracker'
};

// ── Price table (USD per 1M tokens) ──────────────────────────────────────────
// Sources: public pricing pages as of 2026-06

const PRICE_TABLE = {
  // OpenAI
  'gpt-4o':              { input: 2.50,  output: 10.00, provider: 'openai' },
  'gpt-4o-mini':         { input: 0.15,  output: 0.60,  provider: 'openai' },
  'gpt-4-turbo':         { input: 10.00, output: 30.00, provider: 'openai' },
  'gpt-3.5-turbo':       { input: 0.50,  output: 1.50,  provider: 'openai' },
  // Gemini
  'gemini-1.5-pro':      { input: 1.25,  output: 5.00,  provider: 'gemini' },
  'gemini-1.5-flash':    { input: 0.075, output: 0.30,  provider: 'gemini' },
  'gemini-2.0-flash':    { input: 0.10,  output: 0.40,  provider: 'gemini' },
  // Grok
  'grok-2':              { input: 2.00,  output: 10.00, provider: 'grok' },
  // DeepSeek
  'deepseek-chat':       { input: 0.07,  output: 1.10,  provider: 'deepseek' },
  'deepseek-reasoner':   { input: 0.55,  output: 2.19,  provider: 'deepseek' },
  // Kimi
  'kimi-latest':         { input: 0.15,  output: 0.60,  provider: 'kimi' },
  // Claude (for comparison)
  'claude-opus-4-8':     { input: 15.00, output: 75.00, provider: 'claude' },
  'claude-sonnet-4-6':   { input: 3.00,  output: 15.00, provider: 'claude' },
  'claude-haiku-4-5':    { input: 0.80,  output: 4.00,  provider: 'claude' }
};

const CLAUDE_AGENT_TEAM = ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'];

// ── Cost calculation ──────────────────────────────────────────────────────────

/**
 * Calculate cost for one usage record.
 *
 * @param {string} model         e.g. 'gpt-4o'
 * @param {number} inputTokens   prompt tokens
 * @param {number} outputTokens  completion tokens
 * @returns {object}             { model, provider, inputUsd, outputUsd, totalUsd }
 */
function calcCost(model, inputTokens, outputTokens) {
  const price = PRICE_TABLE[model];
  if (!price) throw new Error(`Unknown model: ${model}`);
  const inputUsd  = (inputTokens  / 1_000_000) * price.input;
  const outputUsd = (outputTokens / 1_000_000) * price.output;
  return {
    model,
    provider:    price.provider,
    inputTokens,
    outputTokens,
    inputUsd:    round6(inputUsd),
    outputUsd:   round6(outputUsd),
    totalUsd:    round6(inputUsd + outputUsd)
  };
}

function round6(n) { return Math.round(n * 1_000_000) / 1_000_000; }

// ── Session store ─────────────────────────────────────────────────────────────

/**
 * Create a new in-memory cost tracker session.
 */
function createSession(opts) {
  const { sessionId, productId, dryRun = true } = opts || {};

  const records = [];

  /**
   * Record one usage event.
   *
   * @param {string} taskId
   * @param {string} model
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {object} meta         optional extra metadata
   */
  function record(taskId, model, inputTokens, outputTokens, meta) {
    const cost = calcCost(model, inputTokens, outputTokens);
    const entry = {
      ts:          new Date().toISOString(),
      taskId,
      sessionId:   sessionId || null,
      productId:   productId || null,
      dryRun,
      ...cost,
      meta:        meta || null
    };
    records.push(entry);
    return entry;
  }

  /**
   * Aggregate cost per task.
   */
  function aggregateByTask() {
    const map = {};
    for (const r of records) {
      if (!map[r.taskId]) {
        map[r.taskId] = { taskId: r.taskId, totalUsd: 0, records: [] };
      }
      map[r.taskId].totalUsd = round6(map[r.taskId].totalUsd + r.totalUsd);
      map[r.taskId].records.push(r);
    }
    return Object.values(map);
  }

  /**
   * Build a comparison report: current session vs Claude Agent Team equivalent.
   * Claude Agent Team cost is estimated from same token counts using sonnet-4-6.
   */
  function comparisonReport(opts) {
    const { silent = false } = opts || {};
    const emit = silent ? () => {} : log;

    const sessionTotal = records.reduce((s, r) => s + r.totalUsd, 0);

    // estimate what the same work would cost on claude-sonnet-4-6
    const claudeEstimate = records.reduce((s, r) => {
      const c = calcCost('claude-sonnet-4-6', r.inputTokens, r.outputTokens);
      return s + c.totalUsd;
    }, 0);

    const saving     = round6(claudeEstimate - sessionTotal);
    const savingPct  = claudeEstimate > 0
      ? Math.round((saving / claudeEstimate) * 100)
      : 0;

    const byProvider = {};
    for (const r of records) {
      byProvider[r.provider] = round6((byProvider[r.provider] || 0) + r.totalUsd);
    }

    const report = {
      tool:    TOOL_META.slug,
      version: TOOL_META.version,
      dryRun,
      realProductActionsExecuted: false,
      dangerousActionsDenied:     true,
      humanApprovalRequired:      true,
      sessionId:       sessionId || null,
      productId:       productId || null,
      recordCount:     records.length,
      sessionTotalUsd: round6(sessionTotal),
      byProvider,
      claudeTeamEstimateUsd: round6(claudeEstimate),
      estimatedSavingUsd:    saving,
      estimatedSavingPct:    savingPct,
      taskAggregation:       aggregateByTask()
    };

    emit('info', `session total: $${report.sessionTotalUsd.toFixed(6)}`);
    emit('info', `claude-team estimate: $${report.claudeTeamEstimateUsd.toFixed(6)}`);
    emit(saving >= 0 ? 'success' : 'warn',
      `estimated saving vs claude team: $${saving.toFixed(6)} (${savingPct}%)`);

    return report;
  }

  return { record, aggregateByTask, comparisonReport, records };
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  sectionStart('Cost Tracker デモ');

  const session = createSession({ sessionId: 'demo-001', productId: 'anesty-board', dryRun: true });

  session.record('task-1', 'gemini-1.5-flash', 5000, 1000);
  session.record('task-1', 'gpt-4o-mini',      2000,  500);
  session.record('task-2', 'deepseek-chat',     8000, 2000);
  session.record('task-2', 'gpt-4o',            3000,  800);

  const report = session.comparisonReport({ silent: false });

  console.log('');
  console.log(JSON.stringify(report, null, 2));

  sectionEnd('Cost Tracker デモ');
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  PRICE_TABLE,
  CLAUDE_AGENT_TEAM,
  calcCost,
  createSession
};
