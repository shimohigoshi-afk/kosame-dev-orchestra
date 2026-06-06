'use strict';

/**
 * Secret Key Loader v110.9.0
 *
 * 優先順位:
 *   1. GCP Secret Manager (live mode のみ / ADC 必要)
 *   2. process.env fallback
 *   3. not_found
 *
 * 安全原則:
 *   - キー値はログに出力しない (presence only)
 *   - dryRun=true (デフォルト) では実際のネットワーク呼び出し不可
 *   - 値はメモリのみ保持。外部に送信・ログ出力禁止
 */

const { sectionStart, sectionEnd, log } = require('./colored-section-logger');

const TOOL_META = {
  version: '110.9.0',
  title:   'Secret Key Loader',
  slug:    'secret-key-loader'
};

const SOURCE = {
  SECRET_MANAGER: 'secret_manager',
  ENV_FALLBACK:   'env_fallback',
  DRY_RUN:        'dry_run',
  NOT_FOUND:      'not_found'
};

const DEFAULT_PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT
  || process.env.GCLOUD_PROJECT
  || null;

// ── SDK lazy-loader ───────────────────────────────────────────────────────────

function _getSmClient() {
  try {
    const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
    return new SecretManagerServiceClient();
  } catch {
    return null;
  }
}

// ── Single key resolver ───────────────────────────────────────────────────────

/**
 * Load one key. Never logs or returns the raw value — returns presence only.
 *
 * @param {string} keyName   e.g. 'OPENAI_API_KEY'
 * @param {object} opts
 *   projectId   {string}   GCP project ID (overrides env)
 *   dryRun      {boolean}  default true — no network calls
 *   envFallback {boolean}  default true — fall back to process.env
 *   secretVersion {string} default 'latest'
 *   silent      {boolean}  suppress log output
 * @returns {object} resolution result — never contains the actual key value
 */
async function loadKey(keyName, opts) {
  const {
    projectId   = DEFAULT_PROJECT_ID,
    dryRun      = true,
    envFallback = true,
    secretVersion = 'latest',
    silent      = false
  } = opts || {};

  const emit = silent ? () => {} : log;

  if (dryRun) {
    const envPresent = envFallback
      ? (typeof process.env[keyName] === 'string' && process.env[keyName].length > 0)
      : false;

    const source = envPresent ? SOURCE.ENV_FALLBACK : SOURCE.DRY_RUN;
    emit('info', `[dry-run] ${keyName} — source: ${source}, present: ${envPresent}`);
    return _result(keyName, source, envPresent, null, dryRun);
  }

  // ── Live: try Secret Manager first ─────────────────────────────────────────
  if (projectId) {
    const client = _getSmClient();
    if (client) {
      try {
        const name = `projects/${projectId}/secrets/${keyName}/versions/${secretVersion}`;
        const [resp] = await client.accessSecretVersion({ name });
        const value = resp?.payload?.data?.toString('utf8') ?? null;
        const present = typeof value === 'string' && value.length > 0;
        emit('success', `${keyName} — Secret Manager (present: ${present})`);
        return _result(keyName, SOURCE.SECRET_MANAGER, present, present ? value : null, dryRun);
      } catch (err) {
        emit('warn', `${keyName} — Secret Manager failed (${err.code || err.message}), trying env fallback`);
      }
    } else {
      emit('warn', `${keyName} — @google-cloud/secret-manager not installed, skipping SM`);
    }
  } else {
    emit('warn', `${keyName} — no projectId, skipping Secret Manager`);
  }

  // ── Live: env fallback ──────────────────────────────────────────────────────
  if (envFallback) {
    const val     = process.env[keyName];
    const present = typeof val === 'string' && val.length > 0;
    emit(present ? 'success' : 'warn',
      `${keyName} — env fallback (present: ${present})`);
    return _result(keyName, SOURCE.ENV_FALLBACK, present, present ? val : null, dryRun);
  }

  emit('error', `${keyName} — not found`);
  return _result(keyName, SOURCE.NOT_FOUND, false, null, dryRun);
}

// ── Batch resolver ────────────────────────────────────────────────────────────

/**
 * Load multiple keys.
 * Returns a summary object. Values are omitted from the summary.
 */
async function resolveKeys(keyNames, opts) {
  const {
    sectionName = 'Secret Key Loader',
    silent      = false,
    dryRun      = true,
    ...rest
  } = opts || {};

  const emit = silent ? () => {} : log;

  if (!silent) sectionStart(sectionName);
  emit('info', `resolving ${keyNames.length} key(s): ${keyNames.join(', ')}`);

  const results = {};
  let smCount  = 0;
  let envCount = 0;
  let missing  = 0;

  for (const name of keyNames) {
    const r = await loadKey(name, { dryRun, silent, ...rest });
    results[name] = {
      source:     r.source,
      keyPresent: r.keyPresent,
      dryRun:     r.dryRun
    };
    // tally
    if (r.source === SOURCE.SECRET_MANAGER) smCount++;
    else if (r.source === SOURCE.ENV_FALLBACK && r.keyPresent) envCount++;
    else if (r.source === SOURCE.DRY_RUN) {}  // counted separately
    else missing++;
  }

  const summary = {
    tool:                    TOOL_META.slug,
    version:                 TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied:  true,
    humanApprovalRequired:   true,
    sectionName,
    keyCount:                keyNames.length,
    secretManagerCount:      smCount,
    envFallbackCount:        envCount,
    missingCount:            missing,
    results
  };

  emit('info', `done — SM:${smCount} env:${envCount} missing:${missing}`);
  if (!silent) sectionEnd(sectionName);

  return summary;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _result(keyName, source, keyPresent, _value, dryRun) {
  return {
    tool:    TOOL_META.slug,
    version: TOOL_META.version,
    dryRun,
    realProductActionsExecuted: false,
    dangerousActionsDenied: true,
    humanApprovalRequired:  true,
    keyName,
    source,
    keyPresent,
    // value is intentionally NOT included in the returned object
    // to prevent accidental logging / serialization
    valueHidden: true
  };
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

async function main() {
  const keys = ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'GROK_API_KEY'];
  const summary = await resolveKeys(keys, {
    sectionName: 'Secret Manager 読み込み',
    dryRun: true
  });
  console.log('');
  console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
  main().catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
}

module.exports = {
  TOOL_META,
  SOURCE,
  loadKey,
  resolveKeys
};
