#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cheap-First Runtime v110.37.0
 *
 * 難易度に応じたモデルチェーンを最安順に試し、成功したら記録する。
 * 失敗したモデルは同セッション内でスキップ。
 * 学習ログから最安成功モデルを先頭に並び替えて次回以降に活かす。
 *
 * 設定ファイル : ~/.kosame/provider-config.json
 * 支出トラッカー: ~/.kosame/.cost-spend.json  (月別累計、kosame-cost-guard と共用)
 *
 * チェーン:
 *   light  : gemini-2.5-flash → deepseek-chat → gpt-4o-mini
 *   medium : gemini-2.5-pro   → deepseek-reasoner → gpt-4o
 *   high   : claude-sonnet-4-6 → gpt-4o  (human_gate 必須)
 *
 * Usage:
 *   node tools/kosame-cheap-first-runtime.js --difficulty=light --prompt="Hello"
 *   node tools/kosame-cheap-first-runtime.js --difficulty=medium --prompt="..." --write
 *   node tools/kosame-cheap-first-runtime.js --config
 *   node tools/kosame-cheap-first-runtime.js --show
 */

const fs       = require('node:fs');
const path     = require('node:path');
const os       = require('node:os');
const readline = require('node:readline');

const TOOL_META = {
  version:       '110.37.0',
  feature:       'v110-37-cheap-first-runtime',
  slug:          'kosame-cheap-first-runtime',
  dryRunDefault: true,
};

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset:   '\x1b[0m', bold:    '\x1b[1m', dim:    '\x1b[2m',
  green:   '\x1b[32m', yellow: '\x1b[33m', blue:   '\x1b[34m',
  cyan:    '\x1b[36m', red:    '\x1b[31m', gray:   '\x1b[90m',
  magenta: '\x1b[35m', bgRed:  '\x1b[41m', bgYellow: '\x1b[43m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

// ── Constants ─────────────────────────────────────────────────────────────────

const KOSAME_DIR          = path.join(os.homedir(), '.kosame');
const PROVIDER_CONFIG_FILE = path.join(KOSAME_DIR, 'provider-config.json');
const SPEND_FILE          = path.join(KOSAME_DIR, '.cost-spend.json');

// モデルチェーン定義（安い順）
const DEFAULT_CHAINS = {
  light:  ['gemini-2.5-flash',  'deepseek-chat',      'gpt-4o-mini'],
  medium: ['gemini-2.5-pro',    'deepseek-reasoner',  'gpt-4o'],
  high:   ['claude-sonnet-4-6', 'gpt-4o'],
};

// DeepSeek系はマスク処理必須
const DEEPSEEK_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner']);

// USD per 1M tokens
const PRICE_TABLE = {
  'gemini-2.5-flash':  { input: 0.075, output: 0.30,  provider: 'gemini'    },
  'gemini-2.5-pro':    { input: 1.25,  output: 10.00, provider: 'gemini'    },
  'deepseek-chat':     { input: 0.07,  output: 1.10,  provider: 'deepseek'  },
  'deepseek-reasoner': { input: 0.55,  output: 2.19,  provider: 'deepseek'  },
  'gpt-4o-mini':       { input: 0.15,  output: 0.60,  provider: 'openai'    },
  'gpt-4o':            { input: 2.50,  output: 10.00, provider: 'openai'    },
  'claude-sonnet-4-6': { input: 3.00,  output: 15.00, provider: 'anthropic' },
};

// 難易度別の典型トークン数（見積もり用）
const TYPICAL_TOKENS = {
  light:  { input: 2_000,  output: 500   },
  medium: { input: 5_000,  output: 1_500 },
  high:   { input: 8_000,  output: 3_000 },
};

const DEFAULT_CONFIG = {
  monthlyBudgetUsd: 20.00,
  chains:           { ...DEFAULT_CHAINS },
  skipList:         [],
  successHistory:   {},
  updatedAt:        null,
};

const TIMEOUT_MS = 30_000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(KOSAME_DIR)) {
    fs.mkdirSync(KOSAME_DIR, { recursive: true, mode: 0o700 });
  }
}

function nowIso() {
  return new Date().toISOString();
}

function hr(len = 60) {
  return '─'.repeat(len);
}

