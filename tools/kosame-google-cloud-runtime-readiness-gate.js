#!/usr/bin/env node
'use strict';

/**
 * KOSAME Google Cloud Runtime Readiness Gate v110.65.0
 *
 * Cloud Run / Scheduler / IAM / Secret Manager / GitHub Actions / local CLI の
 * 実行環境へ進む前に dryRun で安全確認するゲート。
 *
 * 【絶対禁止】
 *   - 実 deploy / 実課金 / IAM 変更 / Scheduler 変更
 *   - Secret Manager の値読み取り / 書き込み
 *   - .env / credentials ファイルへのアクセス
 *   - 営業DX / transcriber / ANESTY Board アクセス
 *   - 顧客データアクセス
 *   - 高コストモデルの未承認使用
 *
 * 【できること】
 *   - projectId / region / サービス名 / ジョブ名の形式検証
 *   - required env key 名（値ではない）の一覧確認
 *   - Secret 参照名（値ではない）のネーミング規則確認
 *   - GitHub Actions ワークフローファイルの存在確認（fs.existsSync のみ）
 *   - local CLI（gcloud / docker / gh）の PATH 上存在確認
 *   - danger gate 判定
 *
 * Usage:
 *   node tools/kosame-google-cloud-runtime-readiness-gate.js
 *   node tools/kosame-google-cloud-runtime-readiness-gate.js --json
 */

const fs = require('fs');
const path = require('path');

const TOOL_META = {
  version: '110.65.0',
  feature: 'v110-65-google-cloud-runtime-readiness-gate',
  slug: 'kosame-google-cloud-runtime-readiness-gate',
  dryRunOnly: true,
};

// ── Status constants ──────────────────────────────────────────────────────────

