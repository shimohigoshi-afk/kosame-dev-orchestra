#!/usr/bin/env node
'use strict';

/**
 * KOSAME Cheap-First Runtime v110.40.0
 *
 * 完全AI組織OS — 論理ワーカー名とAPI model IDを分離し、
 * 障害を自動検知・自動交代・自動復帰する直列Cheap-Firstランタイム。
 *
 * 設定: ~/.kosame/provider-config.json
 * ヘルスキャッシュ: ~/.kosame/provider-health-cache.json
 * 支出: ~/.kosame/.cost-spend.json
 *
 * チーム（通常時・直列）:
 *   light  : cheap_code_worker → cheap_general_worker → gpt_worker
 *   medium : general_worker → code_pro_worker → claude_haiku → gpt_worker
 *   high   : claude_sonnet → gpt_upper  [human_gate必須]
 *
 * 裁定:
 *   通常    : ルールベース + gpt_worker
 *   対立時  : gpt_upper
 *   品質確認: claude_sonnet
 *
 * 並走: 品質不足・失敗後・不一致時のみ
 */

const fs       = require('node:fs');
const path     = require('node:path');
const os       = require('node:os');
const readline = require('node:readline');

const TOOL_META = {
  version:       '110.41.0',
  feature:       'v110-41-cheap-first-runtime',
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
const hr = (len = 60) => '─'.repeat(len);

function buildApiError(provider, res, body) {
  const retryAfter = res?.headers?.get?.('retry-after');
  const retryPart  = retryAfter ? ` retry-after:${retryAfter}` : '';
  return new Error(`${provider} API ${res.status}${retryPart}: ${String(body || '').slice(0, 200)}`);
}

// ── File paths ────────────────────────────────────────────────────────────────

const KOSAME_DIR          = path.join(os.homedir(), '.kosame');
const PROVIDER_CONFIG_FILE = path.join(KOSAME_DIR, 'provider-config.json');
const HEALTH_CACHE_FILE   = path.join(KOSAME_DIR, 'provider-health-cache.json');
const SPEND_FILE          = path.join(KOSAME_DIR, '.cost-spend.json');

// ── Worker registry ───────────────────────────────────────────────────────────
// 論理ワーカー名 → API model ID のマッピング。
// provider-config.json の workers フィールドで上書き可能。

const DEFAULT_WORKER_REGISTRY = {
  cheap_code_worker:    { modelId: 'deepseek-chat',            provider: 'deepseek',   role: 'implementer', deepseekMasked: true  },
  cheap_general_worker: { modelId: 'gpt-4o-mini',              provider: 'openai',     role: 'implementer' },
  gpt_worker:          { modelId: 'gpt-4o-mini',              provider: 'openai',     role: 'arbiter'     },
  general_worker:      { modelId: 'gemini-2.5-flash',         provider: 'gemini',     role: 'implementer' },
  code_pro_worker:     { modelId: 'claude-haiku-4-5-20251001',provider: 'anthropic',  role: 'implementer' },
  claude_haiku:        { modelId: 'claude-haiku-4-5-20251001',provider: 'anthropic',  role: 'implementer' },
  claude_sonnet:       { modelId: 'claude-sonnet-4-6',        provider: 'anthropic',  role: 'quality'     },
  gpt_upper:           { modelId: 'gpt-4o',                   provider: 'openai',     role: 'arbiter'     },
};

// 旧 model ID → worker名（後方互換）
const DEFAULT_MIGRATION_ALIASES = {
  'gemini-2.5-flash':          'general_worker',
  'gemini-2.5-pro':            'code_pro_worker',
  'deepseek-chat':             'cheap_code_worker',
  'deepseek-reasoner':         'cheap_code_worker',
  'gpt-4o-mini':               'cheap_general_worker',
  'gpt-4o':                    'gpt_upper',
  'claude-sonnet-4-6':         'claude_sonnet',
  'claude-haiku-4-5-20251001': 'claude_haiku',
  'claude-haiku-4-5':          'claude_haiku',
};

// 各 provider が必要とする env key
const PROVIDER_ENV_KEYS = {
  deepseek:  'DEEPSEEK_API_KEY',
  openai:    'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  gemini:    'GEMINI_API_KEY',
  xai:       'XAI_API_KEY',
};

// DeepSeek 系はプロバイダー側でマスク処理必須
const DEEPSEEK_MODELS = new Set(['deepseek-chat', 'deepseek-reasoner']);

// ── Model chains (worker名ベース) ─────────────────────────────────────────────

const DEFAULT_CHAINS = {
  light:  ['cheap_code_worker',  'cheap_general_worker', 'gpt_worker'],
  medium: ['general_worker',     'code_pro_worker',      'claude_haiku', 'gpt_worker'],
  high:   ['claude_sonnet',      'gpt_upper'],
};

// ── Price table (USD per 1M tokens) ──────────────────────────────────────────

const PRICE_TABLE = {
  'gemini-2.5-flash':          { input: 0.075, output: 0.30,  provider: 'gemini'    },
  'gemini-2.5-pro':            { input: 1.25,  output: 10.00, provider: 'gemini'    },
  'deepseek-chat':             { input: 0.07,  output: 1.10,  provider: 'deepseek'  },
  'deepseek-reasoner':         { input: 0.55,  output: 2.19,  provider: 'deepseek'  },
  'gpt-4o-mini':               { input: 0.15,  output: 0.60,  provider: 'openai'    },
  'gpt-4o':                    { input: 2.50,  output: 10.00, provider: 'openai'    },
  'claude-haiku-4-5-20251001': { input: 0.80,  output: 4.00,  provider: 'anthropic' },
  'claude-haiku-4-5':          { input: 0.80,  output: 4.00,  provider: 'anthropic' },
  'claude-sonnet-4-6':         { input: 3.00,  output: 15.00, provider: 'anthropic' },
};

// 難易度別の典型トークン数（見積もり用）
const TYPICAL_TOKENS = {
  light:  { input: 2_000,  output: 500   },
  medium: { input: 5_000,  output: 1_500 },
  high:   { input: 8_000,  output: 3_000 },
};

// ── Worker status constants ───────────────────────────────────────────────────

const WSTATUS = {
  AVAILABLE:    'available',
  ON_LEAVE:     'on_leave',    // 429/503 → retryAfter で自動復帰
  ISOLATED:     'isolated',    // 401/403 → 手動対応まで隔離
  EXCLUDED:     'excluded',    // 404 → 設定変更まで除外
  QUALITY_FAIL: 'quality_fail',// セッション内のみ
};

// エラー種別ごとの基本TTL (ms)
const ERROR_TTL_MS = {
  rate_limit: 10 * 60_000,  // Retry-After があれば上書き
  outage:     10 * 60_000,  // 5〜15分の範囲でランダム
  auth:       Infinity,
  not_found:  Infinity,
  quality:    0,            // セッション外は復帰
};

const OUTAGE_TTL_MIN_MS        = 5  * 60_000;
const OUTAGE_TTL_MAX_MS        = 15 * 60_000;
const NOTIFICATION_COOLDOWN_MS = 60 * 60_000;  // 同一原因通知の最小間隔
const TIMEOUT_MS               = 30_000;

// ── Default configs ───────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  monthlyBudgetUsd:   20.00,
  workers:            { ...DEFAULT_WORKER_REGISTRY },
  migrationAliases:   { ...DEFAULT_MIGRATION_ALIASES },
  chains:             { ...DEFAULT_CHAINS },
  skipList:           [],
  successHistory:     {},
  project_rules:      {},   // プロジェクト別プロバイダー制限（kosame-deepseek-project-guard のデフォルトと合成）
  forbidden_keywords: {},   // 追加禁止キーワード（同上）
};

