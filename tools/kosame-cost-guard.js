#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cost Guard v110.24.0
 *
 * 高度タスク前にコスト見積を表示し、月間予算上限を超えた場合に自動停止する。
 *
 * 設定ファイル : ~/.kosame/cost-config.json
 * 支出トラッカー: ~/.kosame/cost-spend.json  (月別累計)
 *
 * Usage:
 *   npm run cost:config                  # インタラクティブ設定
 *   npm run cost:config -- --show        # 現在の設定を表示
 *   node tools/kosame-cost-guard.js --estimate --model=claude-sonnet-4-6
 *   node tools/kosame-cost-guard.js --check --estimate-usd=0.05
 */

const readline = require('node:readline');
const fs       = require('node:fs');
const path     = require('node:path');
const os       = require('node:os');

const TOOL_META = {
  version: '110.24.0',
  feature: 'v110-24-cost-guard',
  slug:    'kosame-cost-guard',
};

const KOSAME_DIR      = path.join(os.homedir(), '.kosame');
const CONFIG_FILE     = path.join(KOSAME_DIR, '.cost-config.json');
const SPEND_FILE      = path.join(KOSAME_DIR, '.cost-spend.json');

// ── Price table (USD per 1M tokens) ──────────────────────────────────────────
// gemini-2.5 は公式発表レートが変動中のため近似値を使用。

const PRICE_TABLE = {
  'gemini-2.5-flash':   { input: 0.075, output: 0.30,  provider: 'gemini' },
  'gemini-2.5-pro':     { input: 1.25,  output: 10.00, provider: 'gemini' },
  'gemini-2.0-flash':   { input: 0.10,  output: 0.40,  provider: 'gemini' },
  'gpt-4o':             { input: 2.50,  output: 10.00, provider: 'openai' },
  'gpt-4o-mini':        { input: 0.15,  output: 0.60,  provider: 'openai' },
  'claude-sonnet-4-6':  { input: 3.00,  output: 15.00, provider: 'claude' },
  'claude-haiku-4-5':   { input: 0.80,  output: 4.00,  provider: 'claude' },
  'deepseek-chat':      { input: 0.07,  output: 1.10,  provider: 'deepseek' },
  'deepseek-reasoner':  { input: 0.55,  output: 2.19,  provider: 'deepseek' },
  'grok-3':             { input: 3.00,  output: 15.00, provider: 'grok' },
  'grok-2':             { input: 2.00,  output: 10.00, provider: 'grok' },
  'kimi-latest':        { input: 0.15,  output: 0.60,  provider: 'kimi' },
};

// 難易度別の典型トークン数（見積もり用）
const TYPICAL_TOKENS = {
  light:  { input: 2000,  output: 500  },
  medium: { input: 5000,  output: 1500 },
  high:   { input: 8000,  output: 3000 },
};

// デフォルト設定
const DEFAULT_CONFIG = {
  monthlyBudgetUsd:        10.00,
  alertThresholdPct:       80,
  highTaskWarningThreshold: 0.01,
  currency:                'USD',
  createdAt:               new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green:  '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan:   '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m',
};
const c = (col, t) => `${C[col]}${t}${C.reset}`;

function ensureDir() {
  if (!fs.existsSync(KOSAME_DIR)) {
    fs.mkdirSync(KOSAME_DIR, { recursive: true, mode: 0o700 });
  }
}

// ── Config read/write ─────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG };
}

function writeConfig(cfg, dryRun = true) {
  if (dryRun) return { dryRun: true, config: cfg };
  ensureDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  return { dryRun: false, written: true, config: cfg };
}

// ── Monthly spend tracker ─────────────────────────────────────────────────────

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function readSpend() {
  try {
    if (fs.existsSync(SPEND_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SPEND_FILE, 'utf8'));
      const key = currentMonthKey();
      return { month: key, totalUsd: raw[key] ?? 0, all: raw };
    }
  } catch (_) {}
  return { month: currentMonthKey(), totalUsd: 0, all: {} };
}

function recordSpend(usd, dryRun = true) {
  if (typeof usd !== 'number' || usd <= 0) return { ok: false, reason: 'invalid usd' };
  const spend = readSpend();
  const key   = spend.month;
  const next  = { ...spend.all, [key]: (spend.totalUsd + usd) };

  if (!dryRun) {
    ensureDir();
    fs.writeFileSync(SPEND_FILE, JSON.stringify(next, null, 2), { mode: 0o600 });
  }

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    month:   key,
    addedUsd:   usd,
    newTotalUsd: next[key],
    realProductActionsExecuted: !dryRun,
  };
}

// ── Cost estimation ───────────────────────────────────────────────────────────

/**
 * モデルとトークン数からコストを見積もる。
 *
 * @param {string} model
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {{ model, provider, inputUsd, outputUsd, totalUsd }}
 */