// ── Config read/write ─────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(PROVIDER_CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PROVIDER_CONFIG_FILE, 'utf8'));
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        chains:         { ...DEFAULT_CHAINS, ...raw.chains },
        skipList:       Array.isArray(raw.skipList) ? raw.skipList : [],
        successHistory: raw.successHistory && typeof raw.successHistory === 'object'
          ? raw.successHistory : {},
      };
    }
  } catch (_) {}
  return { ...DEFAULT_CONFIG, chains: { ...DEFAULT_CHAINS } };
}

function writeConfig(cfg, dryRun = true) {
  const updated = { ...cfg, updatedAt: nowIso() };
  if (!dryRun) {
    ensureDir();
    fs.writeFileSync(PROVIDER_CONFIG_FILE, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
  }
  return { ok: true, dryRun, config: updated };
}

// ── Spend tracking ─────────────────────────────────────────────────────────────

function currentMonthKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function readSpend() {
  try {
    if (fs.existsSync(SPEND_FILE)) {
      const raw  = JSON.parse(fs.readFileSync(SPEND_FILE, 'utf8'));
      const key  = currentMonthKey();
      return { month: key, totalUsd: raw[key] ?? 0, all: raw };
    }
  } catch (_) {}
  return { month: currentMonthKey(), totalUsd: 0, all: {} };
}

function recordSpend(usd, dryRun = true) {
  if (typeof usd !== 'number' || usd <= 0) return { ok: false };
  const spend = readSpend();
  const key   = spend.month;
  const next  = { ...spend.all, [key]: (spend.totalUsd + usd) };
  if (!dryRun) {
    ensureDir();
    fs.writeFileSync(SPEND_FILE, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  }
  return { ok: true, dryRun, month: key, addedUsd: usd, newTotalUsd: next[key] };
}

// ── Cost estimation ───────────────────────────────────────────────────────────

function estimateCost(modelId, inputTokens, outputTokens) {
  const price = PRICE_TABLE[modelId];
  if (!price) return { modelId, provider: 'unknown', totalUsd: 0, warning: `unknown model: ${modelId}` };
  const inputUsd  = (inputTokens  / 1_000_000) * price.input;
  const outputUsd = (outputTokens / 1_000_000) * price.output;
  return { modelId, provider: price.provider, inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

function estimateChainCost(difficulty) {
  const tokens  = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const chain   = DEFAULT_CHAINS[difficulty] || [];
  const entries = chain.map(m => estimateCost(m, tokens.input, tokens.output));
  return {
    difficulty,
    tokens,
    cheapestUsd: Math.min(...entries.map(e => e.totalUsd)),
    maxUsd:      Math.max(...entries.map(e => e.totalUsd)),
    byModel:     entries,
  };
}

// ── Budget check ──────────────────────────────────────────────────────────────

function checkBudget(estimatedUsd, config) {
  const spend     = readSpend();
  const budget    = config.monthlyBudgetUsd;
  const projected = spend.totalUsd + estimatedUsd;
  const remaining = budget - spend.totalUsd;
  const blocked   = projected > budget;

  return {
    ok:           !blocked,
    blocked,
    estimatedUsd,
    spentUsd:     spend.totalUsd,
    projectedUsd: projected,
    budgetUsd:    budget,
    remainingUsd: remaining,
    month:        spend.month,
    reason:       blocked
      ? `月間予算上限 $${budget.toFixed(2)} を超過 (使用済 $${spend.totalUsd.toFixed(4)} + 見積 $${estimatedUsd.toFixed(6)} = $${projected.toFixed(4)})`
      : null,
  };
}

// ── Chain resolver ────────────────────────────────────────────────────────────

/**
 * 難易度に対してモデルの実行順を決定する。
 *
 * 優先順:
 *   1. 過去に成功実績があるモデルを、avgCostUsd 昇順で前に並べる
 *   2. 成功実績がないモデルはデフォルトチェーン順のまま後ろに追加
 *   3. config.skipList (永続) + sessionSkipList (一時) に含まれるモデルは除外
 */
function resolveChain(difficulty, config, sessionSkipList = []) {
  const base       = config.chains[difficulty] || DEFAULT_CHAINS[difficulty] || [];
  const skipSet    = new Set([...config.skipList, ...sessionSkipList]);
  const history    = config.successHistory || {};
  const available  = base.filter(m => !skipSet.has(m));

  const withHistory    = [];
  const withoutHistory = [];

  for (const m of available) {
    const h = history[m];
    if (h && h.successCount > 0) {
      withHistory.push({ modelId: m, avgCostUsd: h.avgCostUsd ?? Infinity });
    } else {
      withoutHistory.push(m);
    }
  }

  // 成功実績ありは avgCostUsd 昇順
  withHistory.sort((a, b) => a.avgCostUsd - b.avgCostUsd);

  return [
    ...withHistory.map(x => x.modelId),
    ...withoutHistory,
  ];
}

// ── DeepSeek masking ─────────────────────────────────────────────────────────

function maskForDeepSeek(prompt) {
  let masked = prompt;
  let maskCount = 0;

  const patterns = [
    // Private keys
    { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, token: '[MASKED:PRIVATE_KEY]' },
    // GitHub tokens
    { re: /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}/g, token: '[MASKED:GITHUB_CRED]' },
    // JWT
    { re: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, token: '[MASKED:JWT]' },
    // DeepSeek key
    { re: /DEEPSEEK_API_KEY\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{8,})["']?/gi, token: '[MASKED:DEEPSEEK_KEY]' },
    // Generic API key
    { re: /(?:api[_\-]?key|apikey)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{16,})["']?/gi, token: '[MASKED:API_KEY]' },
    // Bearer tokens
    { re: /(?:bearer|auth[_\-]?token|access[_\-]?token)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{16,})["']?/gi, token: '[MASKED:TOKEN]' },
    // Email
    { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, token: '[MASKED:EMAIL]' },
    // Private IP
    { re: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g, token: '[MASKED:IP]' },
  ];

  for (const { re, token } of patterns) {
    const before = masked;
    masked = masked.replace(re, token);
    if (masked !== before) maskCount++;
  }

  return { masked, maskCount, wasModified: maskCount > 0 };
}

// ── Live API callers ──────────────────────────────────────────────────────────

async function callGemini(modelId, prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 2048 },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${res.statusText}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no content)';
    const usage = data?.usageMetadata ?? {};
    return {
      response: text,
      inputTokens:  usage.promptTokenCount  ?? null,
      outputTokens: usage.candidatesTokenCount ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(modelId, prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2048,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '(no content)';
    return {
      response: text,
      inputTokens:  data?.usage?.prompt_tokens    ?? null,
      outputTokens: data?.usage?.completion_tokens ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callDeepSeek(modelId, prompt) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');

  // DeepSeek はマスク必須
  const { masked, maskCount } = maskForDeepSeek(prompt);
  if (maskCount > 0) {
    process.stderr.write(`[cheap-first] DeepSeek マスク適用: ${maskCount} 箇所\n`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: masked }],
        max_tokens: 2048,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`DeepSeek API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content ?? '(no content)';
    return {
      response: text,
      inputTokens:  data?.usage?.prompt_tokens    ?? null,
      outputTokens: data?.usage?.completion_tokens ?? null,
      deepseekMasked: true,
      maskCount,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callClaude(modelId, prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      modelId,
        max_tokens: 2048,
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text ?? '(no content)';
    return {
      response: text,
      inputTokens:  data?.usage?.input_tokens  ?? null,
      outputTokens: data?.usage?.output_tokens ?? null,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callModel(modelId, prompt) {
  const price = PRICE_TABLE[modelId];
  if (!price) throw new Error(`Unknown model: ${modelId}`);

  switch (price.provider) {
    case 'gemini':    return callGemini(modelId, prompt);
    case 'deepseek':  return callDeepSeek(modelId, prompt);
    case 'openai':    return callOpenAI(modelId, prompt);
    case 'anthropic': return callClaude(modelId, prompt);
    default: throw new Error(`No caller for provider: ${price.provider}`);
  }
}

// ── Human gate ────────────────────────────────────────────────────────────────

async function waitForHumanApproval(modelId, difficulty, opts = {}) {
  const { dryRun = true, out = console.log } = opts;

  out('\n' + c('bgRed', c('bold', '  ⛔ HUMAN GATE ⛔  ')));
  out(`\n  ${c('bold', '難易度 :')} ${c('red', difficulty)}`);
  out(`  ${c('bold', 'モデル :')} ${c('cyan', modelId)}`);
  out(`  ${c('bold', '理由   :')} high 難易度タスクは human_gate 必須`);

  if (dryRun) {
    out(`\n  ${c('yellow', '[DRY-RUN] 承認をスキップ（dryRun=true）')}`);
    return true;
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n  ${c('bold', '実行を承認しますか？')} (yes/no): `, answer => {
      rl.close();
      const approved = answer.trim().toLowerCase() === 'yes';
      out(approved ? `  ${c('green', '✓ 承認されました')}` : `  ${c('red', '✗ 拒否されました')}`);
      resolve(approved);
    });
  });
}

// ── Success history update ────────────────────────────────────────────────────

function updateSuccessHistory(config, modelId, success, costUsd, durationMs) {
  const history  = config.successHistory || {};
  const prev     = history[modelId] || { successCount: 0, failCount: 0, avgCostUsd: null, avgDurationMs: null };

  let newAvgCost = prev.avgCostUsd;
  let newAvgDur  = prev.avgDurationMs;

  if (success && costUsd != null) {
    const n = prev.successCount + 1;
    newAvgCost = prev.avgCostUsd == null
      ? costUsd
      : ((prev.avgCostUsd * prev.successCount) + costUsd) / n;
    newAvgDur  = prev.avgDurationMs == null || durationMs == null
      ? durationMs
      : ((prev.avgDurationMs * prev.successCount) + durationMs) / n;
  }

  return {
    ...config,
    successHistory: {
      ...history,
      [modelId]: {
        successCount:  success ? prev.successCount + 1 : prev.successCount,
        failCount:     success ? prev.failCount        : prev.failCount + 1,
        avgCostUsd:    newAvgCost,
        avgDurationMs: newAvgDur,
        lastAttemptAt: nowIso(),
      },
    },
  };
}

// ── Learning log ──────────────────────────────────────────────────────────────

function recordToLearningLog(entry, dryRun = true) {
  try {
    const { appendLog } = require('./kosame-learning-log');
    return appendLog(entry, { dryRun });
  } catch (_) {
    return { ok: false, reason: 'kosame-learning-log unavailable' };
  }
}

// ── Display helpers ───────────────────────────────────────────────────────────

function printCostTable(difficulty, chain, config) {
  const tokens = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const history = config.successHistory || {};

  console.log(`\n  ${c('bold', '推定コスト')} (${difficulty}, ~${tokens.input.toLocaleString()} input / ~${tokens.output.toLocaleString()} output tokens)`);
  console.log('  ' + hr(56));

  for (const [i, modelId] of chain.entries()) {
    const est  = estimateCost(modelId, tokens.input, tokens.output);
    const h    = history[modelId];
    const tag  = i === 0 ? c('green', '★ 優先') : c('dim', `  ${i + 1}番目`);
    const hist = h
      ? c('dim', `成功${h.successCount}/失敗${h.failCount}`)
      : c('dim', '実績なし');
    const cost = `$${est.totalUsd.toFixed(6)}`;
    console.log(`  ${tag}  ${modelId.padEnd(20)} ${cost.padStart(12)}  ${hist}`);
  }
  console.log('  ' + hr(56));
}

function printBudgetStatus(budgetCheck) {
  const pct  = budgetCheck.budgetUsd > 0
    ? Math.round((budgetCheck.spentUsd / budgetCheck.budgetUsd) * 100)
    : 0;
  const bar  = '[' + '█'.repeat(Math.round(pct / 5)).padEnd(20, '░') + ']';
  const col  = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';

  console.log(`\n  ${c('bold', '月間予算')}  $${budgetCheck.spentUsd.toFixed(4)} / $${budgetCheck.budgetUsd.toFixed(2)}  ${c(col, bar)} ${pct}%`);
  if (budgetCheck.blocked) {
    console.log(`  ${c('red', '⛔ 予算上限に達しています — 実行を停止します')}`);
  }
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * プロンプトを難易度に応じたモデルチェーンで実行する。
 *
 * @param {string}  prompt     実行するプロンプト
 * @param {string}  difficulty 'light' | 'medium' | 'high'
 * @param {object}  opts
 *   dryRun     {boolean}  true=模擬実行（デフォルト）
 *   silent     {boolean}  コンソール出力を抑制
 *   taskInput  {string}   Learning Log 用タスク説明
 *   taskType   {string}   Learning Log 用タスク種別
 * @returns {Promise<object>}
 */
async function cheapFirstRun(prompt, difficulty, opts = {}) {
  const {
    dryRun    = true,
    silent    = false,
    taskInput = prompt.slice(0, 120),
    taskType  = 'other',
  } = opts;

  const out = silent ? () => {} : console.log;
  const isHigh = difficulty === 'high';

  out('\n' + c('bold', c('blue', `⬡ KOSAME Cheap-First Runtime`)) + `  v${TOOL_META.version}`);
  out(`  難易度: ${c(isHigh ? 'red' : difficulty === 'medium' ? 'yellow' : 'green', difficulty)}  dryRun: ${dryRun}`);
  out('  ' + hr());

  let config = readConfig();
  const sessionSkipList = [];

  // チェーン解決
  const chain = resolveChain(difficulty, config, sessionSkipList);
  if (chain.length === 0) {
    return {
      tool: TOOL_META.slug, version: TOOL_META.version,
      ok: false, dryRun,
      error: `利用可能なモデルがありません (difficulty=${difficulty}, skipList=${JSON.stringify(config.skipList)})`,
    };
  }

  // 推定コスト表示
  if (!silent) printCostTable(difficulty, chain, config);

  // 予算チェック（チェーン先頭モデルの見積もりで判定）
  const tokens     = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const firstEst   = estimateCost(chain[0], tokens.input, tokens.output);
  const budgetCheck = checkBudget(firstEst.totalUsd, config);
  if (!silent) printBudgetStatus(budgetCheck);

  if (budgetCheck.blocked) {
    return {
      tool: TOOL_META.slug, version: TOOL_META.version,
      ok: false, dryRun, blocked: true,
      reason: budgetCheck.reason,
      spentUsd: budgetCheck.spentUsd,
      budgetUsd: budgetCheck.budgetUsd,
    };
  }

  // human_gate チェック（high は必須、skipHumanGate=true の場合は呼び出し元が管理）
  if (isHigh && !opts.skipHumanGate) {
    const approved = await waitForHumanApproval(chain[0], difficulty, { dryRun, out });
    if (!approved) {
      return {
        tool: TOOL_META.slug, version: TOOL_META.version,
        ok: false, dryRun, blocked: true, reason: 'human_gate: 拒否されました',
      };
    }
  }

  // モデルチェーンを順番に試す
  const attempts = [];

  for (const modelId of chain) {
    out(`\n  ${c('cyan', '→')} ${modelId} を試行...`);
    const startMs = Date.now();

    if (dryRun) {
      // DRY-RUN: 模擬実行
      const durationMs = Math.round(800 + Math.random() * 400);
      const est        = estimateCost(modelId, tokens.input, tokens.output);
      const deepseekMasked = DEEPSEEK_MODELS.has(modelId);

      out(`     ${c('yellow', '[DRY-RUN]')} 模擬成功 (${durationMs}ms, 推定 $${est.totalUsd.toFixed(6)})${deepseekMasked ? '  [DeepSeek: マスク適用済]' : ''}`);

      attempts.push({
        modelId, success: true, dryRun: true,
        durationMs, costUsd: est.totalUsd, deepseekMasked,
        response: `[DRY-RUN] ${modelId} からの模擬レスポンス`,
      });

      // DRY-RUN では最初のモデルで成功とみなして終了
      config = updateSuccessHistory(config, modelId, true, est.totalUsd, durationMs);
      writeConfig(config, true); // dryRun なので書き込まない

      recordToLearningLog({
        taskInput, taskType, difficulty,
        model: modelId, provider: PRICE_TABLE[modelId]?.provider ?? 'unknown',
        costUsd: est.totalUsd, durationMs, success: true, escalated: false, dryRun: true,
        meta: { runtime: TOOL_META.slug, deepseekMasked },
      }, true);

      return {
        tool: TOOL_META.slug, version: TOOL_META.version,
        ok: true, dryRun: true,
        usedModel: modelId,
        attempts,
        response: attempts[attempts.length - 1].response,
        realProductActionsExecuted: false,
      };
    }

    // LIVE 実行
    try {
      const result     = await callModel(modelId, prompt);
      const durationMs = Date.now() - startMs;
      const inTok      = result.inputTokens  ?? tokens.input;
      const outTok     = result.outputTokens ?? tokens.output;
      const costEst    = estimateCost(modelId, inTok, outTok);

      out(`     ${c('green', '✓')} 成功 (${durationMs}ms, $${costEst.totalUsd.toFixed(6)})`);

      attempts.push({
        modelId, success: true, dryRun: false,
        durationMs, costUsd: costEst.totalUsd,
        inputTokens: inTok, outputTokens: outTok,
        deepseekMasked: result.deepseekMasked ?? false,
      });

      // 支出記録
      recordSpend(costEst.totalUsd, false);

      // 成功履歴更新
      config = updateSuccessHistory(config, modelId, true, costEst.totalUsd, durationMs);
      writeConfig(config, false);

      // Learning Log
      recordToLearningLog({
        taskInput, taskType, difficulty,
        model: modelId, provider: PRICE_TABLE[modelId]?.provider ?? 'unknown',
        costUsd: costEst.totalUsd, durationMs,
        success: true, escalated: attempts.length > 1, dryRun: false,
        meta: { runtime: TOOL_META.slug, deepseekMasked: result.deepseekMasked ?? false },
      }, false);

      return {
        tool: TOOL_META.slug, version: TOOL_META.version,
        ok: true, dryRun: false,
        usedModel: modelId,
        attempts,
        response: result.response,
        costUsd: costEst.totalUsd,
        durationMs,
        realProductActionsExecuted: true,
      };

    } catch (err) {
      const durationMs = Date.now() - startMs;
      out(`     ${c('red', '✗')} 失敗: ${err.message.slice(0, 120)}`);
      out(`     ${c('yellow', '↷')} ${modelId} をスキップして次のモデルへ`);

      attempts.push({
        modelId, success: false, dryRun: false,
        durationMs, error: err.message.slice(0, 200),
      });

      // セッション内スキップリストに追加
      sessionSkipList.push(modelId);

      // 失敗履歴を記録
      config = updateSuccessHistory(config, modelId, false, null, durationMs);
      writeConfig(config, false);

      // Learning Log（失敗）
      recordToLearningLog({
        taskInput, taskType, difficulty,
        model: modelId, provider: PRICE_TABLE[modelId]?.provider ?? 'unknown',
        costUsd: null, durationMs,
        success: false, escalated: attempts.length > 1, dryRun: false,
        meta: { runtime: TOOL_META.slug, error: err.message.slice(0, 100) },
      }, false);
    }
  }

  // 全モデル失敗
  out(`\n  ${c('red', '⛔ すべてのモデルが失敗しました')}`);
  return {
    tool: TOOL_META.slug, version: TOOL_META.version,
    ok: false, dryRun: false,
    error: 'all models failed',
    attempts,
    realProductActionsExecuted: false,
  };
}

// ── Config display ────────────────────────────────────────────────────────────

function showConfig() {
  const config = readConfig();
  const spend  = readSpend();

  console.log('\n' + c('bold', c('blue', '⬡ KOSAME Cheap-First Runtime — 設定'))  + `  v${TOOL_META.version}`);
  console.log('  ' + hr());
  console.log(`  設定ファイル  : ${c('cyan', PROVIDER_CONFIG_FILE)}`);
  console.log(`  月間予算上限  : ${c('bold', '$' + config.monthlyBudgetUsd.toFixed(2))}`);
  console.log(`  今月の使用額  : ${c('yellow', '$' + spend.totalUsd.toFixed(4))} / $${config.monthlyBudgetUsd.toFixed(2)}  (${spend.month})`);
  console.log(`  スキップリスト: ${config.skipList.length > 0 ? config.skipList.join(', ') : c('dim', 'なし')}`);

  console.log('\n  チェーン設定:');
  for (const diff of ['light', 'medium', 'high']) {
    const chain = config.chains[diff] || DEFAULT_CHAINS[diff] || [];
    const gate  = diff === 'high' ? c('red', ' [human_gate]') : '';
    console.log(`    ${diff.padEnd(6)}: ${chain.join(' → ')}${gate}`);
  }

  const history = config.successHistory || {};
  const models  = Object.keys(history);
  if (models.length > 0) {
    console.log('\n  成功履歴:');
    for (const m of models) {
      const h = history[m];
      const avg = h.avgCostUsd != null ? `avg $${h.avgCostUsd.toFixed(6)}` : '      コストなし';
      const dur = h.avgDurationMs != null ? `${Math.round(h.avgDurationMs)}ms` : '  n/a';
      console.log(`    ${m.padEnd(22)} 成功${String(h.successCount).padStart(3)}/失敗${String(h.failCount).padStart(3)}  ${avg}  ${dur}`);
    }
  }

  console.log('');
}

// ── Interactive config ────────────────────────────────────────────────────────

async function interactiveConfig(dryRun = true) {
  const config = readConfig();
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const q = (prompt) => new Promise(resolve => rl.question(prompt, resolve));

  console.log('\n' + c('bold', '⬡ KOSAME Cheap-First Runtime — 設定変更'));
  console.log(`  現在の月間予算: $${config.monthlyBudgetUsd.toFixed(2)}`);

  const budgetStr = await q(`  新しい月間予算 (USD) [Enter でスキップ]: `);
  const skipStr   = await q(`  スキップリスト (カンマ区切り, 空でリセット) [Enter でスキップ]: `);
  rl.close();

  let updated = { ...config };

  if (budgetStr.trim()) {
    const v = parseFloat(budgetStr.trim());
    if (!isNaN(v) && v > 0) {
      updated.monthlyBudgetUsd = v;
      console.log(`  月間予算: $${v.toFixed(2)} に更新`);
    } else {
      console.log(c('red', '  無効な値のためスキップ'));
    }
  }

  if (skipStr.trim() !== '') {
    updated.skipList = skipStr.split(',').map(s => s.trim()).filter(Boolean);
    console.log(`  スキップリスト: ${updated.skipList.join(', ')}`);
  } else if (skipStr === '') {
    // 空入力 = スキップ
  }

  const result = writeConfig(updated, dryRun);
  console.log(dryRun
    ? c('yellow', '\n  [DRY-RUN] 設定は保存されませんでした')
    : c('green', '\n  ✓ 設定を保存しました'));
  return result;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => {
    const prefix = `--${name}=`;
    const arg    = argv.find(a => a.startsWith(prefix));
    return arg ? arg.slice(prefix.length) : null;
  };
  const has = (name) => argv.includes(`--${name}`);

  return {
    difficulty: get('difficulty') || 'light',
    prompt:     get('prompt') || '',
    dryRun:     !has('write'),
    configMode: has('config'),
    showMode:   has('show'),
    jsonMode:   has('json'),
    silent:     has('silent'),
    taskInput:  get('task-input') || null,
    taskType:   get('task-type') || 'other',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.showMode) {
    showConfig();
    return;
  }

  if (args.configMode) {
    await interactiveConfig(args.dryRun);
    return;
  }

  if (!args.prompt) {
    console.log(`\n${c('bold', 'Usage:')}
  node tools/kosame-cheap-first-runtime.js --difficulty=<light|medium|high> --prompt="..."
  node tools/kosame-cheap-first-runtime.js --difficulty=medium --prompt="..." --write   # live
  node tools/kosame-cheap-first-runtime.js --show     # 設定と履歴を表示
  node tools/kosame-cheap-first-runtime.js --config   # インタラクティブ設定変更
  node tools/kosame-cheap-first-runtime.js --config --write   # 設定を保存

Flags:
  --write        dryRun を無効化して実際にAPIを呼び出す
  --json         JSON 出力
  --silent       コンソール出力を抑制
  --task-input   Learning Log 用のタスク説明
  --task-type    Learning Log 用のタスク種別 (smoke/fix/implement/design/deploy/other)
`);
    return;
  }

  const result = await cheapFirstRun(args.prompt, args.difficulty, {
    dryRun:    args.dryRun,
    silent:    args.silent,
    taskInput: args.taskInput ?? args.prompt.slice(0, 120),
    taskType:  args.taskType,
  });

  if (args.jsonMode) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!args.silent) {
    console.log('\n  ' + hr());
    if (result.ok) {
      console.log(`  ${c('green', '✓')} 完了  モデル: ${c('cyan', result.usedModel)}`);
      if (result.costUsd != null) {
        console.log(`  コスト: $${result.costUsd.toFixed(6)}  時間: ${result.durationMs}ms`);
      }
    } else {
      console.log(`  ${c('red', '✗')} 失敗: ${result.error || result.reason}`);
    }
    console.log('');
  }
}

if (require.main === module) {
  main().catch(err => {
    console.error(c('red', 'ERROR:'), err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  DEFAULT_CHAINS,
  PRICE_TABLE,
  TYPICAL_TOKENS,
  DEEPSEEK_MODELS,
  readConfig,
  writeConfig,
  readSpend,
  recordSpend,
  estimateCost,
  estimateChainCost,
  checkBudget,
  resolveChain,
  maskForDeepSeek,
  updateSuccessHistory,
  cheapFirstRun,
};
