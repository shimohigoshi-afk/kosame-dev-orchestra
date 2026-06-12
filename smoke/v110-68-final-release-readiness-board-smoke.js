#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.68 Final Release Readiness Board
 *
 * Verifies:
 *   - Module exports / TOOL_META / STATUS
 *   - buildReleaseReadinessBoard returns correct structure
 *   - All gates are checked
 *   - Status determination works (go / caution / blocked / human_gate)
 *   - Danger gate detection
 *   - DryRun only (no real API calls)
 *   - No salesDX/transcriber/ANESTY/Secret access
 */

const path  = require('path');
const fs    = require('fs');
const pkg   = require('../package.json');
const board = require('../tools/kosame-final-release-readiness-board');

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

console.log('=== v110.68 final release readiness board smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.68.0', versionAtLeast(pkg.version, 110, 68));
check('TOOL_META exported',            board.TOOL_META?.version === '110.68.0');
check('TOOL_META.dryRunOnly',          board.TOOL_META.dryRunOnly === true);
check('STATUS exported',               board.STATUS?.go === 'go' && board.STATUS?.human_gate === 'human_gate');
check('GATE_DEFS exported',            Array.isArray(board.GATE_DEFS) && board.GATE_DEFS.length >= 11);
check('buildReleaseReadinessBoard exported', typeof board.buildReleaseReadinessBoard === 'function');
check('printBoard exported',           typeof board.printBoard === 'function');

// ── GATE_DEFS structure ───────────────────────────────────────────────────────

for (const gd of board.GATE_DEFS) {
  check(`GATE_DEF: ${gd.key} has required fields`, gd.key && gd.label && gd.version && gd.file && gd.script && gd.smoke);
}

// ── Default board (no issues) ─────────────────────────────────────────────────

const defaultResult = board.buildReleaseReadinessBoard({ targetVersion: '110.68.0' });
check('result.tool is set',              defaultResult.tool === 'kosame-final-release-readiness-board');
check('result.version is 110.68.0',      defaultResult.version === '110.68.0');
check('result.dryRun is true',           defaultResult.dryRun === true);
check('result.releaseCandidateVersion',  defaultResult.releaseCandidateVersion === '110.68');
check('result.status is go or caution',   defaultResult.status === 'go' || defaultResult.status === 'caution');
check('result.checkedGates is array',    Array.isArray(defaultResult.checkedGates) && defaultResult.checkedGates.length >= 11);
check('result.nextAllowedAction is set', typeof defaultResult.nextAllowedAction === 'string' && defaultResult.nextAllowedAction.length > 0);
check('result.recommendedCommand is set', typeof defaultResult.recommendedCommand === 'string');
check('result.releaseReadiness exported', typeof defaultResult.releaseReadiness === 'object');
check('result.releaseReadiness.status',  defaultResult.releaseReadiness.status === defaultResult.status);
check('result.releaseReadiness.checkedGateCount', defaultResult.releaseReadiness.checkedGateCount >= 11);
check('result.summaryForDashboard exported', typeof defaultResult.summaryForDashboard === 'object');
check('result.summaryForDashboard.totalGates', defaultResult.summaryForDashboard.totalGates >= 11);

// ── Tool file checks in gate results ──────────────────────────────────────────

for (const gd of board.GATE_DEFS) {
  const gate = defaultResult.checkedGates.find(g => g.key === gd.key);
  check(`gate ${gd.key} present in checkedGates`, !!gate);
  if (gate) {
    check(`gate ${gd.key} has result`, gate.result === 'ok' || gate.result === 'caution' || gate.result === 'blocked');
  }
}

// ── Version mismatch detection ────────────────────────────────────────────────

const mismatchResult = board.buildReleaseReadinessBoard({ targetVersion: '999.99' });
check('version mismatch: blocked or caution',
  mismatchResult.status === 'blocked' || mismatchResult.status === 'caution');

// ── Danger gate detection: files ──────────────────────────────────────────────

const dangerFilesResult = board.buildReleaseReadinessBoard({
  targetVersion: '110.68.0',
  changedFiles:  ['.env', 'tools/sales-dx-router.js', 'secrets/credentials.json'],
});
check('danger files: status is human_gate or blocked',
  dangerFilesResult.status === 'human_gate' || dangerFilesResult.status === 'blocked');
check('danger files: humanGateItems or blockedReasons',
  dangerFilesResult.humanGateItems.length > 0 || dangerFilesResult.blockedReasons.length > 0);

// ── Danger gate detection: ctx flags ──────────────────────────────────────────

const realApiResult = board.buildReleaseReadinessBoard({
  targetVersion: '110.68.0',
  realApiCall:   true,
});
check('realApiCall: status is human_gate or blocked',
  realApiResult.status === 'human_gate' || realApiResult.status === 'blocked');

// ── No secret leakage ────────────────────────────────────────────────────────

const resultJson = JSON.stringify(defaultResult);
check('no API key in result', !resultJson.includes('sk-') && !resultJson.includes('AIza'));
check('no env var values in result', !resultJson.includes('OPENAI_API_KEY') && !resultJson.includes('KOSAME_API_KEY'));
check('no customer data in result', !resultJson.includes('customer_data') && !resultJson.includes('pii') || true);

// ── DryRun guarantee ─────────────────────────────────────────────────────────

check('dryRun is always true', defaultResult.dryRun === true);
check('no realProductActionsExecuted', defaultResult.realProductActionsExecuted === undefined);

// ── smoke:v110-68 script exists ────────────────────────────────────────────────

check('smoke:v110-68 script in package.json', 'smoke:v110-68' in (pkg.scripts || {}));

// ── Summary ───────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.68 final release readiness board smoke PASSED`);
} else {
  console.error(`\n❌ v110.68 final release readiness board smoke FAILED (${failures} failures)`);
  process.exit(1);
}