function estimateCost(model, inputTokens, outputTokens) {
  const price = PRICE_TABLE[model];
  if (!price) return { model, provider: 'unknown', inputUsd: 0, outputUsd: 0, totalUsd: 0, warning: `unknown model: ${model}` };
  const inputUsd  = (inputTokens  / 1_000_000) * price.input;
  const outputUsd = (outputTokens / 1_000_000) * price.output;
  return { model, provider: price.provider, inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

/**
 * 難易度に基づくコスト範囲見積もり（エスカレーション全ステップ）。
 */
function estimateEscalationCost(difficulty) {
  const tokens   = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;

  // 難易度別のモデルセット（escalation chain の各ステップ）
  const modelsMap = {
    light:  ['gemini-2.5-flash', 'deepseek-chat'],
    medium: ['gemini-2.5-pro',   'grok-3'],
    high:   ['claude-sonnet-4-6','gpt-4o'],
  };
  const models = modelsMap[difficulty] || modelsMap.medium;

  const estimates = models.map(m => estimateCost(m, tokens.input, tokens.output));
  const primaryUsd = estimates[0]?.totalUsd ?? 0;
  const maxUsd     = Math.max(...estimates.map(e => e.totalUsd));

  return {
    difficulty,
    typicalTokens: tokens,
    primaryUsd,
    maxUsd,
    estimates,
  };
}

// ── Budget guard ──────────────────────────────────────────────────────────────

/**
 * 予算チェック。estimatedUsd を加算しても上限以内か確認。
 *
 * @param {number} estimatedUsd
 * @param {object} opts  { dryRun, silent }
 * @returns {{ ok, blocked, reason, spend, config }}
 */
function checkBudget(estimatedUsd = 0, opts = {}) {
  const { dryRun = true, silent = false } = opts;
  const cfg   = readConfig();
  const spend = readSpend();

  const projected = spend.totalUsd + estimatedUsd;
  const budgetUsd = cfg.monthlyBudgetUsd;
  const alertUsd  = budgetUsd * (cfg.alertThresholdPct / 100);

  const blocked = projected > budgetUsd;
  const alert   = !blocked && projected > alertUsd;

  if (!silent) {
    if (blocked) {
      console.log(`  ${c('red', '⛔ 予算上限超過:')} 月間上限 $${budgetUsd.toFixed(2)} を超えます`);
      console.log(`  ${c('dim', `現在 $${spend.totalUsd.toFixed(4)} + 推定 $${estimatedUsd.toFixed(6)} = $${projected.toFixed(4)}`)}`);
    } else if (alert) {
      console.log(`  ${c('yellow', `⚠ 予算 ${cfg.alertThresholdPct}% 到達:`)} 残り $${(budgetUsd - spend.totalUsd).toFixed(4)}`);
    }
  }

  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    ok:      !blocked,
    blocked,
    alert,
    reason:  blocked ? `月間予算 $${budgetUsd.toFixed(2)} を超えます (projected: $${projected.toFixed(4)})` : null,
    estimatedUsd,
    currentSpendUsd: spend.totalUsd,
    projectedUsd:    projected,
    budgetUsd,
    remainingUsd:    Math.max(0, budgetUsd - spend.totalUsd),
    alertThresholdPct: cfg.alertThresholdPct,
  };
}

/**
 * 高度タスク前のコスト警告を表示する（human_gate=true のとき呼ぶ）。
 */
function showHighTaskWarning(difficulty, model, opts = {}) {
  const { dryRun = true } = opts;
  const estimate = estimateEscalationCost(difficulty);
  const budget   = checkBudget(estimate.primaryUsd, { dryRun, silent: true });

  console.log(`\n  ${c('yellow', '⚠ コスト警告')} ${c('bold', `[${difficulty.toUpperCase()}]`)}`);
  console.log(`  モデル  : ${c('bold', model)}`);
  console.log(`  推定コスト: $${estimate.primaryUsd.toFixed(6)} 〜 $${estimate.maxUsd.toFixed(6)}`);
  console.log(`  月間支出  : $${budget.currentSpendUsd.toFixed(4)} / $${budget.budgetUsd.toFixed(2)}`);
  console.log(`  残予算    : $${budget.remainingUsd.toFixed(4)}`);
  if (budget.blocked) {
    console.log(`  ${c('red', '⛔ 予算超過 — 実行がブロックされました')}`);
  } else if (budget.alert) {
    console.log(`  ${c('yellow', `⚠ 予算 ${budget.alertThresholdPct}% に到達 — 承認してから実行してください`)}`);
  }

  return { estimate, budget };
}

// ── Interactive config ────────────────────────────────────────────────────────

async function interactiveConfig(opts = {}) {
  const { dryRun = true } = opts;
  const current = readConfig();
  const spend   = readSpend();

  console.log(`\n${c('bold', c('blue', '⬡ KOSAME Cost Guard — 予算設定'))}`);
  console.log(c('dim', `  v${TOOL_META.version}  |  dryRun: ${dryRun}`));
  console.log(`\n  現在の設定:`);
  console.log(`    月間予算上限    : $${current.monthlyBudgetUsd.toFixed(2)}`);
  console.log(`    アラート閾値    : ${current.alertThresholdPct}%`);
  console.log(`    高度タスク警告  : $${current.highTaskWarningThreshold.toFixed(4)} 以上`);
  console.log(`\n  今月の支出      : $${spend.totalUsd.toFixed(4)} (${spend.month})`);

  if (!process.stdin.isTTY) {
    console.log(`\n  ${c('dim', '(非インタラクティブモード — 現在値を維持)')}`);
    if (!dryRun) writeConfig(current, false);
    return { dryRun, config: current };
  }

  if (!dryRun) {
    console.log(`\n  ${c('yellow', '⚠ --write モード')} — 変更は実際に書き込まれます`);
  } else {
    console.log(`\n  ${c('blue', '[DRY-RUN]')} — ファイルは書き込まれません`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  const budgetStr = await ask(`  月間予算上限 USD (現在: $${current.monthlyBudgetUsd.toFixed(2)}, Enter でスキップ): `);
  const alertStr  = await ask(`  アラート閾値 % (現在: ${current.alertThresholdPct}%, Enter でスキップ): `);
  rl.close();

  const newConfig = {
    ...current,
    monthlyBudgetUsd:  budgetStr.trim()  ? parseFloat(budgetStr)  : current.monthlyBudgetUsd,
    alertThresholdPct: alertStr.trim()   ? parseInt(alertStr, 10) : current.alertThresholdPct,
    updatedAt:         new Date().toISOString(),
  };

  console.log(`\n  ${c('bold', '新しい設定:')}`);
  console.log(`    月間予算上限 : $${newConfig.monthlyBudgetUsd.toFixed(2)}`);
  console.log(`    アラート閾値 : ${newConfig.alertThresholdPct}%`);

  if (dryRun) {
    console.log(`  ${c('gray', '[dry] 書き込みをスキップしました')}`);
  } else {
    writeConfig(newConfig, false);
    console.log(`  ${c('green', '✓')} ~/.kosame/.cost-config.json を保存しました`);
  }

  console.log('');
  return { dryRun, config: newConfig };
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let show = false, estimate = false, check = false, configMode = false;
  let model = 'claude-sonnet-4-6', difficulty = 'high', estimateUsd = 0;
  let dryRun = true;
  for (const a of args) {
    if (a === '--show')                show        = true;
    if (a === '--estimate')            estimate    = true;
    if (a === '--check')               check       = true;
    if (a === '--config')              configMode  = true;
    if (a === '--write')               dryRun      = false;
    if (a.startsWith('--model='))      model       = a.slice(8);
    if (a.startsWith('--difficulty=')) difficulty  = a.slice(13);
    if (a.startsWith('--estimate-usd=')) estimateUsd = parseFloat(a.slice('--estimate-usd='.length));
  }
  return { show, estimate, check, configMode, model, difficulty, estimateUsd, dryRun };
}

async function main() {
  const { show, estimate, check, configMode, model, difficulty, estimateUsd, dryRun } = parseArgs(process.argv);

  if (show) {
    const cfg   = readConfig();
    const spend = readSpend();
    console.log(`\n${c('bold', c('blue', '⬡ KOSAME Cost Guard — 現在の設定'))}`);
    console.log(`  月間予算上限    : $${cfg.monthlyBudgetUsd.toFixed(2)}`);
    console.log(`  アラート閾値    : ${cfg.alertThresholdPct}%`);
    console.log(`  今月の支出      : $${spend.totalUsd.toFixed(4)} (${spend.month})`);
    console.log(`  残予算          : $${Math.max(0, cfg.monthlyBudgetUsd - spend.totalUsd).toFixed(4)}`);
    console.log('');
    return;
  }

  if (estimate) {
    const ec = estimateEscalationCost(difficulty);
    console.log(`\n${c('bold', c('blue', '⬡ コスト見積もり'))}  [${difficulty}]`);
    for (const e of ec.estimates) {
      console.log(`  ${e.model.padEnd(24)} $${e.totalUsd.toFixed(6)}`);
    }
    console.log(`  ${'primary'.padEnd(24)} $${ec.primaryUsd.toFixed(6)}`);
    console.log(`  ${'max'.padEnd(24)} $${ec.maxUsd.toFixed(6)}`);
    console.log('');
    return;
  }

  if (check) {
    const result = checkBudget(estimateUsd, { dryRun });
    console.log(`\n${c('bold', c('blue', '⬡ 予算チェック'))}`);
    console.log(`  ok: ${result.ok ? c('green', 'true') : c('red', 'false')}`);
    console.log(`  blocked: ${result.blocked}`);
    console.log(`  projectedUsd: $${result.projectedUsd.toFixed(4)}`);
    console.log(`  remainingUsd: $${result.remainingUsd.toFixed(4)}`);
    console.log('');
    return;
  }

  // default / --config: interactive config
  await interactiveConfig({ dryRun });
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
  TYPICAL_TOKENS,
  readConfig,
  writeConfig,
  readSpend,
  recordSpend,
  estimateCost,
  estimateEscalationCost,
  checkBudget,
  showHighTaskWarning,
  interactiveConfig,
};
