#!/usr/bin/env node
'use strict';

/**
 * KOSAME OS Semi-Auto Release Gate v110.70.0
 *
 * v110.68 Final Release Readiness Board の結果を受け取り、
 * verify / smoke / danger gate / human gate / cost gate / provider health
 * を統合して最終リリース可否を判定するゲート。
 *
 * 【制約】
 *   - 実API呼び出し不可（dryRun / mock / config inspection のみ）
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board / 顧客情報には触れない
 *   - 実 deploy / IAM / Scheduler 変更はしない
 *
 * Usage:
 *   node tools/kosame-semi-auto-release-gate.js
 *   node tools/kosame-semi-auto-release-gate.js --json
 *   node tools/kosame-semi-auto-release-gate.js --target-version=110.70
 */

const fs   = require('fs');
const path = require('path');
const readinessBoard = require('./kosame-final-release-readiness-board');

const TOOL_META = {
  version:       '110.70.0',
  feature:       'v110-70-semi-auto-release-gate',
  slug:          'kosame-semi-auto-release-gate',
  dryRunOnly:    true,
};

const STATUS = {
  go:         'go',
  no_go:      'no_go',
  caution:    'caution',
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

// ── Check categories ───────────────────────────────────────────────────────────

const CHECK_CATEGORIES = [
  {
    key: 'board_status',
    label: 'Readiness Board Status',
    check: (boardResult) => {
      if (boardResult.status === 'human_gate') return { result: 'human_gate', detail: 'Readiness Board が HUMAN_GATE を検出' };
      if (boardResult.status === 'blocked')   return { result: 'blocked', detail: `Readiness Board が ${boardResult.blockedReasons.length} 件の BLOCKED を検出` };
      if (boardResult.status === 'caution')   return { result: 'caution', detail: `Readiness Board が ${boardResult.cautions.length} 件の CAUTION を検出` };
      return { result: 'ok' };
    },
  },
  {
    key: 'verify_chain',
    label: 'Verify Chain Consistency',
    check: (boardResult, pkgMeta) => {
      const verifyLine = pkgMeta.verifyRaw || '';
      if (!verifyLine.includes('smoke:v110-70')) {
        return { result: 'caution', detail: 'smoke:v110-70 not in verify chain' };
      }
      return { result: 'ok' };
    },
  },
  {
    key: 'smoke_file_exists',
    label: 'All Smoke Files Exist',
    check: (_br, pkgMeta) => {
      const missing = [];
      for (const gd of readinessBoard.GATE_DEFS) {
        const smokePath = path.resolve(process.cwd(), gd.smoke);
        if (!fs.existsSync(smokePath)) missing.push(gd.smoke);
      }
      if (missing.length > 0) return { result: 'blocked', detail: `${missing.length} smoke files missing: ${missing.join(', ')}` };
      return { result: 'ok' };
    },
  },
  {
    key: 'danger_gates',
    label: 'Danger Gate Check',
    check: (boardResult) => {
      if (boardResult.humanGateItems && boardResult.humanGateItems.length > 0) {
        return { result: 'human_gate', detail: boardResult.humanGateItems.map(h => h.label).join('; ') };
      }
      if (boardResult.blockedReasons && boardResult.blockedReasons.length > 0) {
        const dangerBlocks = boardResult.blockedReasons.filter(r => r.startsWith('[DANGER'));
        if (dangerBlocks.length > 0) return { result: 'blocked', detail: dangerBlocks.join('; ') };
      }
      return { result: 'ok' };
    },
  },
  {
    key: 'human_gate',
    label: 'Human Gate Required',
    check: (boardResult) => {
      if (boardResult.humanGateItems && boardResult.humanGateItems.length > 0) {
        return { result: 'human_gate', detail: `${boardResult.humanGateItems.length} human gate items pending` };
      }
      if (boardResult.releaseReadiness && boardResult.releaseReadiness.hasHumanGate) {
        return { result: 'human_gate', detail: 'human_gate flagged by readiness board' };
      }
      return { result: 'ok' };
    },
  },
  {
    key: 'cost_gate',
    label: 'Cost Gate Check',
    check: () => {
      const budgetRouterPath = path.resolve(process.cwd(), 'tools/kosame-provider-budget-bucket-router.js');
      if (!fs.existsSync(budgetRouterPath)) return { result: 'caution', detail: 'budget bucket router not found' };
      try {
        const budgetRouter = require('./kosame-provider-budget-bucket-router');
        const catalog = budgetRouter.PROVIDER_CATALOG || {};
        const expensiveModels = Object.values(catalog).filter(p => p.budgetBucket === 'high_cost_human_approval');
        if (expensiveModels.length > 0) {
          return { result: 'caution', detail: `${expensiveModels.length} high-cost providers registered` };
        }
        return { result: 'ok' };
      } catch { return { result: 'caution', detail: 'budget bucket router load failed' }; }
    },
  },
  {
    key: 'provider_health',
    label: 'Provider Health Check',
    check: () => {
      const healthPath = path.resolve(process.cwd(), 'tools/kosame-provider-availability-health-snapshot.js');
      if (!fs.existsSync(healthPath)) return { result: 'caution', detail: 'health snapshot not found' };
      try {
        const health = require('./kosame-provider-availability-health-snapshot');
        if (typeof health.buildProviderAvailabilityHealthSnapshot !== 'function') {
          return { result: 'caution', detail: 'health snapshot function not exported' };
        }
        const result = health.buildProviderAvailabilityHealthSnapshot(
          { id: 'release-gate-check', title: 'release gate provider health check', difficulty: 'light' },
          { dryRun: true }
        );
        const blocked = (result.providers || []).filter(p => p.state === 'blocked');
        if (blocked.length > 0) {
          return { result: 'caution', detail: `${blocked.length} providers blocked` };
        }
        return { result: 'ok' };
      } catch { return { result: 'caution', detail: 'provider health check failed' }; }
    },
  },
  {
    key: 'version_consistency',
    label: 'Version Consistency',
    check: (_br, pkgMeta) => {
      const pkgVersion = pkgMeta.version || '';
      const gateVersion = TOOL_META.version;
      if (!pkgVersion || pkgVersion.split('.').slice(0, 2).join('.') !== gateVersion.split('.').slice(0, 2).join('.')) {
        return { result: 'caution', detail: `package.json ${pkgVersion} != gate ${gateVersion}` };
      }
      return { result: 'ok' };
    },
  },
];

// ── Main gate builder ──────────────────────────────────────────────────────────

function buildReleaseGate(request = {}) {
  const targetVersion = request.targetVersion || TOOL_META.version;
  const repoRoot = request.repoRoot || process.cwd();

  // Read package.json meta
  const pkgPath = path.join(repoRoot, 'package.json');
  let pkgMeta = { version: '', verifyRaw: '' };
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkgMeta = { version: String(pkg.version || ''), verifyRaw: String(pkg.scripts?.verify || '') };
  } catch {}

  // Run readiness board
  const boardRequest = {
    targetVersion,
    repoRoot,
    changedFiles:     request.changedFiles || [],
    untrackedFiles:   request.untrackedFiles || [],
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

  const boardResult = readinessBoard.buildReleaseReadinessBoard(boardRequest);

  // Run all checks
  const checkedItems = [];
  let humanGate = false;
  let hasBlocked = false;
  let hasCaution = false;

  for (const cc of CHECK_CATEGORIES) {
    const checkResult = cc.check(boardResult, pkgMeta);
    checkedItems.push({
      key:    cc.key,
      label:  cc.label,
      result: checkResult.result,
      ...(checkResult.detail ? { detail: checkResult.detail } : {}),
    });
    if (checkResult.result === 'human_gate') humanGate = true;
    if (checkResult.result === 'blocked')     hasBlocked = true;
    if (checkResult.result === 'caution')     hasCaution = true;
  }

  // Include board items in gate items
  for (const g of boardResult.checkedGates || []) {
    checkedItems.push({
      key:    `board_${g.key}`,
      label:  g.label,
      result: g.result === 'go' ? 'ok' : g.result,
      ...(g.version  ? { version: g.version } : {}),
      ...(g.details?.length ? { detail: g.details.join('; ') } : {}),
    });
    if (g.result === 'human_gate') humanGate = true;
    if (g.result === 'blocked')     hasBlocked = true;
    if (g.result === 'caution')     hasCaution = true;
  }

  // Collect blocked reasons
  const blockedReasons = checkedItems
    .filter(i => i.result === 'blocked')
    .map(i => `[${i.label}] ${i.detail || 'blocked'}`);

  const cautions = checkedItems
    .filter(i => i.result === 'caution')
    .map(i => `[${i.label}] ${i.detail || 'caution'}`);

  const humanGateItems = checkedItems
    .filter(i => i.result === 'human_gate')
    .map(i => ({ label: i.label, reason: i.detail || 'human gate required' }));

  // Determine final status
  let status;
  let nextAllowedAction;

  if (humanGate) {
    status = STATUS.human_gate;
    nextAllowedAction = 'request_human_approval_before_release';
  } else if (hasBlocked) {
    status = STATUS.no_go;
    nextAllowedAction = 'fix_blocked_items_and_rerun_release_gate';
  } else if (hasCaution) {
    status = STATUS.caution;
    nextAllowedAction = 'review_cautions_then_proceed';
  } else {
    status = STATUS.go;
    nextAllowedAction = 'proceed_to_release';
  }

  return {
    tool:             TOOL_META.slug,
    version:          TOOL_META.version,
    timestamp:        new Date().toISOString(),
    dryRun:           true,
    releaseCandidateVersion: targetVersion.replace(/^v/i, '').split('.').slice(0, 2).join('.'),
    status,
    boardStatus:      boardResult.status,
    nextAllowedAction,
    checkedItems,
    blockedReasons,
    cautions,
    humanGateItems,
    releaseGate: {
      status,
      hasBlocked,
      hasCaution,
      hasHumanGate: humanGate,
      boardStatus:  boardResult.status,
      boardGatesOk: boardResult.checkedGates.filter(g => g.result === 'ok').length,
      boardGatesTotal: boardResult.checkedGates.length,
      nextAllowedAction,
    },
    summaryForDashboard: {
      releaseCandidateVersion: targetVersion.replace(/^v/i, '').split('.').slice(0, 2).join('.'),
      status,
      totalChecks:   checkedItems.length,
      okChecks:      checkedItems.filter(i => i.result === 'ok').length,
      cautionChecks: checkedItems.filter(i => i.result === 'caution').length,
      blockedChecks: checkedItems.filter(i => i.result === 'blocked').length,
      humanGateChecks: checkedItems.filter(i => i.result === 'human_gate').length,
      nextAllowedAction,
    },
  };
}

// ── CLI display ────────────────────────────────────────────────────────────────

function printReleaseGate(result) {
  const statusColor = result.status === 'go' ? 'green'
    : result.status === 'caution' ? 'yellow'
    : result.status === 'no_go' ? 'red'
    : 'magenta';
  const statusIcon = result.status === 'go' ? '✓'
    : result.status === 'caution' ? '⚠'
    : result.status === 'no_go' ? '✗'
    : '⛔';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME OS Semi-Auto Release Gate'))}  ${c('cyan', `v${result.version}`)}  ${c('gray', `(${result.timestamp})`)}`);
  console.log(`  ${c('bold', 'Release Candidate:')} ${c('cyan', result.releaseCandidateVersion)}  |  ${c('bold', 'Status:')} ${c(statusColor, `${statusIcon} ${result.status.toUpperCase()}`)}`);
  console.log(`  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('bold', 'Board Status:')} ${c(result.boardStatus === 'go' ? 'green' : result.boardStatus === 'caution' ? 'yellow' : result.boardStatus === 'blocked' ? 'red' : 'magenta', result.boardStatus.toUpperCase())}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  // Summary
  const s = result.summaryForDashboard;
  console.log(`  ${c('bold', 'Checks:')}  ${c('green', `${s.okChecks} ok`)}  ${c('yellow', `${s.cautionChecks} caution`)}  ${c('red', `${s.blockedChecks} blocked`)}  ${c('magenta', `${s.humanGateChecks} human_gate`)}  (${s.totalChecks} total)`);

  if (result.blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const br of result.blockedReasons) {
      console.log(`    ${c('red', '✗')} ${br}`);
    }
  }

  if (result.cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const ca of result.cautions) {
      console.log(`    ${c('yellow', '⚠')} ${ca}`);
    }
  }

  if (result.humanGateItems.length > 0) {
    console.log(`\n  ${c('bold', c('magenta', 'HUMAN GATE'))}`);
    for (const hg of result.humanGateItems) {
      console.log(`    ${c('magenta', '⛔')} ${hg.label}: ${hg.reason}`);
    }
  }

  console.log(`\n  ${c('bold', 'Check Details')}`);
  for (const ci of result.checkedItems) {
    const ciColor = ci.result === 'ok' ? 'green' : ci.result === 'caution' ? 'yellow' : ci.result === 'blocked' ? 'red' : 'magenta';
    const ciIcon = ci.result === 'ok' ? '✓' : ci.result === 'caution' ? '⚠' : ci.result === 'blocked' ? '✗' : '⛔';
    console.log(`    ${c(ciColor, ciIcon)} ${ci.label}${ci.version ? ` ${c('gray', `(${ci.version})`)}` : ''} — ${c(ciColor, ci.result.toUpperCase())}${ci.detail ? ` ${c('gray', `— ${ci.detail}`)}` : ''}`);
  }

  console.log(`\n  ${c('bold', c('blue', '╡ End of Release Gate'))} ${c('gray', `${result.checkedItems.length} checks`)}`);
  console.log('');
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => { const p = `--${name}=`; const a = args.find(x => x.startsWith(p)); return a ? a.slice(p.length) : null; };
  return {
    targetVersion: get('target-version') || TOOL_META.version,
    json:          args.includes('--json'),
    repoRoot:      get('repo-root') || process.cwd(),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = buildReleaseGate({ targetVersion: cliArgs.targetVersion, repoRoot: cliArgs.repoRoot });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printReleaseGate(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  CHECK_CATEGORIES,
  buildReleaseGate,
  printReleaseGate,
};