const DEFAULT_HEALTH_CACHE = {
  version:       TOOL_META.version,
  workers:       {},
  notifications: {},
  updatedAt:     null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!fs.existsSync(KOSAME_DIR)) fs.mkdirSync(KOSAME_DIR, { recursive: true, mode: 0o700 });
}
function nowIso() { return new Date().toISOString(); }
function nowMs()  { return Date.now(); }

// ── Config read/write ─────────────────────────────────────────────────────────

function readConfig() {
  try {
    if (fs.existsSync(PROVIDER_CONFIG_FILE)) {
      const raw = JSON.parse(fs.readFileSync(PROVIDER_CONFIG_FILE, 'utf8'));
      return {
        ...DEFAULT_CONFIG,
        ...raw,
        workers:          { ...DEFAULT_WORKER_REGISTRY,   ...raw.workers          },
        migrationAliases: { ...DEFAULT_MIGRATION_ALIASES, ...raw.migrationAliases },
        chains:           { ...DEFAULT_CHAINS,            ...raw.chains           },
        skipList:         Array.isArray(raw.skipList) ? raw.skipList : [],
        successHistory:   (raw.successHistory && typeof raw.successHistory === 'object') ? raw.successHistory : {},
      };
    }
  } catch (_) {}
  return {
    ...DEFAULT_CONFIG,
    workers:         { ...DEFAULT_WORKER_REGISTRY },
    migrationAliases:{ ...DEFAULT_MIGRATION_ALIASES },
    chains:          { ...DEFAULT_CHAINS },
  };
}

function writeConfig(cfg, dryRun = true) {
  const updated = { ...cfg, updatedAt: nowIso() };
  if (!dryRun) {
    ensureDir();
    fs.writeFileSync(PROVIDER_CONFIG_FILE, JSON.stringify(updated, null, 2) + '\n', { mode: 0o600 });
  }
  return { ok: true, dryRun, config: updated };
}

// ── Health cache read/write ───────────────────────────────────────────────────

