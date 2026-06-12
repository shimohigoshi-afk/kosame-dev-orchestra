#!/usr/bin/env node
'use strict';

/**
 * KOSAME Final Release Readiness Board v110.68.0
 *
 * v110.58〜v110.67 で追加された各ゲートの状態を統合し、
 * リリース前に GO / CAUTION / BLOCKED / HUMAN_GATE を
 * 1画面で確認できる readiness board を生成する。
 *
 * 【制約】
 *   - 実API呼び出し不可（dryRun / mock / fixture / config inspection のみ）
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *   - 実 deploy / IAM / Scheduler 変更はしない
 *
 * Usage:
 *   node tools/kosame-final-release-readiness-board.js
 *   node tools/kosame-final-release-readiness-board.js --json
 */

const fs   = require('fs');
const path = require('path');

const TOOL_META = {
  version:       '110.68.0',
  feature:       'v110-68-final-release-readiness-board',
  slug:          'kosame-final-release-readiness-board',
  dryRunOnly:    true,
};

const STATUS = {
  go:         'go',
  caution:    'caution',
  blocked:    'blocked',
  human_gate: 'human_gate',
};

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', magenta: '\x1b[35m',
  gray: '\x1b[90m', bgRed: '\x1b[41m', bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

// ── Gate definitions ──────────────────────────────────────────────────────────

const GATE_DEFS = [
  { key: 'sanitized_task_pack',          label: 'Sanitized Task Pack Readiness',       version: '110.58', file: 'tools/kosame-sanitized-task-pack-generator.js',        script: 'smoke:v110-58', smoke: 'smoke/v110-58-sanitized-task-pack-generator-smoke.js' },
  { key: 'patch_intake',                 label: 'Patch Intake Readiness',               version: '110.59', file: 'tools/kosame-patch-intake-gate.js',                     script: 'smoke:v110-59', smoke: 'smoke/v110-59-patch-intake-gate-smoke.js' },
  { key: 'external_worker_safe_trial',   label: 'External Worker Safe Trial Readiness', version: '110.60', file: 'tools/kosame-external-worker-safe-trial-runner.js',     script: 'smoke:v110-60', smoke: 'smoke/v110-60-external-worker-safe-trial-runner-smoke.js' },
  { key: 'grok_safe_review',             label: 'Grok Safe Review Readiness',           version: '110.61', file: 'tools/kosame-grok-safe-review-lane.js',                 script: 'smoke:v110-61', smoke: 'smoke/v110-61-grok-safe-review-lane-smoke.js' },
  { key: 'provider_budget_bucket',       label: 'Provider Budget Bucket Readiness',     version: '110.62', file: 'tools/kosame-provider-budget-bucket-router.js',         script: 'smoke:v110-62', smoke: 'smoke/v110-62-provider-budget-bucket-router-smoke.js' },
  { key: 'human_gate_inbox',             label: 'Human Gate Inbox Readiness',           version: '110.63', file: 'tools/kosame-human-gate-inbox.js',                      script: 'smoke:v110-63', smoke: 'smoke/v110-63-human-gate-inbox-smoke.js' },
  { key: 'agent_handoff_coordination',   label: 'Agent Handoff Coordination Readiness', version: '110.64', file: 'tools/kosame-agent-handoff-coordination-gate.js',        script: 'smoke:v110-64', smoke: 'smoke/v110-64-agent-handoff-coordination-gate-smoke.js' },
  { key: 'google_cloud_runtime',         label: 'Google Cloud Runtime Readiness',       version: '110.65', file: 'tools/kosame-google-cloud-runtime-readiness-gate.js',  script: 'smoke:v110-65', smoke: 'smoke/v110-65-google-cloud-runtime-readiness-gate-smoke.js' },
  { key: 'provider_availability',        label: 'Provider Availability Readiness',      version: '110.66', file: 'tools/kosame-provider-availability-health-snapshot.js', script: 'smoke:v110-66', smoke: 'smoke/v110-66-provider-availability-health-snapshot-smoke.js' },
  { key: 'parallel_agent_merge_guard',   label: 'Parallel Agent Merge Guard Readiness', version: '110.67', file: 'tools/kosame-parallel-agent-merge-guard.js',            script: 'smoke:v110-67', smoke: 'smoke/v110-67-parallel-agent-merge-guard-smoke.js' },
  { key: 'final_release_readiness_board', label: 'Final Release Readiness Board',        version: '110.68', file: 'tools/kosame-final-release-readiness-board.js',        script: 'smoke:v110-68', smoke: 'smoke/v110-68-final-release-readiness-board-smoke.js' },
];

// ── Danger gate patterns (config inspection only, no value reading) ──────────

const DANGER_GATE_DEFS = [
  {
    id: 'sales_dx_access',
    label: 'salesDX/transcriber access',
    check: (changedFiles) => (changedFiles || []).some(f =>
      /sales.?dx|transcriber/i.test(path.basename(f))),
    reason: '営業DX / transcriber ファイルの変更が含まれています',
  },
  {
    id: 'anesty_board_access',
    label: 'ANESTY Board access',
    check: (changedFiles) => (changedFiles || []).some(f =>
      /anesty.?board/i.test(path.basename(f))),
    reason: 'ANESTY Board ファイルの変更が含まれています',
  },
  {
    id: 'secret_file_access',
    label: 'Secret/API key/.env/credentials access',
    check: (changedFiles) => (changedFiles || []).some(f =>
      /\.env$|credentials\.json|service.?account.*\.json|\.pem$|\.key$/i.test(f)),
    reason: 'Secret / credentials ファイルが変更対象に含まれています',
  },
  {
    id: 'customer_data_access',
    label: 'Customer data access',
    check: (changedFiles) => (changedFiles || []).some(f =>
      /customer.?data|pii|personal.?data/i.test(f)),
    reason: '顧客データファイルが変更対象に含まれています',
  },
  {
    id: 'real_api_call',
    label: 'Real API call attempt',
    check: (_cf, ctx) => ctx?.liveMode === true || ctx?.realApiCall === true,
    reason: '実API呼び出しモードが検出されました。dryRun 専用です。',
  },
  {
    id: 'real_billing_deploy_iam',
    label: 'Real billing/deploy/IAM/Scheduler mutation',
    check: (_cf, ctx) => ctx?.realDeploy === true || ctx?.realBilling === true || ctx?.iamMutation === true || ctx?.schedulerChange === true,
    reason: '実課金 / deploy / IAM / Scheduler 変更フラグが検出されました。',
  },
  {
    id: 'high_cost_model_no_approval',
    label: 'High cost model without approval',
    check: (_cf, ctx) => ctx?.highCostModel === true && ctx?.humanApproved !== true,
    reason: '高コストモデルが明示承認なしで選択されました。',
  },
  {
    id: 'external_worker_non_sanitized',
    label: 'External worker non-sanitized task',
    check: (_cf, ctx) => ctx?.externalWorker === true && ctx?.sanitizedOnly !== true,
    reason: '外部 worker に非 sanitized タスクが渡されようとしています。',
  },
  {
    id: 'missing_smoke_in_verify',
    label: 'Missing smoke file referenced by package.json',
    check: (_cf, ctx) => {
      if (!ctx?.smokeEntries || !ctx?.smokeFilesOnDisk) return false;
      for (const [script, smokePath] of Object.entries(ctx.smokeEntries)) {
        const resolved = path.isAbsolute(smokePath) ? smokePath : path.join(ctx.repoRoot || process.cwd(), smokePath);
        if (!ctx.smokeFilesOnDisk.includes(path.basename(resolved)) && !fs.existsSync(resolved)) {
          return true;
        }
      }
      return false;
    },
    reason: 'package.json に登録されている smoke ファイルがディスク上に見つかりません。',
  },
  {
    id: 'untracked_verify_required',
    label: 'Untracked file required by verify',
    check: (_cf, ctx) => {
      if (!ctx?.untrackedFiles || !ctx?.verifySmokes || !ctx?.smokeEntries) return false;
      const untracked = new Set(ctx.untrackedFiles);
      for (const key of ctx.verifySmokes) {
        const smokeFile = ctx.smokeEntries[key];
        if (!smokeFile) continue;
        if (untracked.has(smokeFile)) return true;
      }
      return false;
    },
    reason: 'verify に必要な smoke ファイルが git 未追跡です。',
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeVersion(v) {
  return String(v || '').trim().replace(/^v/i, '').split('.').slice(0, 2).join('.');
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function readPackageJsonMeta(repoRoot) {
  const pkgPath = path.join(String(repoRoot || process.cwd()), 'package.json');
  if (!fileExists(pkgPath)) return { version: '', smokeEntries: {}, verifySmokes: [] };
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')); } catch { return { version: '', smokeEntries: {}, verifySmokes: [] }; }
  const version = String(pkg.version || '');
  const scripts = pkg.scripts || {};
  const verifyScript = String(scripts.verify || '');
  const smokeEntries = {};
  for (const [key, val] of Object.entries(scripts)) {
    if (/^smoke:v\d+/.test(key)) smokeEntries[key] = String(val).replace(/^node\s+/, '').trim();
  }
  const verifySmokes = [...verifyScript.matchAll(/smoke:v[\w-]+/g)].map(m => m[0]);
  return { version, smokeEntries, verifySmokes };
}

function listSmokeFilesOnDisk(repoRoot) {
  const smokeDir = path.join(String(repoRoot || process.cwd()), 'smoke');
  try { return fs.readdirSync(smokeDir); } catch { return []; }
}

// ── Gate checking ─────────────────────────────────────────────────────────────

function checkGateExistence(gateDef, repoRoot) {
  const items = [];
  let result = 'ok';
  const details = [];

  // Tool file exists
  const toolPath = path.join(repoRoot, gateDef.file);
  const toolOk = fileExists(toolPath);
  items.push({ check: `${gateDef.key}_tool_file`, result: toolOk ? 'ok' : 'blocked' });
  if (!toolOk) { result = 'blocked'; details.push(`${gateDef.file} not found`); }

  // Smoke test file exists
  const smokePath = path.join(repoRoot, gateDef.smoke);
  const smokeOk = fileExists(smokePath);
  items.push({ check: `${gateDef.key}_smoke_file`, result: smokeOk ? 'ok' : 'blocked' });
  if (!smokeOk) { result = 'blocked'; details.push(`${gateDef.smoke} not found`); }

  // Package.json script exists
  const scripts = readPackageJsonMeta(repoRoot).smokeEntries;
  const scriptOk = !!scripts[gateDef.script];
  items.push({ check: `${gateDef.key}_script_registered`, result: scriptOk ? 'ok' : 'caution' });
  if (!scriptOk) { details.push(`${gateDef.script} not in package.json`); if (result === 'ok') result = 'caution'; }

  return { key: gateDef.key, label: gateDef.label, version: gateDef.version, result, items, details };
}

function checkDangerGates(ctx) {
  const triggered = [];
  for (const dg of DANGER_GATE_DEFS) {
    try {
      if (dg.check(ctx.changedFiles || [], ctx)) {
        triggered.push({ id: dg.id, label: dg.label, reason: dg.reason });
      }
    } catch { /* skip check failure */ }
  }
  return triggered;
}

function checkVerifySmokeConsistency(verifySmokes, smokeEntries, smokeFilesOnDisk, repoRoot) {
  const issues = [];
  const gateScripts = new Set(GATE_DEFS.map(g => g.script));
  for (const key of verifySmokes) {
    if (!gateScripts.has(key)) continue;
    const smokeFile = smokeEntries[key];
    if (!smokeFile) {
      issues.push({ key, problem: 'script_not_found', detail: `verify に "${key}" がありますが package.json にスクリプトが見つかりません` });
      continue;
    }
    const basename = path.basename(smokeFile.replace(/^node\s+/, '').trim());
    if (!smokeFilesOnDisk.includes(basename) && !fileExists(path.join(repoRoot, smokeFile))) {
      issues.push({ key, problem: 'file_not_found', detail: `verify の "${key}" → "${smokeFile}" がディスク上に見つかりません` });
    }
  }
  return issues;
}

// ── Main board builder ────────────────────────────────────────────────────────

function buildReleaseReadinessBoard(request = {}) {
  const repoRoot = request.repoRoot || process.cwd();
  const targetVersion = String(request.targetVersion || TOOL_META.version);

  const pkgMeta = readPackageJsonMeta(repoRoot);
  const smokeFilesOnDisk = listSmokeFilesOnDisk(repoRoot);

  const checkedGates = [];
  const blockedReasons = [];
  const cautions = [];
  const humanGateItems = [];
  const dangerGates = [];
  let overallStatus = STATUS.go;

  // ── 1. Check each gate existence ───────────────────────────────────────────

  for (const gd of GATE_DEFS) {
    const gateResult = checkGateExistence(gd, repoRoot);
    checkedGates.push(gateResult);

    if (gateResult.result === 'blocked') {
      blockedReasons.push(...gateResult.details.map(d => `[${gateResult.label}] ${d}`));
      if (overallStatus === STATUS.go || overallStatus === STATUS.caution) overallStatus = STATUS.blocked;
    } else if (gateResult.result === 'caution') {
      cautions.push(...gateResult.details.map(d => `[${gateResult.label}] ${d}`));
      if (overallStatus === STATUS.go) overallStatus = STATUS.caution;
    }
  }

  // ── 2. Check verify smoke consistency ──────────────────────────────────────

  const smokeIssues = checkVerifySmokeConsistency(pkgMeta.verifySmokes, pkgMeta.smokeEntries, smokeFilesOnDisk, repoRoot);
  if (smokeIssues.length > 0) {
    for (const si of smokeIssues) {
      checkedGates.push({ key: `smoke_${si.key}`, label: `Smoke: ${si.key}`, version: '', result: 'blocked', items: [], details: [si.detail] });
      blockedReasons.push(`[SMOKE CONSISTENCY] ${si.detail}`);
    }
    if (overallStatus === STATUS.go || overallStatus === STATUS.caution) overallStatus = STATUS.blocked;
  }

  // ── 3. Check version match ────────────────────────────────────────────────

  if (pkgMeta.version && normalizeVersion(pkgMeta.version) !== normalizeVersion(targetVersion)) {
    const detail = `package.json version "${pkgMeta.version}" が targetVersion "${targetVersion}" と一致しません`;
    checkedGates.push({ key: 'version_match', label: 'Version Match', version: targetVersion, result: 'blocked', items: [], details: [detail] });
    blockedReasons.push(`[VERSION MISMATCH] ${detail}`);
    if (overallStatus === STATUS.go || overallStatus === STATUS.caution) overallStatus = STATUS.blocked;
  }

  // ── 4. Danger gates ─────────────────────────────────────────────────────────

  const ctx = {
    changedFiles:     request.changedFiles || [],
    untrackedFiles:   request.untrackedFiles || [],
    smokeEntries:     pkgMeta.smokeEntries,
    smokeFilesOnDisk,
    verifySmokes:     pkgMeta.verifySmokes,
    repoRoot,
    liveMode:         request.liveMode,
    realApiCall:      request.realApiCall,
    realDeploy:       request.realDeploy,
    realBilling:      request.realBilling,
    iamMutation:      request.iamMutation,
    schedulerChange:  request.schedulerChange,
    highCostModel:    request.highCostModel,
    humanApproved:    request.humanApproved,
    externalWorker:   request.externalWorker,
    sanitizedOnly:    request.sanitizedOnly,
  };

  const triggeredDangerGates = checkDangerGates(ctx);
  for (const dg of triggeredDangerGates) {
    dangerGates.push(dg);
    checkedGates.push({ key: `danger_${dg.id}`, label: dg.label, version: '', result: 'human_gate', items: [], details: [dg.reason] });
    humanGateItems.push({ id: dg.id, label: dg.label, reason: dg.reason });
    blockedReasons.push(`[DANGER GATE] ${dg.reason}`);
  }

  // ── 5. Determine final status ─────────────────────────────────────────────

  let humanApprovalRequired = false;
  let nextAllowedAction;

  if (humanGateItems.length > 0) {
    overallStatus = STATUS.human_gate;
    humanApprovalRequired = true;
    nextAllowedAction = 'request_human_approval_then_remove_dangerous_items';
  } else if (blockedReasons.length > 0) {
    overallStatus = STATUS.blocked;
    nextAllowedAction = 'fix_blocked_items_and_rerun_readiness_board';
  } else if (cautions.length > 0) {
    overallStatus = STATUS.caution;
    nextAllowedAction = 'review_cautions_then_proceed_to_release';
  } else {
    overallStatus = STATUS.go;
    nextAllowedAction = 'proceed_to_release';
  }

  // ── 6. Build result ──────────────────────────────────────────────────────

  return {
    tool:                  TOOL_META.slug,
    version:               TOOL_META.version,
    timestamp:             new Date().toISOString(),
    dryRun:                true,
    releaseCandidateVersion: normalizeVersion(targetVersion),
    status:                overallStatus,
    checkedGates:          checkedGates.map(g => ({
      key:    g.key,
      label:  g.label,
      result: g.result,
      ...(g.version ? { version: g.version } : {}),
      ...(g.items.length ? { checks: g.items } : {}),
      ...(g.details.length ? { details: g.details } : {}),
    })),
    blockedReasons,
    cautions,
    humanGateItems,
    nextAllowedAction,
    recommendedCommand: overallStatus === STATUS.go
      ? `git tag v${normalizeVersion(targetVersion)} && git push origin main v${normalizeVersion(targetVersion)}`
      : 'fix issues before release',
    releaseReadiness: {
      status:           overallStatus,
      hasBlocked:       blockedReasons.length > 0,
      hasCaution:       cautions.length > 0,
      hasHumanGate:     humanGateItems.length > 0,
      nextAllowedAction,
      checkedGateCount: checkedGates.length,
    },
    summaryForDashboard: {
      releaseCandidateVersion: normalizeVersion(targetVersion),
      status:                  overallStatus,
      totalGates:              checkedGates.length,
      passedGates:             checkedGates.filter(g => g.result === 'ok').length,
      cautionGates:            checkedGates.filter(g => g.result === 'caution').length,
      blockedGates:            checkedGates.filter(g => g.result === 'blocked').length,
      humanGateGates:          checkedGates.filter(g => g.result === 'human_gate').length,
      nextAllowedAction,
    },
  };
}

// ── CLI display ───────────────────────────────────────────────────────────────

function printBoard(result) {
  const statusColor = result.status === 'go' ? 'green'
    : result.status === 'caution' ? 'yellow'
    : result.status === 'blocked' ? 'red'
    : 'magenta';
  const statusIcon = result.status === 'go' ? '✓'
    : result.status === 'caution' ? '⚠'
    : result.status === 'blocked' ? '✗'
    : '⛔';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME Final Release Readiness Board'))}  ${c('cyan', `v${result.version}`)}  ${c('gray', `(${result.timestamp})`)}`);
  console.log(`  ${c('bold', 'Release Candidate:')} ${c('cyan', result.releaseCandidateVersion)}  |  ${c('bold', 'Status:')} ${c(statusColor, `${statusIcon} ${result.status.toUpperCase()}`)}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  // Gates summary
  const summary = result.summaryForDashboard;
  console.log(`  ${c('bold', 'Gates:')}  ${c('green', `${summary.passedGates} pass`)}  ${c('yellow', `${summary.cautionGates} caution`)}  ${c('red', `${summary.blockedGates} blocked`)}  ${c('magenta', `${summary.humanGateGates} human_gate`)}  (${summary.totalGates} total)`);

  // Blocked
  if (result.blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const br of result.blockedReasons) {
      console.log(`    ${c('red', '✗')} ${br}`);
    }
  }

  // Cautions
  if (result.cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const ca of result.cautions) {
      console.log(`    ${c('yellow', '⚠')} ${ca}`);
    }
  }

  // Human gate
  if (result.humanGateItems.length > 0) {
    console.log(`\n  ${c('bold', c('magenta', 'HUMAN GATE'))}`);
    for (const hg of result.humanGateItems) {
      console.log(`    ${c('magenta', '⛔')} ${hg.label}: ${hg.reason}`);
    }
  }

  // Gate detail
  console.log(`\n  ${c('bold', 'Gate Details')}`);
  for (const g of result.checkedGates) {
    const gColor = g.result === 'ok' ? 'green' : g.result === 'caution' ? 'yellow' : g.result === 'blocked' ? 'red' : 'magenta';
    const gIcon = g.result === 'ok' ? '✓' : g.result === 'caution' ? '⚠' : g.result === 'blocked' ? '✗' : '⛔';
    console.log(`    ${c(gColor, gIcon)} ${g.label}${g.version ? ` ${c('gray', `(${g.version})`)}` : ''} — ${c(gColor, g.result.toUpperCase())}`);
    if (g.details && g.details.length > 0) {
      for (const d of g.details) {
        console.log(`      ${c('gray', d)}`);
      }
    }
  }

  console.log(`\n  ${c('bold', c('blue', '╡ End of Readiness Board'))} ${c('gray', `${result.checkedGates.length} gates checked`)}`);
  console.log('');
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => { const p = `--${name}=`; const a = args.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  return {
    targetVersion:  get('target-version') || TOOL_META.version,
    json:            args.includes('--json'),
    repoRoot:        get('repo-root') || process.cwd(),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = buildReleaseReadinessBoard({
    targetVersion: cliArgs.targetVersion,
    repoRoot:      cliArgs.repoRoot,
  });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printBoard(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  GATE_DEFS,
  buildReleaseReadinessBoard,
  printBoard,
};