const STATUS = {
  ready:      'ready',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

// ── Known valid GCP regions ───────────────────────────────────────────────────

const KNOWN_GCP_REGIONS = new Set([
  'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1',
  'us-west1', 'us-west2', 'us-west3', 'us-west4',
  'northamerica-northeast1', 'northamerica-northeast2',
  'southamerica-east1', 'southamerica-west1',
  'europe-central2', 'europe-north1', 'europe-southwest1',
  'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4',
  'europe-west6', 'europe-west8', 'europe-west9', 'europe-west10', 'europe-west12',
  'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
  'asia-south1', 'asia-south2', 'asia-southeast1', 'asia-southeast2',
  'australia-southeast1', 'australia-southeast2',
  'me-central1', 'me-central2', 'me-west1',
  'africa-south1',
]);

// ── Danger gate patterns ──────────────────────────────────────────────────────

const DANGER_PATTERNS = [
  {
    id: 'real_deploy_attempt',
    label: 'Real deploy attempt',
    test: (ctx) => !!(ctx.deploy === true || ctx.realDeploy === true || ctx.liveMode === true),
    reason: 'deploy=true / realDeploy=true / liveMode=true が検出されました。dryRun ゲートでは実 deploy を許可しません。',
  },
  {
    id: 'real_iam_mutation',
    label: 'Real IAM mutation',
    test: (ctx) => !!(ctx.iamMutation === true || ctx.addIamPolicy === true || ctx.removeIamPolicy === true),
    reason: 'IAM 変更フラグが検出されました。実 IAM 変更は人間承認フローを経由してください。',
  },
  {
    id: 'real_scheduler_mutation',
    label: 'Real Scheduler mutation',
    test: (ctx) => !!(ctx.schedulerMutation === true || ctx.createSchedulerJob === true || ctx.deleteSchedulerJob === true),
    reason: 'Scheduler 変更フラグが検出されました。実 Scheduler 変更は人間承認フローを経由してください。',
  },
  {
    id: 'real_secret_access',
    label: 'Real Secret access',
    test: (ctx) => !!(ctx.readSecret === true || ctx.writeSecret === true || ctx.secretValue !== undefined),
    reason: 'Secret の値へのアクセスが検出されました。Secret 値は絶対に読み取りません。',
  },
  {
    id: 'env_credentials_access',
    label: '.env / credentials access',
    test: (ctx) => {
      const flagged = !!(ctx.readEnv === true || ctx.readCredentials === true);
      const suspectFiles = (ctx.targetFiles || []).some(f =>
        /\.env|credentials\.json|service.?account.*\.json|key.*\.json/i.test(String(f)),
      );
      return flagged || suspectFiles;
    },
    reason: '.env / credentials ファイルへのアクセスが検出されました。Readiness Gate では Secret・資格情報を扱いません。',
  },
  {
    id: 'sales_dx_access',
    label: 'Sales DX / Transcriber access',
    test: (ctx) => !!(ctx.isSalesDx === true || ctx.salesDx === true || ctx.transcriber === true),
    reason: '営業DX / transcriber タスクは専用の承認フローが必要です。',
  },
  {
    id: 'anesty_board_access',
    label: 'ANESTY Board access',
    test: (ctx) => !!(ctx.anestyBoard === true || ctx.anesty === true),
    reason: 'ANESTY Board への自律進行は禁止されています。人間が明示的に許可してください。',
  },
  {
    id: 'customer_data_access',
    label: 'Customer data access',
    test: (ctx) => !!(ctx.customerData === true || ctx.pii === true || ctx.personalData === true),
    reason: '顧客データ / PII へのアクセスが検出されました。このゲートでは顧客データを扱いません。',
  },
  {
    id: 'high_cost_without_approval',
    label: 'High-cost model without approval',
    test: (ctx) => {
      const highCostModels = ['gpt-5.5', 'claude-opus-4-8'];
      const model = String(ctx.requestedModel || ctx.selectedModel || '');
      return highCostModels.includes(model) && !ctx.approvalReceived;
    },
    reason: '高コストモデルを承認なしで使用しようとしています。approvalReceived=true が必要です。',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function compactText(...parts) {
  return parts
    .filter(Boolean)
    .map(p => String(p))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map(v => String(v || '').trim()).filter(Boolean);
  if (!value) return [];
  const text = String(value).trim();
  return text ? [text] : [];
}

function nowIso() {
  return new Date().toISOString();
}

// ── Validation functions ──────────────────────────────────────────────────────

function validateProjectId(projectId) {
  if (!projectId) return { ok: false, reason: 'projectId が未指定です' };
  const id = String(projectId);
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(id)) {
    return { ok: false, reason: `projectId "${id}" の形式が不正です (小文字英数字・ハイフン、6〜30文字)` };
  }
  return { ok: true };
}

function validateRegion(region) {
  if (!region) return { ok: false, reason: 'region が未指定です' };
  const r = String(region);
  if (!KNOWN_GCP_REGIONS.has(r)) {
    return { ok: false, reason: `region "${r}" は未知の GCP リージョンです`, caution: true };
  }
  return { ok: true };
}

function validateCloudRunService(serviceName) {
  if (!serviceName) return { ok: true, skipped: true };
  const name = String(serviceName);
  if (!/^[a-z][a-z0-9-]{0,48}[a-z0-9]$/.test(name) && !/^[a-z]$/.test(name)) {
    return { ok: false, reason: `Cloud Run service name "${name}" の形式が不正です (小文字英数字・ハイフン、最大50文字)` };
  }
  return { ok: true };
}

function validateSchedulerJobName(jobName) {
  if (!jobName) return { ok: true, skipped: true };
  const name = String(jobName);
  if (!/^[a-zA-Z][a-zA-Z0-9-_]{0,498}$/.test(name)) {
    return { ok: false, reason: `Scheduler job name "${name}" の形式が不正です` };
  }
  return { ok: true };
}

function validateSchedule(schedule) {
  if (!schedule) return { ok: true, skipped: true };
  const s = String(schedule);
  // cron 形式の簡易チェック: 5フィールド or "every N (minutes|hours)"
  const isCron = /^(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)\s+(\*|[0-9,\-\/]+)$/.test(s.trim());
  const isEvery = /^every\s+\d+\s+(minutes?|hours?)$/.test(s.trim());
  if (!isCron && !isEvery) {
    return { ok: false, reason: `schedule "${s}" の形式が不正です (cron 5フィールド or "every N minutes/hours")`, caution: true };
  }
  return { ok: true };
}

function validateEnvKeyNames(requiredEnvKeys) {
  const keys = normalizeList(requiredEnvKeys);
  if (keys.length === 0) return { ok: true, skipped: true, keys: [] };
  const invalid = keys.filter(k => !/^[A-Z][A-Z0-9_]*$/.test(k));
  if (invalid.length > 0) {
    return { ok: false, reason: `env key 名の形式が不正です: ${invalid.join(', ')} (大文字英数字・アンダースコア)`, keys };
  }
  return { ok: true, keys };
}

function validateSecretRefNames(secretRefNames) {
  const names = normalizeList(secretRefNames);
  if (names.length === 0) return { ok: true, skipped: true, names: [] };
  const invalid = names.filter(n => !/^[a-zA-Z0-9_-]{1,255}$/.test(n));
  if (invalid.length > 0) {
    return { ok: false, reason: `Secret 参照名の形式が不正です: ${invalid.join(', ')}`, names };
  }
  return { ok: true, names };
}

function checkGitHubActionsWorkflows(workflowFiles, repoRoot) {
  const files = normalizeList(workflowFiles);
  if (files.length === 0) return { ok: true, skipped: true, found: [], missing: [] };

  const root = repoRoot || process.cwd();
  const found = [];
  const missing = [];

  for (const wf of files) {
    const candidate = path.isAbsolute(wf) ? wf : path.join(root, '.github', 'workflows', wf);
    const altCandidate = path.isAbsolute(wf) ? wf : path.join(root, wf);
    if (fs.existsSync(candidate) || fs.existsSync(altCandidate)) {
      found.push(wf);
    } else {
      missing.push(wf);
    }
  }

  if (missing.length > 0) {
    return { ok: false, reason: `GitHub Actions ワークフローが見つかりません: ${missing.join(', ')}`, found, missing, caution: true };
  }
  return { ok: true, found, missing: [] };
}

function checkLocalCli(cliNames) {
  const names = normalizeList(cliNames).length > 0
    ? normalizeList(cliNames)
    : ['gcloud', 'docker', 'gh'];

  const available = [];
  const unavailable = [];

  for (const cli of names) {
    // PATH 上の存在確認のみ (実行なし)
    const pathDirs = (process.env.PATH || '').split(path.delimiter);
    const found = pathDirs.some(dir => {
      try {
        const full = path.join(dir, cli);
        return fs.existsSync(full);
      } catch {
        return false;
      }
    });
    if (found) available.push(cli);
    else unavailable.push(cli);
  }

  return { available, unavailable };
}

// ── Danger gate ───────────────────────────────────────────────────────────────

function checkDangerGates(context = {}) {
  const triggered = [];
  for (const pattern of DANGER_PATTERNS) {
    if (pattern.test(context)) {
      triggered.push({
        id: pattern.id,
        label: pattern.label,
        reason: pattern.reason,
      });
    }
  }
  return triggered;
}

// ── Core gate builder ─────────────────────────────────────────────────────────

/**
 * Google Cloud ランタイム readiness を dryRun で判定する。
 * 実 API 呼び出し・Secret 読み取りは一切行わない。
 *
 * @param {object} config   - readiness 設定
 * @param {object} context  - 追加コンテキスト（danger gate 検出用フラグを含む）
 * @returns {object}        - readiness result
 *
 * config fields:
 *   projectId        {string}   - GCP プロジェクト ID
 *   region           {string}   - GCP リージョン
 *   cloudRunService  {string}   - Cloud Run サービス名（省略可）
 *   schedulerJobName {string}   - Cloud Scheduler ジョブ名（省略可）
 *   schedule         {string}   - cron スケジュール文字列（省略可）
 *   requiredEnvKeys  {string[]} - 必須 env key 名の一覧（値ではない）
 *   secretRefNames   {string[]} - Secret Manager 参照名（値ではない）
 *   workflowFiles    {string[]} - GitHub Actions ワークフローファイル名
 *   requiredCli      {string[]} - 必須 CLI ツール名（省略時: gcloud/docker/gh）
 *   repoRoot         {string}   - リポジトリルートパス（省略時: cwd）
 */
function buildRuntimeReadinessGate(config = {}, context = {}) {
  const timestamp = nowIso();
  const checkedItems = [];
  const missingItems = [];
  const blockedReasons = [];
  const cautions = [];

  // ── Danger gate (最優先) ──────────────────────────────────────────────────

  const dangerGates = checkDangerGates(context);
  for (const dg of dangerGates) {
    blockedReasons.push(`[DANGER] ${dg.label}: ${dg.reason}`);
  }

  // ── projectId ─────────────────────────────────────────────────────────────

  const projectCheck = validateProjectId(config.projectId);
  checkedItems.push({ item: 'projectId', value: String(config.projectId || '(未指定)'), result: projectCheck.ok ? 'ok' : 'fail' });
  if (!projectCheck.ok) blockedReasons.push(projectCheck.reason);

  // ── region ────────────────────────────────────────────────────────────────

  const regionCheck = validateRegion(config.region);
  checkedItems.push({ item: 'region', value: String(config.region || '(未指定)'), result: regionCheck.ok ? 'ok' : regionCheck.caution ? 'caution' : 'fail' });
  if (!regionCheck.ok) {
    if (regionCheck.caution) cautions.push(regionCheck.reason);
    else blockedReasons.push(regionCheck.reason);
  }

  // ── Cloud Run service name ────────────────────────────────────────────────

  const cloudRunCheck = validateCloudRunService(config.cloudRunService);
  if (!cloudRunCheck.skipped) {
    checkedItems.push({ item: 'cloudRunService', value: String(config.cloudRunService), result: cloudRunCheck.ok ? 'ok' : 'fail' });
    if (!cloudRunCheck.ok) blockedReasons.push(cloudRunCheck.reason);
  }

  // ── Scheduler job name ────────────────────────────────────────────────────

  const schedulerCheck = validateSchedulerJobName(config.schedulerJobName);
  if (!schedulerCheck.skipped) {
    checkedItems.push({ item: 'schedulerJobName', value: String(config.schedulerJobName), result: schedulerCheck.ok ? 'ok' : 'fail' });
    if (!schedulerCheck.ok) blockedReasons.push(schedulerCheck.reason);
  }

  // ── Schedule format ───────────────────────────────────────────────────────

  const scheduleCheck = validateSchedule(config.schedule);
  if (!scheduleCheck.skipped) {
    checkedItems.push({ item: 'schedule', value: String(config.schedule), result: scheduleCheck.ok ? 'ok' : 'caution' });
    if (!scheduleCheck.ok) {
      if (scheduleCheck.caution) cautions.push(scheduleCheck.reason);
      else blockedReasons.push(scheduleCheck.reason);
    }
  }

  // ── Required env key names ────────────────────────────────────────────────

  const envCheck = validateEnvKeyNames(config.requiredEnvKeys);
  if (!envCheck.skipped) {
    checkedItems.push({ item: 'requiredEnvKeys', value: envCheck.keys, result: envCheck.ok ? 'ok' : 'fail' });
    if (!envCheck.ok) blockedReasons.push(envCheck.reason);
    else if (envCheck.keys.length > 0) {
      // 値は確認しない。名前のみ記録
    }
  }

  // ── Secret reference names ────────────────────────────────────────────────

  const secretCheck = validateSecretRefNames(config.secretRefNames);
  if (!secretCheck.skipped) {
    checkedItems.push({ item: 'secretRefNames', value: secretCheck.names, result: secretCheck.ok ? 'ok' : 'fail' });
    if (!secretCheck.ok) blockedReasons.push(secretCheck.reason);
  }

  // ── GitHub Actions workflow files ─────────────────────────────────────────

  const workflowCheck = checkGitHubActionsWorkflows(config.workflowFiles, config.repoRoot);
  if (!workflowCheck.skipped) {
    checkedItems.push({ item: 'workflowFiles', found: workflowCheck.found, missing: workflowCheck.missing, result: workflowCheck.ok ? 'ok' : 'caution' });
    if (!workflowCheck.ok) {
      cautions.push(workflowCheck.reason);
      missingItems.push(...workflowCheck.missing.map(f => `workflow: ${f}`));
    }
  }

  // ── Local CLI availability ────────────────────────────────────────────────

  const cliCheck = checkLocalCli(config.requiredCli);
  checkedItems.push({ item: 'localCli', available: cliCheck.available, unavailable: cliCheck.unavailable, result: cliCheck.unavailable.length === 0 ? 'ok' : 'caution' });
  if (cliCheck.unavailable.length > 0) {
    cautions.push(`CLI が PATH 上に見つかりません: ${cliCheck.unavailable.join(', ')}`);
    missingItems.push(...cliCheck.unavailable.map(cli => `cli: ${cli}`));
  }

  // ── Status determination ──────────────────────────────────────────────────

  let status;
  let humanApprovalRequired = false;
  let nextAllowedAction;

  if (dangerGates.length > 0) {
    status = STATUS.human_gate;
    humanApprovalRequired = true;
    nextAllowedAction = 'request_human_approval_before_any_action';
  } else if (blockedReasons.length > 0) {
    status = STATUS.blocked;
    humanApprovalRequired = false;
    nextAllowedAction = 'fix_blocked_items_and_retry_readiness_check';
  } else if (cautions.length > 0) {
    status = STATUS.caution;
    humanApprovalRequired = false;
    nextAllowedAction = 'review_cautions_then_proceed_with_care';
  } else {
    status = STATUS.ready;
    humanApprovalRequired = false;
    nextAllowedAction = 'proceed_to_deploy_dry_run_or_human_approved_live_deploy';
  }

  const dangerGateTriggered = dangerGates.length > 0;

  return {
    version: TOOL_META.version,
    timestamp,
    dryRun: true,
    status,
    humanApprovalRequired,
    dangerGateTriggered,
    dangerGates: dangerGates.map(dg => ({ id: dg.id, label: dg.label })),
    checkedItems,
    missingItems,
    blockedReasons,
    cautions,
    nextAllowedAction,
    summary: compactText(
      `status=${status}`,
      blockedReasons.length > 0 ? `blocked(${blockedReasons.length})` : '',
      cautions.length > 0 ? `cautions(${cautions.length})` : '',
      dangerGateTriggered ? 'DANGER_GATE_TRIGGERED' : '',
    ),
  };
}

/**
 * danger gate のみを単体で評価する（ルーター統合用）。
 *
 * @param {object} context
 * @returns {{ triggered: boolean, gates: object[] }}
 */
function evaluateDangerGates(context = {}) {
  const gates = checkDangerGates(context);
  return {
    triggered: gates.length > 0,
    gates,
    humanGateRequired: gates.length > 0,
    humanGateReason: gates.length > 0
      ? gates.map(g => g.reason).join(' | ')
      : null,
  };
}

// ── Colors (CLI display) ──────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', blue: '\x1b[34m', gray: '\x1b[90m',
  bgRed: '\x1b[41m', white: '\x1b[37m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;
const hr = (n = 68) => '─'.repeat(n);

function printReadinessDashboard(result) {
  const statusColor = result.status === 'ready' ? 'green'
    : result.status === 'caution' ? 'yellow'
    : result.status === 'human_gate' ? 'bgRed'
    : 'red';

  console.log('');
  console.log(`${c('bold', c('blue', '⬡ KOSAME Google Cloud Runtime Readiness Gate'))}  v${TOOL_META.version}`);
  console.log(`  ${c('dim', result.timestamp)}  ${c('dim', '[DRY-RUN ONLY]')}`);
  console.log('  ' + hr());
  console.log(`  Status: ${c(statusColor, result.status.toUpperCase().padEnd(12))}  ${result.summary}`);
  console.log('  ' + hr());

  if (result.dangerGateTriggered) {
    console.log(`  ${c('bgRed', c('white', '  !! DANGER GATE TRIGGERED !!  '))}`);
    for (const dg of result.dangerGates) {
      console.log(`  ${c('red', `[${dg.id}]`)} ${dg.label}`);
    }
    console.log('');
  }

  console.log(`  ${c('bold', 'Checked Items')}`);
  for (const item of result.checkedItems) {
    const icon = item.result === 'ok' ? c('green', '✓') : item.result === 'caution' ? c('yellow', '⚠') : c('red', '✗');
    const val = Array.isArray(item.value || item.found)
      ? (item.value || item.found || []).slice(0, 3).join(', ')
      : String(item.value || item.found || '');
    console.log(`  ${icon} ${String(item.item).padEnd(20)} ${c('gray', val.slice(0, 50))}`);
  }

  if (result.blockedReasons.length > 0) {
    console.log('');
    console.log(`  ${c('red', 'Blocked Reasons')}`);
    for (const r of result.blockedReasons) {
      console.log(`  ${c('red', '✗')} ${r}`);
    }
  }

  if (result.cautions.length > 0) {
    console.log('');
    console.log(`  ${c('yellow', 'Cautions')}`);
    for (const ca of result.cautions) {
      console.log(`  ${c('yellow', '⚠')} ${ca}`);
    }
  }

  if (result.missingItems.length > 0) {
    console.log('');
    console.log(`  ${c('dim', 'Missing')} ${result.missingItems.join(', ')}`);
  }

  console.log('  ' + hr());
  console.log(`  Next: ${c('cyan', result.nextAllowedAction)}`);
  if (result.humanApprovalRequired) {
    console.log(`  ${c('red', '⚠ Human approval required before proceeding.')}`);
  }
  console.log('');
}

// ── CLI entry ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');

  const sampleConfig = {
    projectId: 'kosame-dev-orchestra',
    region: 'asia-northeast1',
    cloudRunService: 'kosame-api',
    schedulerJobName: 'kosame-daily-job',
    schedule: '0 9 * * 1-5',
    requiredEnvKeys: ['OPENAI_API_KEY', 'GEMINI_API_KEY', 'KOSAME_ENV'],
    secretRefNames: ['kosame-openai-key', 'kosame-gemini-key'],
    workflowFiles: ['verify.yml', 'pm-agent.yml'],
    repoRoot: process.cwd(),
  };

  const result = buildRuntimeReadinessGate(sampleConfig, {});

  if (jsonMode) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReadinessDashboard(result);
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  TOOL_META,
  STATUS,
  KNOWN_GCP_REGIONS,
  DANGER_PATTERNS,
  buildRuntimeReadinessGate,
  evaluateDangerGates,
  validateProjectId,
  validateRegion,
  validateCloudRunService,
  validateSchedulerJobName,
  validateSchedule,
  validateEnvKeyNames,
  validateSecretRefNames,
  checkGitHubActionsWorkflows,
  checkLocalCli,
  checkDangerGates,
  printReadinessDashboard,
};