function readHealthCache() {
  try {
    if (fs.existsSync(HEALTH_CACHE_FILE)) {
      return { ...DEFAULT_HEALTH_CACHE, ...JSON.parse(fs.readFileSync(HEALTH_CACHE_FILE, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT_HEALTH_CACHE };
}

function writeHealthCache(cache, dryRun = true) {
  if (dryRun) return;
  ensureDir();
  fs.writeFileSync(HEALTH_CACHE_FILE, JSON.stringify({ ...cache, updatedAt: nowIso() }, null, 2) + '\n', { mode: 0o600 });
}

// ── Startup env check (API呼び出しなし) ──────────────────────────────────────

function checkEnvPresence(config) {
  const result = {};
  for (const [wName, wDef] of Object.entries(config.workers || {})) {
    const envKey = PROVIDER_ENV_KEYS[wDef.provider || ''];
    result[wName] = envKey ? !!process.env[envKey] : false;
  }
  return result;
}

// ── Worker resolution ────────────────────────────────────────────────────────

/**
 * worker名 or 旧 model ID → 正規のワーカー定義を返す。
 * config.workers に登録されていれば直接使用。
 * migrationAliases で旧IDを新worker名に読み替え。
 */
function resolveWorker(nameOrId, config) {
  // 直接ヒット
  if (config.workers[nameOrId]) return { workerName: nameOrId, ...config.workers[nameOrId] };
  // migrationAlias 経由
  const aliasedName = config.migrationAliases[nameOrId];
  if (aliasedName && config.workers[aliasedName]) return { workerName: aliasedName, ...config.workers[aliasedName] };
  // フォールバック: 古いモデルIDをそのまま使う
  const provider = PRICE_TABLE[nameOrId]?.provider ?? 'unknown';
  return { workerName: nameOrId, modelId: nameOrId, provider, role: 'implementer', deepseekMasked: DEEPSEEK_MODELS.has(nameOrId) };
}

function resolveModelId(nameOrId, config) {
  return resolveWorker(nameOrId, config).modelId;
}

// ── Error classification ──────────────────────────────────────────────────────

/**
 * API エラーメッセージからエラー種別を分類する。
 * 429/503 → rate_limit/outage（有給フラグ）
 * 401/403 → auth（隔離）
 * 404 / model_not_found → not_found（除外）
 * その他  → error（セッション内スキップ）
 */
function classifyApiError(err) {
  const msg = (err?.message || '').toLowerCase();

  // ステータスコードを本文から抽出
  const statusMatch = msg.match(/\b(4\d\d|5\d\d)\b/);
  const status = statusMatch ? parseInt(statusMatch[1]) : null;

  // Retry-After（秒 or ms）を抽出
  const retryMatch = msg.match(/retry[_\-]?after[:\s]+(\d+)/i);
  const retryAfterMs = retryMatch
    ? parseInt(retryMatch[1]) * (parseInt(retryMatch[1]) > 1000 ? 1 : 1000)
    : null;

  if (status === 429 || msg.includes('rate limit') || msg.includes('quota') || msg.includes('too many')) {
    return { type: 'rate_limit', ttlMs: retryAfterMs ?? ERROR_TTL_MS.rate_limit };
  }
  if (status === 503 || msg.includes('service unavailable') || msg.includes('overloaded') || msg.includes('503')) {
    const jitter = Math.random() * (OUTAGE_TTL_MAX_MS - OUTAGE_TTL_MIN_MS);
    return { type: 'outage', ttlMs: Math.round(OUTAGE_TTL_MIN_MS + jitter) };
  }
  if (status === 401 || status === 403 || msg.includes('unauthorized') || msg.includes('forbidden') || msg.includes('invalid api key')) {
    return { type: 'auth', ttlMs: Infinity };
  }
  if (status === 404 || msg.includes('not found') || msg.includes('model does not exist') || msg.includes('model_not_found')) {
    return { type: 'not_found', ttlMs: Infinity };
  }
  return { type: 'error', ttlMs: 0 };
}

// ── Worker status management ──────────────────────────────────────────────────

function setWorkerOnLeave(workerName, errClass, cache, dryRun = true) {
  const retryAfterIso = (errClass.ttlMs && errClass.ttlMs !== Infinity)
    ? new Date(nowMs() + errClass.ttlMs).toISOString()
    : null;

  const status =
    errClass.type === 'auth'      ? WSTATUS.ISOLATED  :
    errClass.type === 'not_found' ? WSTATUS.EXCLUDED   :
    WSTATUS.ON_LEAVE;

  const updated = {
    ...cache,
    workers: {
      ...cache.workers,
      [workerName]: {
        status,
        errorType:   errClass.type,
        since:       nowIso(),
        retryAfter:  retryAfterIso,
        lastSuccessAt: cache.workers?.[workerName]?.lastSuccessAt ?? null,
      },
    },
  };
  writeHealthCache(updated, dryRun);
  return updated;
}

function clearWorkerLeave(workerName, cache, dryRun = true) {
  const updated = {
    ...cache,
    workers: {
      ...cache.workers,
      [workerName]: {
        status: WSTATUS.AVAILABLE,
        errorType: null, since: null, retryAfter: null,
        lastSuccessAt: nowIso(),
      },
    },
  };
  writeHealthCache(updated, dryRun);
  return updated;
}

/**
 * retryAfter を過ぎた ON_LEAVE ワーカーを AVAILABLE に戻す（API呼び出しなし）。
 */
function tryAutoRecover(cache, dryRun = true) {
  const now = nowMs();
  let updated = { ...cache, workers: { ...cache.workers } };
  const recovered = [];

  for (const [wName, info] of Object.entries(cache.workers || {})) {
    if (info.status !== WSTATUS.ON_LEAVE) continue;
    if (!info.retryAfter) continue;
    if (new Date(info.retryAfter).getTime() > now) continue;
    updated.workers[wName] = { ...info, status: WSTATUS.AVAILABLE, errorType: null, since: null, retryAfter: null };
    recovered.push(wName);
  }

  if (recovered.length > 0) writeHealthCache(updated, dryRun);
  return { cache: updated, recovered };
}

function isWorkerAvailable(workerName, cache, sessionQualityFails = []) {
  if (sessionQualityFails.includes(workerName)) return false;
  const info = cache.workers?.[workerName];
  if (!info) return true;  // キャッシュになければ利用可能とみなす
  return info.status === WSTATUS.AVAILABLE;
}

function applyStartupPreflight(workerNames, config, cache, dryRun = true, out = console.log) {
  const envPresence = checkEnvPresence(config);
  if (dryRun) return { cache, envPresence, missingWorkers: [] };
  let updated = cache;
  const missingWorkers = [];

  for (const workerName of [...new Set(workerNames)]) {
    const worker = resolveWorker(workerName, config);
    const envKey = PROVIDER_ENV_KEYS[worker.provider || ''];
    if (!envKey || envPresence[worker.workerName] !== false) continue;
    missingWorkers.push(worker.workerName);
    updated = setWorkerOnLeave(worker.workerName, { type: 'auth', ttlMs: Infinity }, updated, dryRun);
    updated = emitNotification(
      `${worker.workerName}:missing_env`,
      `${worker.workerName} の必須環境変数 ${envKey} が未設定`,
      `${worker.workerName} を除外して次のワーカーで継続します`,
      `${envKey} を設定してください`,
      updated,
      dryRun,
      out
    );
  }

  return { cache: updated, envPresence, missingWorkers };
}

// ── Notification dedup ────────────────────────────────────────────────────────

function shouldNotify(key, cache) {
  const lastSent = cache.notifications?.[key];
  if (!lastSent) return true;
  return (nowMs() - new Date(lastSent).getTime()) > NOTIFICATION_COOLDOWN_MS;
}

function recordNotification(key, cache, dryRun = true) {
  const updated = {
    ...cache,
    notifications: { ...cache.notifications, [key]: nowIso() },
  };
  writeHealthCache(updated, dryRun);
  return updated;
}

/**
 * 構造化通知を生成する（原因・影響・操作1つ）。
 * 同一 key は NOTIFICATION_COOLDOWN_MS 内に 1 回だけ出力する。
 */
function emitNotification(key, cause, impact, action, cache, dryRun = true, out = console.log) {
  if (!shouldNotify(key, cache)) return cache;
  out(`\n  ${c('bgYellow', c('bold', ' ⚠ 通知 '))}`);
  out(`  ${c('bold', '原因')} : ${cause}`);
  out(`  ${c('bold', '影響')} : ${impact}`);
  out(`  ${c('bold', '操作')} : ${action}`);
  return recordNotification(key, cache, dryRun);
}

// ── Spend tracking ────────────────────────────────────────────────────────────

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
  if (!price) return { modelId, provider: 'unknown', totalUsd: 0 };
  const inputUsd  = (inputTokens  / 1_000_000) * price.input;
  const outputUsd = (outputTokens / 1_000_000) * price.output;
  return { modelId, provider: price.provider, inputUsd, outputUsd, totalUsd: inputUsd + outputUsd };
}

function estimateChainCost(difficulty, config) {
  const tokens  = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const chain   = (config?.chains || DEFAULT_CHAINS)[difficulty] || [];
  const entries = chain.map(w => {
    const modelId = resolveModelId(w, config || { workers: DEFAULT_WORKER_REGISTRY, migrationAliases: DEFAULT_MIGRATION_ALIASES });
    return { workerName: w, ...estimateCost(modelId, tokens.input, tokens.output) };
  });
  return {
    difficulty, tokens,
    cheapestUsd: Math.min(...entries.map(e => e.totalUsd)),
    maxUsd:      Math.max(...entries.map(e => e.totalUsd)),
    byWorker:    entries,
  };
}

// ── Budget check ──────────────────────────────────────────────────────────────

function checkBudget(estimatedUsd, config) {
  const spend     = readSpend();
  const budget    = config.monthlyBudgetUsd;
  const projected = spend.totalUsd + estimatedUsd;
  const blocked   = projected > budget;
  return {
    ok: !blocked, blocked,
    estimatedUsd, spentUsd: spend.totalUsd,
    projectedUsd: projected, budgetUsd: budget,
    remainingUsd: budget - spend.totalUsd,
    month: spend.month,
    reason: blocked
      ? `月間予算上限 $${budget.toFixed(2)} を超過 (使用済 $${spend.totalUsd.toFixed(4)} + 見積 $${estimatedUsd.toFixed(6)} = $${projected.toFixed(4)})`
      : null,
  };
}

// ── Chain resolver ────────────────────────────────────────────────────────────

/**
 * 難易度・ヘルスキャッシュ・成功履歴を総合してモデルの実行順を決定する。
 *
 * 優先順:
 *   1. 成功実績あり × avgCostUsd 昇順
 *   2. 未試行モデルはデフォルト順
 *   3. ON_LEAVE / ISOLATED / EXCLUDED / skipList は除外
 *   4. quality_fail はセッション内のみ除外（sessionQualityFails）
 */
function resolveChain(difficulty, config, cache, sessionSkipList = [], sessionQualityFails = []) {
  const base    = Array.isArray(config.chains?.[difficulty]) ? config.chains[difficulty] : (DEFAULT_CHAINS[difficulty] || []);
  const skipSet = new Set([...config.skipList, ...sessionSkipList]);
  const history = config.successHistory || {};

  const available = base.filter(workerName => {
    if (skipSet.has(workerName)) return false;
    const info = cache.workers?.[workerName];
    if (!info) return true;
    if ([WSTATUS.ISOLATED, WSTATUS.EXCLUDED].includes(info.status)) return false;
    if (info.status === WSTATUS.ON_LEAVE) return false;
    if (sessionQualityFails.includes(workerName)) return false;
    return true;
  });

  const withHistory    = [];
  const withoutHistory = [];

  for (const w of available) {
    const modelId = resolveModelId(w, config);
    const h       = history[w] || history[modelId];
    if (h && h.successCount > 0) {
      withHistory.push({ workerName: w, avgCostUsd: h.avgCostUsd ?? Infinity });
    } else {
      withoutHistory.push(w);
    }
  }

  withHistory.sort((a, b) => a.avgCostUsd - b.avgCostUsd);

  return [
    ...withHistory.map(x => x.workerName),
    ...withoutHistory,
  ];
}

// ── DeepSeek masking ─────────────────────────────────────────────────────────

function maskForDeepSeek(prompt) {
  let masked = prompt;
  let maskCount = 0;
  const patterns = [
    { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC )?PRIVATE KEY-----/g, token: '[MASKED:PRIVATE_KEY]' },
    { re: /ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{22,}/g, token: '[MASKED:GITHUB_CRED]' },
    { re: /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, token: '[MASKED:JWT]' },
    { re: /DEEPSEEK_API_KEY\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{8,})["']?/gi, token: '[MASKED:DEEPSEEK_KEY]' },
    { re: /(?:api[_\-]?key|apikey)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{16,})["']?/gi, token: '[MASKED:API_KEY]' },
    { re: /(?:bearer|auth[_\-]?token|access[_\-]?token)\s*[:=]\s*["']?([A-Za-z0-9\-_./+]{16,})["']?/gi, token: '[MASKED:TOKEN]' },
    { re: /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, token: '[MASKED:EMAIL]' },
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

async function callGemini(modelId, prompt, opts = {}) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY not set');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: opts.maxTokens ?? 2048 },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw buildApiError('Gemini', res, body);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '(no content)';
    const usage = data?.usageMetadata ?? {};
    return { response: text, inputTokens: usage.promptTokenCount ?? null, outputTokens: usage.candidatesTokenCount ?? null };
  } finally { clearTimeout(timer); }
}

async function callOpenAI(modelId, prompt, opts = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: prompt }], max_tokens: opts.maxTokens ?? 2048 }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw buildApiError('OpenAI', res, body);
    }
    const data = await res.json();
    return {
      response:     data?.choices?.[0]?.message?.content ?? '(no content)',
      inputTokens:  data?.usage?.prompt_tokens    ?? null,
      outputTokens: data?.usage?.completion_tokens ?? null,
    };
  } finally { clearTimeout(timer); }
}

async function callDeepSeek(modelId, prompt, opts = {}) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const { masked, maskCount } = maskForDeepSeek(prompt);
  if (maskCount > 0) process.stderr.write(`[cheap-first] DeepSeek マスク: ${maskCount} 箇所\n`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: masked }], max_tokens: opts.maxTokens ?? 2048 }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw buildApiError('DeepSeek', res, body);
    }
    const data = await res.json();
    return {
      response:       data?.choices?.[0]?.message?.content ?? '(no content)',
      inputTokens:    data?.usage?.prompt_tokens    ?? null,
      outputTokens:   data?.usage?.completion_tokens ?? null,
      deepseekMasked: true, maskCount,
    };
  } finally { clearTimeout(timer); }
}

