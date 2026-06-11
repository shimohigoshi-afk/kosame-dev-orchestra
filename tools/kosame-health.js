#!/usr/bin/env node
'use strict';

/**
 * KOSAME Unified Health Report v1.0.0
 *
 * Worker health cache, budget, and env status を1つのダッシュボードに集約。
 * kosame-cheap-first-runtime のヘルスプリミティブをラップする。
 *
 * Usage:
 *   node tools/kosame-health.js          # formatted display
 *   node tools/kosame-health.js --json   # JSON output
 */

const {
  TOOL_META: RUNTIME_META,
  WSTATUS,
  PROVIDER_ENV_KEYS,
  readConfig,
  readHealthCache,
  readSpend,
  checkEnvPresence,
  checkBudget,
  tryAutoRecover,
} = require('./kosame-cheap-first-runtime');

const TOOL_META = {
  version: '1.0.0',
  slug:    'kosame-health',
};

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', blue: '\x1b[34m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (len = 60) => '─'.repeat(len);

// ── Worker health ──────────────────────────────────────────────────────────────

function buildWorkerHealthReport(config, cache) {
  const envPresence = checkEnvPresence(config);
  const workers = [];
  let available = 0, onLeave = 0, isolated = 0, excluded = 0, missingEnv = 0;

  for (const [workerName, workerDef] of Object.entries(config.workers || {})) {
    const info   = cache.workers?.[workerName];
    const status = info?.status ?? WSTATUS.AVAILABLE;
    const envOk  = envPresence[workerName] !== false;

    switch (status) {
      case WSTATUS.AVAILABLE: available++;  break;
      case WSTATUS.ON_LEAVE:  onLeave++;    break;
      case WSTATUS.ISOLATED:  isolated++;   break;
      case WSTATUS.EXCLUDED:  excluded++;   break;
    }
    if (!envOk) missingEnv++;

    workers.push({
      workerName,
      modelId:       workerDef.modelId,
      provider:      workerDef.provider,
      status,
      envPresent:    envOk,
      errorType:     info?.errorType    ?? null,
      retryAfter:    info?.retryAfter   ?? null,
      lastSuccessAt: info?.lastSuccessAt ?? null,
    });
  }

  return { workers, available, onLeave, isolated, excluded, missingEnv };
}

// ── Budget health ──────────────────────────────────────────────────────────────

function buildBudgetHealthReport(config) {
  const spend  = readSpend();
  const budget = checkBudget(0, config);
  const pct    = budget.budgetUsd > 0
    ? Math.round((spend.totalUsd / budget.budgetUsd) * 100)
    : 0;

  const status = pct >= 90 ? 'critical' : pct >= 70 ? 'warning' : 'ok';

  return {
    month:        spend.month,
    spentUsd:     spend.totalUsd,
    budgetUsd:    budget.budgetUsd,
    remainingUsd: budget.remainingUsd,
    pctUsed:      pct,
    status,
  };
}

// ── Env health ─────────────────────────────────────────────────────────────────

function buildEnvHealthReport(config) {
  const presence = checkEnvPresence(config);
  const providers = {};

  for (const [wName, wDef] of Object.entries(config.workers || {})) {
    const p = wDef.provider;
    if (p && !(p in providers)) {
      const envKey = PROVIDER_ENV_KEYS[p];
      providers[p] = { envKey: envKey || null, present: presence[wName] !== false };
    }
  }

  const missingProviders = Object.entries(providers)
    .filter(([, v]) => !v.present)
    .map(([p]) => p);

  return { providers, missingProviders };
}

// ── Unified report ─────────────────────────────────────────────────────────────

function buildHealthReport() {
  const config = readConfig();
  const { cache } = tryAutoRecover(readHealthCache(), true);

  const workerHealth = buildWorkerHealthReport(config, cache);
  const budgetHealth = buildBudgetHealthReport(config);
  const envHealth    = buildEnvHealthReport(config);

  const issues = [];
  if (workerHealth.isolated > 0)
    issues.push(`${workerHealth.isolated} worker(s) isolated (auth error)`);
  if (workerHealth.excluded > 0)
    issues.push(`${workerHealth.excluded} worker(s) excluded (model not found)`);
  if (workerHealth.onLeave > 0)
    issues.push(`${workerHealth.onLeave} worker(s) on leave (rate limited)`);
  if (workerHealth.missingEnv > 0)
    issues.push(`${workerHealth.missingEnv} worker(s) missing env key`);
  if (budgetHealth.status === 'critical')
    issues.push(`budget critical (${budgetHealth.pctUsed}% used)`);
  if (budgetHealth.status === 'warning')
    issues.push(`budget warning (${budgetHealth.pctUsed}% used)`);
  if (envHealth.missingProviders.length > 0)
    issues.push(`providers missing env: ${envHealth.missingProviders.join(', ')}`);

  const overallHealth =
    issues.length === 0 ? 'healthy'  :
    issues.length <= 2  ? 'degraded' :
    'critical';

  return {
    tool:           TOOL_META.slug,
    version:        TOOL_META.version,
    runtimeVersion: RUNTIME_META.version,
    generatedAt:    new Date().toISOString(),
    overallHealth,
    issues,
    issueCount:     issues.length,
    workers:        workerHealth,
    budget:         budgetHealth,
    env:            envHealth,
    dryRun:         true,
  };
}

// ── Console display ────────────────────────────────────────────────────────────

function showHealth() {
  const report = buildHealthReport();

  const healthCol =
    report.overallHealth === 'healthy'  ? 'green'  :
    report.overallHealth === 'degraded' ? 'yellow' :
    'red';

  console.log('\n' + c('bold', c('blue', '⬡ KOSAME Health Report')) + `  v${TOOL_META.version}  (runtime v${report.runtimeVersion})`);
  console.log('  ' + hr());
  console.log(`  Overall Health : ${c(healthCol, c('bold', report.overallHealth.toUpperCase()))}`);
  console.log(`  Generated At   : ${c('dim', report.generatedAt)}`);

  if (report.issues.length > 0) {
    console.log(`\n  ${c('yellow', `⚠ Issues (${report.issueCount}):`)}`);
    for (const issue of report.issues) {
      console.log(`    ${c('red', '•')} ${issue}`);
    }
  } else {
    console.log(`\n  ${c('green', '✓ No issues detected')}`);
  }

  // Budget bar
  const b   = report.budget;
  const pct = b.pctUsed;
  const bar = '[' + '█'.repeat(Math.round(pct / 5)).padEnd(20, '░') + ']';
  const bCol = b.status === 'critical' ? 'red' : b.status === 'warning' ? 'yellow' : 'green';
  console.log(`\n  ${c('bold', '月間予算')}  $${b.spentUsd.toFixed(4)} / $${b.budgetUsd.toFixed(2)}  ${c(bCol, bar)} ${pct}%  (${b.month})`);

  // Workers
  const w = report.workers;
  console.log(`\n  ${c('bold', 'Workers')}  available:${c('green', String(w.available))}  onLeave:${c('yellow', String(w.onLeave))}  isolated:${c('red', String(w.isolated))}  excluded:${c('red', String(w.excluded))}`);
  console.log('  ' + hr(62));

  for (const wk of w.workers) {
    const stCol =
      wk.status === WSTATUS.AVAILABLE ? 'green'  :
      wk.status === WSTATUS.ON_LEAVE  ? 'yellow' :
      'red';
    const envMark = wk.envPresent ? c('green', '✓') : c('red', '✗ ENV');
    const retry   = wk.retryAfter ? ` (復帰: ${wk.retryAfter.slice(11, 16)} UTC)` : '';
    const errNote = wk.errorType  ? c('dim', ` [${wk.errorType}]`) : '';
    console.log(`    ${envMark}  ${wk.workerName.padEnd(22)} ${c('dim', wk.modelId.padEnd(26))} ${c(stCol, wk.status)}${retry}${errNote}`);
  }

  console.log('  ' + hr(62));
  console.log('');
}

// ── CLI ────────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const jsonMode = process.argv.includes('--json');
  if (jsonMode) {
    console.log(JSON.stringify(buildHealthReport(), null, 2));
  } else {
    showHealth();
  }
}

module.exports = {
  TOOL_META,
  buildWorkerHealthReport,
  buildBudgetHealthReport,
  buildEnvHealthReport,
  buildHealthReport,
  showHealth,
};
