#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const PACKAGE = require('../package.json');
const {
  getTaskVaultPaths,
  resolveTaskVaultDir,
  ensureTaskVaultLayout,
  sanitizeRecord,
} = require('./kosame-task-vault');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'provider-pricing-estimates.json');
const JST_OFFSET_MINUTES = 9 * 60;

function readJson(filePath, fallback = null) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function appendJsonl(filePath, value) {
  fs.appendFileSync(filePath, `${JSON.stringify(value)}\n`, 'utf8');
}

function toMillis(value) {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function toJstDate(value) {
  const ms = toMillis(value);
  if (ms == null) return null;
  return new Date(ms + (JST_OFFSET_MINUTES * 60 * 1000));
}

function formatJstDay(value) {
  const date = toJstDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatJstMonth(value) {
  const date = toJstDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function loadPricingConfig(configPath = DEFAULT_CONFIG_PATH) {
  const raw = readJson(configPath, null);
  const fallback = {
    usdToJpy: 150,
    budgets: {
      sessionBudgetUsd: 4,
      dailyBudgetUsd: 20,
      monthlyBudgetUsd: 80,
      highCostModelHumanGate: true,
      warningThresholdPercent: 75,
    },
    providerLabels: {
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Gemini',
      grok: 'Grok',
      deepseek: 'DeepSeek',
      llama: 'Llama/Meta',
      meta: 'Llama/Meta',
      unknown: 'unknown',
    },
    modelPricing: [],
    highCostModels: ['^gpt-5\\.5', '^claude-opus', '^gemini-2\\.5-pro', '^grok-4', '^deepseek-r1', '^llama-3\\.1-405b'],
  };
  if (!raw) return fallback;
  return {
    ...fallback,
    ...raw,
    budgets: {
      ...fallback.budgets,
      ...(raw.budgets || {}),
    },
    providerLabels: {
      ...fallback.providerLabels,
      ...(raw.providerLabels || {}),
    },
    modelPricing: Array.isArray(raw.modelPricing) ? raw.modelPricing : fallback.modelPricing,
    highCostModels: Array.isArray(raw.highCostModels) ? raw.highCostModels : fallback.highCostModels,
  };
}

function ensureCostLedgerLayout(taskVaultDir = resolveTaskVaultDir()) {
  const paths = ensureTaskVaultLayout(taskVaultDir);
  return {
    ...paths,
    costLedgerJsonl: paths.costLedgerJsonl || getTaskVaultPaths(taskVaultDir).costLedgerJsonl,
    costSummaryJson: paths.costSummaryJson || getTaskVaultPaths(taskVaultDir).costSummaryJson,
  };
}

function inferProvider(model = '', providerHint = '') {
  const value = `${providerHint || ''} ${model || ''}`.toLowerCase();
  if (/openai|gpt-|o\d|o\d-|chatgpt/.test(value)) return 'openai';
  if (/anthropic|claude/.test(value)) return 'anthropic';
  if (/gemini|vertex/.test(value)) return 'gemini';
  if (/grok/.test(value)) return 'grok';
  if (/deepseek/.test(value)) return 'deepseek';
  if (/llama|meta/.test(value)) return 'llama';
  return 'unknown';
}

function inferBudgetTier(model = '', provider = 'unknown', pricing = null) {
  const lowered = String(model || '').toLowerCase();
  for (const entry of Array.isArray(pricing) ? pricing : []) {
    const regex = entry?.pattern ? new RegExp(entry.pattern, 'i') : null;
    if (regex && regex.test(model)) return entry.budgetTier || 'medium';
  }
  if (/gpt-5\.5|claude-opus|gemini-2\.5-pro|grok-4|deepseek-r1|llama-3\.1-405b/.test(lowered)) return 'approval_required';
  if (/mini|flash|haiku|small|nano/.test(lowered)) return provider === 'openai' ? 'ultra_low' : 'low';
  if (/gpt-4o|claude-sonnet|gemini-2\.5-pro|grok-3|deepseek-chat/.test(lowered)) return 'medium';
  return provider === 'unknown' ? 'unknown' : 'low';
}

function pickPriceEntry(model, config) {
  for (const entry of config.modelPricing || []) {
    if (!entry?.pattern) continue;
    try {
      if (new RegExp(entry.pattern, 'i').test(model)) return entry;
    } catch {
      // ignore invalid pattern in config
    }
  }
  return null;
}

function normalizeUsage(entry = {}) {
  const inputTokens = Number.isFinite(Number(entry.inputTokens)) ? Number(entry.inputTokens) : null;
  const outputTokens = Number.isFinite(Number(entry.outputTokens)) ? Number(entry.outputTokens) : null;
  const totalTokens = Number.isFinite(Number(entry.totalTokens))
    ? Number(entry.totalTokens)
    : (inputTokens != null && outputTokens != null ? inputTokens + outputTokens : null);
  return { inputTokens, outputTokens, totalTokens };
}

function estimateRecordCost(entry, config) {
  const model = String(entry.model || '').trim() || 'unknown';
  const provider = inferProvider(model, entry.provider);
  const usage = normalizeUsage(entry);
  const price = pickPriceEntry(model, config);
  const usageKnown = usage.inputTokens != null && usage.outputTokens != null;
  const hasKnownPricing = Boolean(price);
  const savedBudgetTier = entry.budgetTier && entry.budgetTier !== 'unknown' ? entry.budgetTier : null;
  const budgetTier = savedBudgetTier || (price && price.budgetTier) || inferBudgetTier(model, provider, config.modelPricing);
  const warning = [];

  if (!usageKnown) warning.push('usage_unknown');
  if (!hasKnownPricing) warning.push('pricing_unknown');
  if ((config.highCostModels || []).some((pattern) => {
    try {
      return new RegExp(pattern, 'i').test(model);
    } catch {
      return false;
    }
  })) warning.push('high_cost_model');

  let estimatedCostUsd = null;
  if (usageKnown && hasKnownPricing) {
    const inputUsd = (usage.inputTokens / 1_000_000) * Number(price.inputUsdPer1M || 0);
    const outputUsd = (usage.outputTokens / 1_000_000) * Number(price.outputUsdPer1M || 0);
    estimatedCostUsd = Number((inputUsd + outputUsd).toFixed(6));
  }

  const estimatedCostJpy = estimatedCostUsd == null
    ? null
    : Number((estimatedCostUsd * Number(config.usdToJpy || 150)).toFixed(2));

  return {
    model,
    provider,
    usageKnown,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd,
    estimatedCostJpy,
    budgetTier,
    warning: warning.length > 0,
    warnings: warning,
    priceEntry: price ? {
      provider: price.provider || provider,
      budgetTier: price.budgetTier || budgetTier,
      inputUsdPer1M: price.inputUsdPer1M ?? null,
      outputUsdPer1M: price.outputUsdPer1M ?? null,
    } : null,
  };
}

function appendCostLedgerRecord(taskVaultDir, entry = {}) {
  const paths = ensureCostLedgerLayout(taskVaultDir);
  const now = new Date().toISOString();
  const sanitized = sanitizeRecord(entry);
  const usage = normalizeUsage(sanitized.value || {});
  const record = {
    version: PACKAGE.version,
    recordType: 'api_cost',
    recordedAt: sanitized.value.recordedAt || now,
    model: sanitized.value.model || 'unknown',
    provider: sanitized.value.provider || inferProvider(sanitized.value.model, sanitized.value.provider),
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    totalTokens: usage.totalTokens,
    estimatedCostUsd: sanitized.value.estimatedCostUsd ?? null,
    estimatedCostJpy: sanitized.value.estimatedCostJpy ?? null,
    budgetTier: sanitized.value.budgetTier || 'unknown',
    usageKnown: sanitized.value.usageKnown !== false && usage.inputTokens != null && usage.outputTokens != null,
    warning: sanitized.value.warning === true || (Array.isArray(sanitized.value.warnings) && sanitized.value.warnings.length > 0),
    warnings: Array.isArray(sanitized.value.warnings) ? sanitized.value.warnings : [],
    safetyWarnings: sanitized.warnings.map(w => `redacted ${w.path || 'value'} (${w.categories.join(', ')})`),
    meta: sanitized.value.meta || null,
  };
  appendJsonl(paths.costLedgerJsonl, record);
  return { path: paths.costLedgerJsonl, record };
}

function loadCostLedgerEntries(taskVaultDir) {
  const paths = getTaskVaultPaths(taskVaultDir);
  if (!fs.existsSync(paths.costLedgerJsonl)) return [];
  return fs.readFileSync(paths.costLedgerJsonl, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function saveCostSummary(taskVaultDir, summary) {
  const paths = ensureCostLedgerLayout(taskVaultDir);
  writeJson(paths.costSummaryJson, summary);
  return { path: paths.costSummaryJson, summary };
}

function emptyBucket(provider) {
  return {
    provider,
    callCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostJpy: 0,
    lastUsedAt: null,
    warningCount: 0,
  };
}

function toProviderLabel(provider, config) {
  return config.providerLabels?.[provider] || provider || 'unknown';
}

function bucketEntry(bucket, record, config) {
  bucket.callCount += 1;
  bucket.inputTokens += record.inputTokens || 0;
  bucket.outputTokens += record.outputTokens || 0;
  bucket.totalTokens += record.totalTokens || 0;
  bucket.estimatedCostUsd += record.estimatedCostUsd || 0;
  bucket.estimatedCostJpy += record.estimatedCostJpy || 0;
  bucket.lastUsedAt = !bucket.lastUsedAt || (record.recordedAt && record.recordedAt > bucket.lastUsedAt)
    ? record.recordedAt
    : bucket.lastUsedAt;
  bucket.warningCount += record.warning ? 1 : 0;
  bucket.provider = toProviderLabel(bucket.provider, config);
  return bucket;
}

function aggregateCostLedger(taskVaultDir, options = {}) {
  const config = loadPricingConfig(options.configPath || DEFAULT_CONFIG_PATH);
  const entries = loadCostLedgerEntries(taskVaultDir);
  const now = options.now || new Date().toISOString();
  const todayKey = formatJstDay(now);
  const monthKey = formatJstMonth(now);

  const totals = {
    sessionUsd: 0,
    sessionJpy: 0,
    todayUsd: 0,
    todayJpy: 0,
    monthUsd: 0,
    monthJpy: 0,
    unknownCount: 0,
    unknownUsageCount: 0,
    entryCount: entries.length,
    note: '概算であり実請求額ではありません。',
  };
  const providerMap = new Map();
  const modelMap = new Map();
  const warnings = [];
  const unknownRecords = [];

  for (const raw of entries) {
    const record = estimateRecordCost(raw, config);
    const dayKey = formatJstDay(record.recordedAt || raw.recordedAt || now);
    const recordMonth = formatJstMonth(record.recordedAt || raw.recordedAt || now);

    if (!record.usageKnown || record.estimatedCostUsd == null) {
      totals.unknownCount += 1;
      totals.unknownUsageCount += 1;
      unknownRecords.push(record);
    }

    if (record.estimatedCostUsd != null) {
      totals.sessionUsd += record.estimatedCostUsd;
      totals.sessionJpy += record.estimatedCostJpy || 0;
      if (dayKey === todayKey) {
        totals.todayUsd += record.estimatedCostUsd;
        totals.todayJpy += record.estimatedCostJpy || 0;
      }
      if (recordMonth === monthKey) {
        totals.monthUsd += record.estimatedCostUsd;
        totals.monthJpy += record.estimatedCostJpy || 0;
      }
    }

    const providerLabel = toProviderLabel(record.provider, config);
    if (!providerMap.has(providerLabel)) providerMap.set(providerLabel, emptyBucket(providerLabel));
    bucketEntry(providerMap.get(providerLabel), { ...record, recordedAt: raw.recordedAt || record.recordedAt || now }, config);

    const modelKey = `${record.model}@@${providerLabel}`;
    if (!modelMap.has(modelKey)) {
      modelMap.set(modelKey, {
        model: record.model,
        provider: providerLabel,
        callCount: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        estimatedCostJpy: 0,
        lastUsedAt: null,
        budgetTier: record.budgetTier || 'unknown',
        warning: false,
        warningCount: 0,
      });
    }
    const modelBucket = modelMap.get(modelKey);
    modelBucket.callCount += 1;
    modelBucket.inputTokens += record.inputTokens || 0;
    modelBucket.outputTokens += record.outputTokens || 0;
    modelBucket.totalTokens += record.totalTokens || 0;
    modelBucket.estimatedCostUsd += record.estimatedCostUsd || 0;
    modelBucket.estimatedCostJpy += record.estimatedCostJpy || 0;
    modelBucket.lastUsedAt = !modelBucket.lastUsedAt || (raw.recordedAt && raw.recordedAt > modelBucket.lastUsedAt)
      ? raw.recordedAt
      : modelBucket.lastUsedAt;
    modelBucket.budgetTier = record.budgetTier || modelBucket.budgetTier;
    modelBucket.warning = modelBucket.warning || record.warning;
    modelBucket.warningCount += record.warning ? 1 : 0;
  }

  const byProvider = {};
  for (const bucket of [...providerMap.values()].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)) {
    byProvider[bucket.provider] = bucket;
  }
  const byModel = [...modelMap.values()].sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd);

  const sessionBudgetUsd = Number(config.budgets?.sessionBudgetUsd || 0);
  const dailyBudgetUsd = Number(config.budgets?.dailyBudgetUsd || 0);
  const monthlyBudgetUsd = Number(config.budgets?.monthlyBudgetUsd || 0);
  const warningThresholdPercent = Number(config.budgets?.warningThresholdPercent || 0);
  const warningThresholdRatio = warningThresholdPercent / 100;
  const unknownRatio = entries.length > 0 ? totals.unknownCount / entries.length : 0;

  const sessionBudgetOver = sessionBudgetUsd > 0 && totals.sessionUsd > sessionBudgetUsd;
  const dailyBudgetOver = dailyBudgetUsd > 0 && totals.todayUsd > dailyBudgetUsd;
  const monthlyBudgetOver = monthlyBudgetUsd > 0 && totals.monthUsd > monthlyBudgetUsd;
  const sessionWarning = sessionBudgetUsd > 0 && totals.sessionUsd >= (sessionBudgetUsd * warningThresholdRatio);
  const dailyWarning = dailyBudgetUsd > 0 && totals.todayUsd >= (dailyBudgetUsd * warningThresholdRatio);
  const monthlyWarning = monthlyBudgetUsd > 0 && totals.monthUsd >= (monthlyBudgetUsd * warningThresholdRatio);
  const highCostModelWarning = byModel.some(item => item.budgetTier === 'approval_required');
  const unknownUsageWarning = totals.unknownCount > 0 && unknownRatio >= 0.2;

  if (highCostModelWarning) warnings.push('高額モデル利用があります。明示承認が必要です。');
  if (unknownUsageWarning) warnings.push(`unknown usage が多めです (${totals.unknownCount}/${entries.length || 1})。`);
  if (sessionBudgetOver) warnings.push('sessionBudget を超過しました。');
  if (dailyBudgetOver) warnings.push('dailyBudget を超過しました。');
  if (monthlyBudgetOver) warnings.push('monthlyBudget を超過しました。');
  if (sessionWarning && !sessionBudgetOver) warnings.push('sessionBudget が警告しきい値に近づいています。');
  if (dailyWarning && !dailyBudgetOver) warnings.push('dailyBudget が警告しきい値に近づいています。');
  if (monthlyWarning && !monthlyBudgetOver) warnings.push('monthlyBudget が警告しきい値に近づいています。');

  const status = warnings.length > 0 ? 'warning' : 'ok';

  return {
    version: PACKAGE.version,
    generatedAt: now,
    configPath: options.configPath || DEFAULT_CONFIG_PATH,
    taskVaultDir: resolveTaskVaultDir(taskVaultDir),
    ledgerPath: getTaskVaultPaths(taskVaultDir).costLedgerJsonl,
    summaryPath: getTaskVaultPaths(taskVaultDir).costSummaryJson,
    status,
    note: '概算であり実請求額ではありません。',
    total: totals,
    byProvider,
    byModel,
    warnings,
    warningCount: warnings.length,
    unknownRecords,
    unknownUsageCount: totals.unknownUsageCount,
    highCostModelWarning,
    sessionBudgetOver,
    dailyBudgetOver,
    monthlyBudgetOver,
    sessionBudgetUsd,
    dailyBudgetUsd,
    monthlyBudgetUsd,
    warningThresholdPercent,
    highCostModelHumanGate: config.budgets?.highCostModelHumanGate !== false,
    usdToJpy: Number(config.usdToJpy || 150),
  };
}

function buildApiCostSnapshot(taskVaultDir, options = {}) {
  return aggregateCostLedger(taskVaultDir, options);
}

module.exports = {
  DEFAULT_CONFIG_PATH,
  loadPricingConfig,
  inferProvider,
  inferBudgetTier,
  estimateRecordCost,
  appendCostLedgerRecord,
  loadCostLedgerEntries,
  saveCostSummary,
  aggregateCostLedger,
  buildApiCostSnapshot,
};

if (require.main === module) {
  const taskVaultDir = resolveTaskVaultDir();
  const snapshot = buildApiCostSnapshot(taskVaultDir);
  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}