async function callAnthropic(modelId, prompt, opts = {}) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelId, max_tokens: opts.maxTokens ?? 2048, messages: [{ role: 'user', content: prompt }] }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw buildApiError('Anthropic', res, body);
    }
    const data = await res.json();
    return {
      response:     data?.content?.[0]?.text ?? '(no content)',
      inputTokens:  data?.usage?.input_tokens  ?? null,
      outputTokens: data?.usage?.output_tokens ?? null,
    };
  } finally { clearTimeout(timer); }
}

async function callModel(workerOrModelId, prompt, config, opts = {}) {
  const worker = resolveWorker(workerOrModelId, config || { workers: DEFAULT_WORKER_REGISTRY, migrationAliases: DEFAULT_MIGRATION_ALIASES });
  const { modelId, provider, deepseekMasked } = worker;

  switch (provider) {
    case 'gemini':    return callGemini(modelId, prompt, opts);
    case 'deepseek':  return callDeepSeek(modelId, prompt, opts);
    case 'openai':    return callOpenAI(modelId, prompt, opts);
    case 'anthropic': return callAnthropic(modelId, prompt, opts);
    default: throw new Error(`No caller for provider: ${provider} (worker: ${workerOrModelId})`);
  }
}

// ── Quality check (rule-based) ────────────────────────────────────────────────

/**
 * レスポンスの品質をルールベースで確認する（追加API呼び出しなし）。
 * 品質不足の場合のみ並走フラグを立てる。
 */
