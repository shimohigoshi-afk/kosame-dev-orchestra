#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.75.3 Pre-Commit Scope Check
 *
 * 5ケース (fixture/mock入力で実git状態に依存しない):
 *   1. allowedFilesのみ → SAFE
 *   2. unexpected fileあり → BLOCKED
 *   3. existing tag conflict → BLOCKED
 *   4. package version mismatch → CAUTION/BLOCKED
 *   5. unstaged allowed fileあり → CAUTION
 *
 * 全smoke共通確認:
 *   - dryRun === true
 *   - humanGateRequired is boolean
 */

const pkg = require('../package.json');
const checker = require('../tools/kosame-pre-commit-scope-check');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function versionAtLeast(v, major, minor) {
  const parts = String(v).split('.').map(Number);
  return parts[0] > major || (parts[0] === major && parts[1] >= minor);
}

console.log('=== v110.75.3 pre-commit scope check smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.75',   versionAtLeast(pkg.version, 110, 75));
check('TOOL_META exported',            checker.TOOL_META?.version === '110.75.3');
check('TOOL_META.dryRunOnly',          checker.TOOL_META.dryRunOnly === true);
check('STATUS exported',               checker.STATUS?.SAFE === 'SAFE' && checker.STATUS?.BLOCKED === 'BLOCKED');
check('checkScope exported',           typeof checker.checkScope === 'function');
check('createMockInput exported',      typeof checker.createMockInput === 'function');

// ── Smoke 1: allowedFilesのみ → SAFE ────────────────────────────────────────

const r1 = checker.checkScope(checker.createMockInput({
  targetVersion: '110.75.3',
  allowedFiles: ['package.json', 'tools/foo.js', 'smoke/foo-smoke.js'],
  stagedFiles:  ['package.json', 'tools/foo.js', 'smoke/foo-smoke.js'],
  packageVersion: '110.75.3',
}));
check('r1: status SAFE',              r1.status === 'SAFE');
check('r1: canCommit true',           r1.canCommit === true);
check('r1: canTag true',              r1.canTag === true);
check('r1: no unexpected',            r1.unexpectedFiles.length === 0);
check('r1: no tag conflict',          r1.existingTagConflict === false);
check('r1: version matches',          r1.packageVersionMatches === true);
check('r1: dryRun true',              r1.dryRun === true);
check('r1: humanGateRequired',        r1.humanGateRequired === false);

// ── Smoke 2: unexpected fileあり → BLOCKED ─────────────────────────────────

const r2 = checker.checkScope(checker.createMockInput({
  targetVersion: '110.75.3',
  allowedFiles: ['package.json'],
  stagedFiles:  ['package.json', 'tools/unexpected.js'],
  packageVersion: '110.75.3',
}));
check('r2: status BLOCKED',           r2.status === 'BLOCKED');
check('r2: canCommit false',          r2.canCommit === false);
check('r2: unexpected found',         r2.unexpectedFiles.length > 0);
check('r2: blockedReasons > 0',       r2.blockedReasons.length > 0);
check('r2: humanGateRequired true',   r2.humanGateRequired === true);

// ── Smoke 3: existing tag conflict → BLOCKED ────────────────────────────────

const r3 = checker.checkScope(checker.createMockInput({
  targetVersion: '110.75.2',  // exists in mock existingTags
  allowedFiles: ['package.json'],
  stagedFiles:  ['package.json'],
  existingTags: ['v110.75.0', 'v110.75.1', 'v110.75.2', 'v110.75.3'],
  packageVersion: '110.75.3',
}));
check('r3: status CAUTION or BLOCKED',['CAUTION','BLOCKED'].includes(r3.status));
check('r3: canTag false',             r3.canTag === false);
check('r3: tag conflict detected',    r3.existingTagConflict === true);
check('r3: canCommit true',           r3.canCommit === true);  // tag conflict should not block commit

// ── Smoke 4: package version mismatch → CAUTION ─────────────────────────────

const r4 = checker.checkScope(checker.createMockInput({
  targetVersion: '110.75.3',
  allowedFiles: ['package.json'],
  stagedFiles:  ['package.json'],
  packageVersion: '110.75.2',  // mismatch
}));
check('r4: status CAUTION',           r4.status === 'CAUTION');
check('r4: version mismatch',         r4.packageVersionMatches === false);
check('r4: canCommit true',           r4.canCommit === true);
check('r4: cautions > 0',             r4.cautions.length > 0);

// ── Smoke 5: unstaged allowed file → CAUTION ───────────────────────────────

const r5 = checker.checkScope(checker.createMockInput({
  targetVersion: '110.75.3',
  allowedFiles: ['package.json', 'tools/foo.js'],
  stagedFiles:  ['package.json'],
  unstagedFiles: ['tools/foo.js'],  // allowed but not staged
  packageVersion: '110.75.3',
}));
check('r5: status CAUTION or SAFE',   ['CAUTION', 'SAFE'].includes(r5.status));
check('r5: canCommit true',           r5.canCommit === true);
check('r5: no blocked',               r5.status !== 'BLOCKED');

// ── DryRun consistency ──────────────────────────────────────────────────────

for (const [label, r] of [['r1', r1], ['r2', r2], ['r3', r3], ['r4', r4], ['r5', r5]]) {
  check(`${label}: dryRun true`,                  r.dryRun === true);
  check(`${label}: humanGateRequired is boolean`, typeof r.humanGateRequired === 'boolean');
}

// ── No secret leakage ───────────────────────────────────────────────────────

const allJson = JSON.stringify([r1, r2, r3, r4, r5]);
check('no API key in output',         !allJson.includes('sk-') && !allJson.includes('AIza'));
check('no salesDX in output',         !allJson.includes('salesDX') && !allJson.includes('transcriber'));
check('no ANESTY Board in output',    !allJson.includes('ANESTY'));

// ── smoke:v110-75-3 script exists ──────────────────────────────────────────

check('smoke:v110-75-3 script in package.json', 'smoke:v110-75-3' in (pkg.scripts || {}));

// ── Summary ──────────────────────────────────────────────────────────────────

if (failures === 0) {
  console.log(`\n✅ v110.75.3 pre-commit scope check smoke PASSED`);
} else {
  console.error(`\n❌ v110.75.3 pre-commit scope check smoke FAILED (${failures} failures)`);
  process.exit(1);
}
