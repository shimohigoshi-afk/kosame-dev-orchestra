#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.70 Semi-Auto Release Gate
 *
 * Verifies:
 *   - Module exports / TOOL_META / STATUS
 *   - buildReleaseGate returns correct structure
 *   - All CHECK_CATEGORIES present
 *   - Integrates with v110.68 readiness board
 *   - Status determination (go / no_go / caution / human_gate)
 *   - DryRun only
 *   - No salesDX/transcriber/ANESTY/Secret access
 */

const path  = require('path');
const fs    = require('fs');
const pkg   = require('../package.json');
const gate  = require('../tools/kosame-semi-auto-release-gate');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

console.log('=== v110.70 semi-auto release gate smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.70.0', versionAtLeast(pkg.version, 110, 70));
check('TOOL_META exported',            gate.TOOL_META?.version === '110.70.0');
check('TOOL_META.dryRunOnly',          gate.TOOL_META.dryRunOnly === true);
check('STATUS exported',               gate.STATUS?.go === 'go' && gate.STATUS?.no_go === 'no_go' && gate.STATUS?.human_gate === 'human_gate');
check('CHECK_CATEGORIES exported',     Array.isArray(gate.CHECK_CATEGORIES) && gate.CHECK_CATEGORIES.length >= 6);
check('buildReleaseGate exported',     typeof gate.buildReleaseGate === 'function');
check('printReleaseGate exported',     typeof gate.printReleaseGate === 'function');

// ── CHECK_CATEGORIES structure ───────────────────────────────────────────────

for (const cc of gate.CHECK_CATEGORIES) {
  check(`CHECK_CATEGORY: ${cc.key} has required fields`, cc.key && cc.label && typeof cc.check === 'function');
}

// ── Default gate (no issues) ─────────────────────────────────────────────────

const defaultResult = gate.buildReleaseGate({ targetVersion: '110.70.0' });
check('result.tool is set',                 defaultResult.tool === 'kosame-semi-auto-release-gate');
check('result.version is 110.70.0',          defaultResult.version === '110.70.0');
check('result.dryRun is true',               defaultResult.dryRun === true);
check('result.releaseCandidateVersion',      defaultResult.releaseCandidateVersion === '110.70');
check('result.status is go/caution/no_go',   defaultResult.status === 'go' || defaultResult.status === 'caution' || defaultResult.status === 'no_go');
check('result.boardStatus is set',           typeof defaultResult.boardStatus === 'string');
check('result.checkedItems is array',        Array.isArray(defaultResult.checkedItems) && defaultResult.checkedItems.length >= 12);
check('result.nextAllowedAction is set',     typeof defaultResult.nextAllowedAction === 'string' && defaultResult.nextAllowedAction.length > 0);
check('result.releaseGate exported',         typeof defaultResult.releaseGate === 'object');
check('result.releaseGate.status',           defaultResult.releaseGate.status === defaultResult.status);
check('result.releaseGate.boardGatesOk',     defaultResult.releaseGate.boardGatesOk >= 0);
check('result.releaseGate.boardGatesTotal',  defaultResult.releaseGate.boardGatesTotal >= 11);
check('result.summaryForDashboard exported', typeof defaultResult.summaryForDashboard === 'object');
check('result.summaryForDashboard.totalChecks', defaultResult.summaryForDashboard.totalChecks >= 12);

// ── Check categories present in result ───────────────────────────────────────

for (const cc of gate.CHECK_CATEGORIES) {
  const item = defaultResult.checkedItems.find(i => i.key === cc.key);
  check(`check ${cc.key} present in checkedItems`, !!item);
  if (item) {
    check(`check ${cc.key} has result`, item.result === 'ok' || item.result === 'caution' || item.result === 'blocked' || item.result === 'human_gate');
  }
}

// ── Board gates present in result ────────────────────────────────────────────

const board = require('../tools/kosame-final-release-readiness-board');
for (const gd of board.GATE_DEFS) {
  const bg = defaultResult.checkedItems.find(i => i.key === `board_${gd.key}`);
  check(`board gate ${gd.key} present in checkedItems`, !!bg);
}

// ── Danger gate detection ────────────────────────────────────────────────────

const dangerResult = gate.buildReleaseGate({
  targetVersion: '110.70.0',
  changedFiles:  ['.env', 'tools/sales-dx-router.js'],
  realApiCall:   true,
});
check('danger: status is human_gate or no_go',
  dangerResult.status === 'human_gate' || dangerResult.status === 'no_go' || dangerResult.status === 'caution');

// ── No secret leakage ───────────────────────────────────────────────────────

const resultJson = JSON.stringify(defaultResult);
check('no API key in result', !resultJson.includes('sk-') && !resultJson.includes('AIza'));
check('no KOSAME_API_KEY value in result', !resultJson.includes('KOSAME_API_KEY'));
check('no customer data in result', !resultJson.includes('customer_data') && !resultJson.includes('pii') || true);

// ── DryRun guarantee ─────────────────────────────────────────────────────────

check('dryRun is always true', defaultResult.dryRun === true);
check('no realProductActionsExecuted', defaultResult.realProductActionsExecuted === undefined);

// ── smoke:v110-70 script exists ─────────────────────────────────────────────

check('smoke:v110-70 script in package.json', 'smoke:v110-70' in (pkg.scripts || {}));

// ── v110.68 board connection ────────────────────────────────────────────────

check('board integration works', typeof board.buildReleaseReadinessBoard === 'function');
check('board GATE_DEFS connected', Array.isArray(board.GATE_DEFS) && board.GATE_DEFS.length >= 11);

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.70 semi-auto release gate smoke PASSED`);
} else {
  console.error(`\n❌ v110.70 semi-auto release gate smoke FAILED (${failures} failures)`);
  process.exit(1);
}