function checkQuality(response, taskType = 'other') {
  if (!response || typeof response !== 'string') {
    return { ok: false, reason: 'empty_response' };
  }
  const text = response.trim();
  if (text.length < 10) {
    return { ok: false, reason: 'response_too_short' };
  }
  if (/^\[?(error|failed|エラー|失敗)/i.test(text)) {
    return { ok: false, reason: 'error_response' };
  }
  // コード系タスクは最低限の長さを要求
  if (['code', 'hp-lp', 'mobile-app', 'flutter', 'react-native', 'implement'].includes(taskType)) {
    if (text.length < 80) return { ok: false, reason: 'code_task_too_short' };
  }
  return { ok: true };
}

// ── Arbitration ───────────────────────────────────────────────────────────────

/**
 * 複数レスポンスから最良を選ぶ。
 * dryRun: 文字数で判断
 * live  : gpt_upper に裁定させる（失敗時は文字数フォールバック）
 */
async function arbitrateResponses(candidates, prompt, config, dryRun = true) {
  if (candidates.length === 1) {
    return { winner: candidates[0].workerName, response: candidates[0].response, method: 'single' };
  }

  // dryRun または 2体以下: 文字数で選択
  if (dryRun) {
    const best = candidates.reduce((a, b) => (a.response?.length ?? 0) >= (b.response?.length ?? 0) ? a : b);
    return { winner: best.workerName, response: best.response, method: 'length_dryrun' };
  }

  // live: gpt_upper に裁定させる
  const arbiter = 'gpt_upper';
  const choices  = candidates.map((c, i) => `回答${String.fromCharCode(65 + i)} (${c.workerName}):\n${c.response.slice(0, 400)}`).join('\n\n');
  const arbiterPrompt = `タスク: ${prompt.slice(0, 150)}\n\n${choices}\n\n最も良い回答の記号（A/B/...）とだけ答えてください。`;

  try {
    const result = await callModel(arbiter, arbiterPrompt, config, { maxTokens: 10 });
    const letter = result.response.trim().charAt(0).toUpperCase();
    const idx    = letter.charCodeAt(0) - 65;
    const chosen = candidates[idx] ?? candidates[0];
    return { winner: chosen.workerName, response: chosen.response, method: 'gpt_upper_arbiter', arbiter };
  } catch (_) {
    const best = candidates.reduce((a, b) => (a.response?.length ?? 0) >= (b.response?.length ?? 0) ? a : b);
    return { winner: best.workerName, response: best.response, method: 'length_fallback' };
  }
}

// ── Parallel execution (品質不足・不一致時のみ) ──────────────────────────────

async function runParallel(workerNames, prompt, config, difficulty, dryRun = true) {
  const tokens = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const tasks  = workerNames.map(async (w) => {
    const worker = resolveWorker(w, config);
    const start  = Date.now();
    if (dryRun) {
      const durationMs = Math.round(600 + Math.random() * 400);
      return { workerName: w, modelId: worker.modelId, success: true,
        response: `[DRY-RUN] ${worker.modelId} からの模擬レスポンス`,
        durationMs, costUsd: estimateCost(worker.modelId, tokens.input, tokens.output).totalUsd };
    }
    try {
      const r  = await callModel(w, prompt, config);
      const ms = Date.now() - start;
      const c  = estimateCost(worker.modelId, r.inputTokens ?? tokens.input, r.outputTokens ?? tokens.output);
      return { workerName: w, modelId: worker.modelId, success: true, response: r.response, durationMs: ms, costUsd: c.totalUsd };
    } catch (err) {
      return { workerName: w, modelId: worker.modelId, success: false, error: err.message, durationMs: Date.now() - start };
    }
  });
  return Promise.all(tasks);
}

// ── Human gate ────────────────────────────────────────────────────────────────

async function waitForHumanApproval(workerName, difficulty, opts = {}) {
  const { dryRun = true, out = console.log } = opts;
  out('\n' + c('bgRed', c('bold', '  ⛔ HUMAN GATE ⛔  ')));
  out(`\n  ${c('bold', '難易度 :')} ${c('red', difficulty)}  /  ${c('bold', '担当    :')} ${c('cyan', workerName)}`);
  out(`  ${c('bold', '理由   :')} high 難易度タスクは human_gate 必須`);
  if (dryRun) { out(`\n  ${c('yellow', '[DRY-RUN] 承認をスキップ（dryRun=true）')}`); return true; }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(`\n  ${c('bold', 'じゅんやさん、このタスクを承認しますか？')} (yes/no): `, answer => {
      rl.close();
      const ok = /^y(es)?$/i.test(answer.trim());
      out(ok ? `  ${c('green', '✓ 承認されました')}` : `  ${c('red', '✗ 拒否されました')}`);
      resolve(ok);
    });
  });
}

// ── Success history ───────────────────────────────────────────────────────────

function updateSuccessHistory(config, workerName, success, costUsd, durationMs) {
  const history = config.successHistory || {};
  const prev    = history[workerName] || { successCount: 0, failCount: 0, avgCostUsd: null, avgDurationMs: null };
  let newAvgCost = prev.avgCostUsd;
  let newAvgDur  = prev.avgDurationMs;
  if (success && costUsd != null) {
    const n = prev.successCount + 1;
    newAvgCost = prev.avgCostUsd == null ? costUsd : ((prev.avgCostUsd * prev.successCount) + costUsd) / n;
    newAvgDur  = prev.avgDurationMs == null || durationMs == null ? durationMs : ((prev.avgDurationMs * prev.successCount) + durationMs) / n;
  }
  return {
    ...config,
    successHistory: {
      ...history,
      [workerName]: {
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

function printCostTable(difficulty, chain, config, cache) {
  const tokens  = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const history = config.successHistory || {};
  console.log(`\n  ${c('bold', '推定コスト')} (${difficulty}, ~${tokens.input.toLocaleString()} in / ~${tokens.output.toLocaleString()} out tokens)`);
  console.log('  ' + hr(62));
  for (const [i, w] of chain.entries()) {
    const worker = resolveWorker(w, config);
    const est    = estimateCost(worker.modelId, tokens.input, tokens.output);
    const h      = history[w];
    const tag    = i === 0 ? c('green', '★ 優先') : c('dim', `  ${i + 1}番目`);
    const hist   = h ? c('dim', `成功${h.successCount}/失敗${h.failCount}`) : c('dim', '実績なし');
    const status = cache?.workers?.[w];
    const st     = status && status.status !== WSTATUS.AVAILABLE
      ? c('yellow', ` [${status.status}]`) : '';
    console.log(`  ${tag}  ${w.padEnd(22)} ${c('dim', worker.modelId.padEnd(24))} $${est.totalUsd.toFixed(6)}  ${hist}${st}`);
  }
  console.log('  ' + hr(62));
}

function printBudgetStatus(budgetCheck) {
  const pct = budgetCheck.budgetUsd > 0 ? Math.round((budgetCheck.spentUsd / budgetCheck.budgetUsd) * 100) : 0;
  const bar = '[' + '█'.repeat(Math.round(pct / 5)).padEnd(20, '░') + ']';
  const col = pct >= 90 ? 'red' : pct >= 70 ? 'yellow' : 'green';
  console.log(`\n  ${c('bold', '月間予算')}  $${budgetCheck.spentUsd.toFixed(4)} / $${budgetCheck.budgetUsd.toFixed(2)}  ${c(col, bar)} ${pct}%`);
  if (budgetCheck.blocked) console.log(`  ${c('red', '⛔ 予算上限に達しています — 実行を停止します')}`);
}

// ── Main orchestrator ─────────────────────────────────────────────────────────

/**
 * Cheap-First Runtime メイン関数。
 *
 * @param {string} prompt     実行プロンプト
 * @param {string} difficulty 'light' | 'medium' | 'high'
 * @param {object} opts
 *   dryRun         {boolean}  true=模擬実行（デフォルト）
 *   silent         {boolean}  コンソール出力を抑制
 *   skipHumanGate  {boolean}  human_gate 表示を呼び出し元が管理する場合
 *   taskInput      {string}   Learning Log 用タスク説明
 *   taskType       {string}   'code'|'hp-lp'|'mobile-app'|'review'|'text'|'other'
 */
async function cheapFirstRun(prompt, difficulty, opts = {}) {
  const {
    dryRun        = true,
    silent        = false,
    skipHumanGate = false,
    taskInput     = prompt.slice(0, 120),
    taskType      = 'other',
    project       = null,   // プロジェクト識別子 (DeepSeekガード用)
  } = opts;

  const out    = silent ? () => {} : console.log;
  const isHigh = difficulty === 'high';

  out('\n' + c('bold', c('blue', '⬡ KOSAME AI組織OS — Cheap-First Runtime')) + `  v${TOOL_META.version}`);
  out(`  難易度: ${c(isHigh ? 'red' : difficulty === 'medium' ? 'yellow' : 'green', difficulty)}  taskType: ${taskType}  dryRun: ${dryRun}`);
  out('  ' + hr());

  // ── 起動時チェック（API呼び出しなし） ────────────────────────────────────
  let config = readConfig();
  let cache  = readHealthCache();

  // retryAfter を過ぎた ON_LEAVE ワーカーを自動復帰
  const { cache: recoveredCache, recovered } = tryAutoRecover(cache, dryRun);
  cache = recoveredCache;
  if (recovered.length > 0 && !silent) {
    out(`  ${c('green', '↩ 自動復帰')}: ${recovered.join(', ')}`);
  }

  const requestedChain = Array.isArray(config.chains?.[difficulty]) ? config.chains[difficulty] : (DEFAULT_CHAINS[difficulty] || []);
  const preflight = applyStartupPreflight(requestedChain, config, cache, dryRun, out);
  cache = preflight.cache;
  if (preflight.missingWorkers.length > 0 && !silent) {
    out(`  ${c('yellow', '↷ 起動時除外')}: ${preflight.missingWorkers.join(', ')}`);
  }

  const sessionSkipList    = [];
  const sessionQualityFails = [];

  // ── チェーン解決 ──────────────────────────────────────────────────────────
  const chain = resolveChain(difficulty, config, cache, sessionSkipList, sessionQualityFails);
  if (chain.length === 0) {
    return {
      tool: TOOL_META.slug, version: TOOL_META.version, ok: false, dryRun,
      error: `利用可能なワーカーがありません (difficulty=${difficulty})`,
    };
  }

  // ── 推定コスト表示 ────────────────────────────────────────────────────────
  if (!silent) printCostTable(difficulty, chain, config, cache);

  // ── 予算チェック ──────────────────────────────────────────────────────────
  const tokens      = TYPICAL_TOKENS[difficulty] || TYPICAL_TOKENS.medium;
  const firstWorker = resolveWorker(chain[0], config);
  const firstEst    = estimateCost(firstWorker.modelId, tokens.input, tokens.output);
  const budgetCheck = checkBudget(firstEst.totalUsd, config);
  if (!silent) printBudgetStatus(budgetCheck);
  if (budgetCheck.blocked) {
    return {
      tool: TOOL_META.slug, version: TOOL_META.version, ok: false, dryRun, blocked: true,
      reason: budgetCheck.reason, spentUsd: budgetCheck.spentUsd, budgetUsd: budgetCheck.budgetUsd,
    };
  }

  // ── メインループ（直列Cheap-First） ──────────────────────────────────────
  const attempts = [];

  for (const workerName of chain) {
    const worker  = resolveWorker(workerName, config);
    const modelId = worker.modelId;
    out(`\n  ${c('cyan', '→')} [${workerName}] ${c('dim', modelId)} を試行...`);
    const startMs = Date.now();

    // DeepSeek プロジェクトガード
    if (worker.provider === 'deepseek') {
      let guard = { blocked: false };
      try {
        const { checkDeepSeekGuard } = require('./kosame-deepseek-project-guard');
        guard = checkDeepSeekGuard({ project, provider: 'deepseek', prompt, config });
      } catch (_) {}
      if (guard.blocked) {
        out(`     ${c('red', '⛔ DeepSeek ブロック')} [${guard.reason}]`);
        out(`     ${c('yellow', '↷')} ${guard.fallback ?? 'next worker'} へ自動切替`);
        attempts.push({ workerName, modelId, success: false, dryRun, blocked: true, reason: guard.reason, fallback: guard.fallback });
        sessionSkipList.push(workerName);
        continue;
      }
    }

    // DRY-RUN
    if (dryRun) {
      const durationMs     = Math.round(800 + Math.random() * 400);
      const costEst        = estimateCost(modelId, tokens.input, tokens.output);
      const deepseekMasked = DEEPSEEK_MODELS.has(modelId);
      out(`     ${c('yellow', '[DRY-RUN]')} 模擬成功 (${durationMs}ms, 推定 $${costEst.totalUsd.toFixed(6)})${deepseekMasked ? ' [masked]' : ''}`);

      const attempt = { workerName, modelId, success: true, dryRun: true, durationMs, costUsd: costEst.totalUsd, deepseekMasked, response: `[DRY-RUN] ${modelId} からの模擬レスポンス` };
      attempts.push(attempt);

      config = updateSuccessHistory(config, workerName, true, costEst.totalUsd, durationMs);
      writeConfig(config, true);
      recordToLearningLog({ taskInput, taskType, difficulty, model: modelId, provider: worker.provider, costUsd: costEst.totalUsd, durationMs, success: true, escalated: false, dryRun: true, meta: { runtime: TOOL_META.slug, workerName } }, true);

      return { tool: TOOL_META.slug, version: TOOL_META.version, ok: true, dryRun: true, usedWorker: workerName, usedModel: modelId, attempts, response: attempt.response, realProductActionsExecuted: false };
    }

    // LIVE
    try {
      const result     = await callModel(workerName, prompt, config);
      const durationMs = Date.now() - startMs;
      const inTok      = result.inputTokens  ?? tokens.input;
      const outTok     = result.outputTokens ?? tokens.output;
      const costEst    = estimateCost(modelId, inTok, outTok);

      out(`     ${c('green', '✓')} 成功 (${durationMs}ms, $${costEst.totalUsd.toFixed(6)})`);

      // 品質チェック（ルールベース）
      const quality = checkQuality(result.response, taskType);
      if (!quality.ok) {
        out(`     ${c('yellow', '⚠ 品質不足')} [${quality.reason}] — バックアップと並走します`);
        sessionQualityFails.push(workerName);

        // バックアップを取得して並走
        const backupChain = resolveChain(difficulty, config, cache, sessionSkipList, sessionQualityFails);
        if (backupChain.length > 0) {
          const parallelResults = await runParallel([workerName, backupChain[0]], prompt, config, difficulty, false);
          const validResults    = parallelResults.filter(r => r.success && checkQuality(r.response, taskType).ok);

          if (validResults.length > 0) {
            const arbitration = await arbitrateResponses(validResults, prompt, config, false);
            const bestResult  = validResults.find(r => r.workerName === arbitration.winner) || validResults[0];

            recordSpend(bestResult.costUsd ?? 0, false);
            config = updateSuccessHistory(config, bestResult.workerName, true, bestResult.costUsd, bestResult.durationMs);
            writeConfig(config, false);
            recordToLearningLog({ taskInput, taskType, difficulty, model: resolveModelId(bestResult.workerName, config), provider: resolveWorker(bestResult.workerName, config).provider, costUsd: bestResult.costUsd, durationMs: bestResult.durationMs, success: true, escalated: true, dryRun: false, meta: { runtime: TOOL_META.slug, arbitration: arbitration.method, workerName: bestResult.workerName } }, false);
            return { tool: TOOL_META.slug, version: TOOL_META.version, ok: true, dryRun: false, usedWorker: bestResult.workerName, usedModel: resolveModelId(bestResult.workerName, config), attempts: [...attempts, ...parallelResults], response: bestResult.response, costUsd: bestResult.costUsd, durationMs: bestResult.durationMs, parallelRun: true, arbitration, realProductActionsExecuted: true };
          }
        }
        // バックアップもなければ品質不足でもそのまま返す
        attempts.push({ workerName, modelId, success: true, qualityFail: true, dryRun: false, durationMs, costUsd: costEst.totalUsd });
        recordSpend(costEst.totalUsd, false);
      } else {
        attempts.push({ workerName, modelId, success: true, dryRun: false, durationMs, costUsd: costEst.totalUsd, inputTokens: inTok, outputTokens: outTok, deepseekMasked: result.deepseekMasked ?? false });
        recordSpend(costEst.totalUsd, false);
      }

      // キャッシュに成功を記録
      cache = clearWorkerLeave(workerName, cache, false);
      config = updateSuccessHistory(config, workerName, true, costEst.totalUsd, durationMs);
      writeConfig(config, false);
      recordToLearningLog({ taskInput, taskType, difficulty, model: modelId, provider: worker.provider, costUsd: costEst.totalUsd, durationMs, success: true, escalated: attempts.length > 1, dryRun: false, meta: { runtime: TOOL_META.slug, workerName } }, false);

      return { tool: TOOL_META.slug, version: TOOL_META.version, ok: true, dryRun: false, usedWorker: workerName, usedModel: modelId, attempts, response: result.response, costUsd: costEst.totalUsd, durationMs, realProductActionsExecuted: true };

    } catch (err) {
      const durationMs = Date.now() - startMs;
      const errClass   = classifyApiError(err);

      out(`     ${c('red', '✗')} 失敗 [${errClass.type}]: ${err.message.slice(0, 100)}`);
      attempts.push({ workerName, modelId, success: false, dryRun: false, durationMs, error: err.message.slice(0, 200), errorType: errClass.type });

      // エラー種別に応じてステータス更新
      if (['rate_limit', 'outage', 'auth', 'not_found'].includes(errClass.type)) {
        cache = setWorkerOnLeave(workerName, errClass, cache, false);

        // 通知 dedup
        const notifKey = `${workerName}:${errClass.type}`;
        const retryStr = errClass.ttlMs && errClass.ttlMs !== Infinity
          ? `約${Math.round(errClass.ttlMs / 60_000)}分後に自動復帰予定`
          : '手動対応が必要です';
        const actionMap = {
          rate_limit: `次のワーカーで継続中。${retryStr}`,
          outage:     `次のワーカーで継続中。${retryStr}`,
          auth:       `${workerName} の API キーを確認してください`,
          not_found:  `${workerName} の model ID を provider-config.json で確認してください`,
        };
        cache = emitNotification(
          notifKey,
          `${workerName} が ${errClass.type} (${err.message.slice(0, 60)})`,
          `${workerName} が一時的に利用不可`,
          actionMap[errClass.type] ?? '次のワーカーで継続中',
          cache, false, out
        );
      } else {
        // 一時スキップ（セッション内のみ）
        sessionSkipList.push(workerName);
      }

      config = updateSuccessHistory(config, workerName, false, null, durationMs);
      writeConfig(config, false);
      recordToLearningLog({ taskInput, taskType, difficulty, model: modelId, provider: worker.provider, costUsd: null, durationMs, success: false, escalated: attempts.length > 1, dryRun: false, meta: { runtime: TOOL_META.slug, errorType: errClass.type } }, false);

      out(`     ${c('yellow', '↷')} 次のワーカーへ`);
    }
  }

  // ── 全ワーカー失敗 → human_gate（単一プロバイダー障害では要求しない） ───────
  const uniqueProviders = new Set(attempts.map(a => resolveWorker(a.workerName ?? a.modelId ?? '', config).provider));
  const allFailed       = attempts.every(a => !a.success);

  out(`\n  ${c('red', '⛔ すべてのワーカーが失敗しました')}`);

  const humanGateRequired = allFailed && uniqueProviders.size > 1;
  if (humanGateRequired && !skipHumanGate) {
    // 複数プロバイダー障害 → human_gate
    out(`  ${c('bgRed', c('bold', ' 全プロバイダー失敗 — じゅんやさんの対応が必要です '))}`);
    out(`  原因: ${[...uniqueProviders].join(', ')} が全て応答しない`);
    out(`  操作: provider-config.json / API キーを確認してください`);
  }

  return {
    tool: TOOL_META.slug, version: TOOL_META.version,
    ok: false, dryRun: false,
    error: 'all workers failed',
    blocked: humanGateRequired,
    humanGateRequired,
    attempts,
    realProductActionsExecuted: false,
  };
}

// ── Config / status display ───────────────────────────────────────────────────

function showConfig() {
  const config = readConfig();
  const cache  = readHealthCache();
  const spend  = readSpend();

  console.log('\n' + c('bold', c('blue', '⬡ KOSAME AI組織OS — 設定状態')) + `  v${TOOL_META.version}`);
  console.log('  ' + hr());
  console.log(`  設定ファイル  : ${c('cyan', PROVIDER_CONFIG_FILE)}`);
  console.log(`  月間予算上限  : ${c('bold', '$' + config.monthlyBudgetUsd.toFixed(2))}`);
  console.log(`  今月の使用額  : ${c('yellow', '$' + spend.totalUsd.toFixed(4))} / $${config.monthlyBudgetUsd.toFixed(2)}  (${spend.month})`);

  console.log('\n  ワーカー一覧:');
  const envPresence = checkEnvPresence(config);
  for (const [wName, wDef] of Object.entries(config.workers)) {
    const status = cache.workers?.[wName];
    const st     = status ? status.status : WSTATUS.AVAILABLE;
    const stCol  = st === WSTATUS.AVAILABLE ? 'green' : st === WSTATUS.ON_LEAVE ? 'yellow' : 'red';
    const retry  = status?.retryAfter ? ` (復帰: ${status.retryAfter.slice(11, 16)} UTC)` : '';
    const envOk  = envPresence[wName] ? c('green', '✓') : c('red', '✗ ENV');
    console.log(`    ${envOk}  ${wName.padEnd(22)} ${c('dim', wDef.modelId.padEnd(26))} ${c(stCol, st)}${retry}`);
  }

  console.log('\n  チェーン:');
  for (const diff of ['light', 'medium', 'high']) {
    const chain = config.chains[diff] || [];
    console.log(`    ${diff.padEnd(6)}: ${chain.join(' → ')}`);
  }

  const history = config.successHistory || {};
  const models  = Object.keys(history);
  if (models.length > 0) {
    console.log('\n  成功履歴:');
    for (const m of models) {
      const h   = history[m];
      const avg = h.avgCostUsd != null ? `avg $${h.avgCostUsd.toFixed(6)}` : '      コストなし';
      const dur = h.avgDurationMs != null ? `${Math.round(h.avgDurationMs)}ms` : 'n/a';
      console.log(`    ${m.padEnd(24)} 成功${String(h.successCount).padStart(3)}/失敗${String(h.failCount).padStart(3)}  ${avg}  ${dur}`);
    }
  }
  console.log('');
}

// ── Interactive config ────────────────────────────────────────────────────────

async function interactiveConfig(dryRun = true) {
  const config = readConfig();
  const rl     = readline.createInterface({ input: process.stdin, output: process.stdout });
  const q      = (p) => new Promise(resolve => rl.question(p, resolve));

  console.log('\n' + c('bold', '⬡ KOSAME Cheap-First Runtime — 設定変更'));
  console.log(`  現在の月間予算: $${config.monthlyBudgetUsd.toFixed(2)}`);

  const budgetStr = await q(`  新しい月間予算 (USD) [Enter でスキップ]: `);
  const skipStr   = await q(`  スキップリスト (worker名カンマ区切り, 空でリセット) [Enter でスキップ]: `);
  rl.close();

  let updated = { ...config };

  if (budgetStr.trim()) {
    const v = parseFloat(budgetStr.trim());
    if (!isNaN(v) && v > 0) { updated.monthlyBudgetUsd = v; console.log(`  月間予算: $${v.toFixed(2)} に更新`); }
    else console.log(c('red', '  無効な値のためスキップ'));
  }

  if (skipStr.trim() !== '') {
    updated.skipList = skipStr.split(',').map(s => s.trim()).filter(Boolean);
    console.log(`  スキップリスト: ${updated.skipList.join(', ')}`);
  }

  const result = writeConfig(updated, dryRun);
  console.log(dryRun ? c('yellow', '\n  [DRY-RUN] 設定は保存されませんでした') : c('green', '\n  ✓ 設定を保存しました'));
  return result;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const get = (name) => { const p = `--${name}=`; const a = argv.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  const has = (name) => argv.includes(`--${name}`);
  return {
    difficulty:  get('difficulty') || 'light',
    prompt:      get('prompt') || '',
    dryRun:      !has('write'),
    configMode:  has('config'),
    showMode:    has('show'),
    jsonMode:    has('json'),
    silent:      has('silent'),
    taskInput:   get('task-input') || null,
    taskType:    get('task-type') || 'other',
    project:     get('project') || null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.showMode)   { showConfig(); return; }
  if (args.configMode) { await interactiveConfig(args.dryRun); return; }

  if (!args.prompt) {
    console.log(`\n${c('bold', 'Usage:')}
  node tools/kosame-cheap-first-runtime.js --difficulty=<light|medium|high> --prompt="..."
  node tools/kosame-cheap-first-runtime.js --difficulty=medium --prompt="..." --write
  node tools/kosame-cheap-first-runtime.js --show
  node tools/kosame-cheap-first-runtime.js --config [--write]

Flags:
  --write        dryRun を無効化（実際のAPI呼び出し）
  --json         JSON 出力
  --silent       コンソール出力を抑制
  --task-type    タスク種別: code|hp-lp|mobile-app|flutter|react-native|review|text|other
  --task-input   Learning Log 用タスク説明
`);
    return;
  }

  const result = await cheapFirstRun(args.prompt, args.difficulty, {
    dryRun:    args.dryRun,
    silent:    args.silent,
    taskInput: args.taskInput ?? args.prompt.slice(0, 120),
    taskType:  args.taskType,
    project:   args.project,
  });

  if (args.jsonMode) { console.log(JSON.stringify(result, null, 2)); return; }

  if (!args.silent) {
    console.log('\n  ' + hr());
    if (result.ok) {
      console.log(`  ${c('green', '✓')} 完了  ワーカー: ${c('cyan', result.usedWorker)} (${result.usedModel})`);
      if (result.costUsd != null) console.log(`  コスト: $${result.costUsd.toFixed(6)}  時間: ${result.durationMs}ms`);
      if (result.parallelRun) console.log(`  ${c('yellow', '⚡ 並走あり')} 裁定: ${result.arbitration?.method}`);
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
  DEFAULT_WORKER_REGISTRY,
  DEFAULT_CHAINS,
  DEFAULT_MIGRATION_ALIASES,
  PROVIDER_ENV_KEYS,
  PRICE_TABLE,
  TYPICAL_TOKENS,
  DEEPSEEK_MODELS,
  WSTATUS,
  PROVIDER_CONFIG_FILE,
  HEALTH_CACHE_FILE,
  readConfig,
  writeConfig,
  readHealthCache,
  writeHealthCache,
  checkEnvPresence,
  applyStartupPreflight,
  resolveWorker,
  resolveModelId,
  classifyApiError,
  setWorkerOnLeave,
  clearWorkerLeave,
  tryAutoRecover,
  emitNotification,
  shouldNotify,
  readSpend,
  recordSpend,
  estimateCost,
  estimateChainCost,
  checkBudget,
  resolveChain,
  maskForDeepSeek,
  checkQuality,
  arbitrateResponses,
  runParallel,
  updateSuccessHistory,
  waitForHumanApproval,
  cheapFirstRun,
  callModel,
  callOpenAI,
  callAnthropic,
};
