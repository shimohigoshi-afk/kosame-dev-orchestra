#!/usr/bin/env node
'use strict';

const pkg   = require('../package.json');
const guard = require('../tools/kosame-parallel-agent-merge-guard');

let failures = 0;

function check(name, condition, details = '') {
  if (condition) {
    console.log(`  PASS: ${name}`);
    return;
  }
  failures += 1;
  console.log(`  FAIL: ${name}${details ? ` (${details})` : ''}`);
}

function includesText(value, fragment) {
  if (Array.isArray(value)) return value.some(v => includesText(v, fragment));
  return String(value || '').toLowerCase().includes(String(fragment || '').toLowerCase());
}

function versionAtLeast(version, major, minor) {
  const [majorPart = 0, minorPart = 0] = String(version).split('.').map(Number);
  return majorPart > major || (majorPart === major && minorPart >= minor);
}

console.log('=== v110.67 parallel agent merge guard smoke ===');

// ── Module shape ──────────────────────────────────────────────────────────────

check('package version >= 110.67.0', versionAtLeast(pkg.version, 110, 67));
check('TOOL_META exported',            guard.TOOL_META?.version === '110.67.0');
check('STATUS exported',               guard.STATUS?.safe === 'safe' && guard.STATUS?.human_gate === 'human_gate');
check('DANGER_FILE_PATTERNS exported', Array.isArray(guard.DANGER_FILE_PATTERNS) && guard.DANGER_FILE_PATTERNS.length >= 4);
check('DANGER_CONTENT_PATTERNS exported', Array.isArray(guard.DANGER_CONTENT_PATTERNS) && guard.DANGER_CONTENT_PATTERNS.length >= 3);
check('DEFAULT_VERSION_OWNERS exported', typeof guard.DEFAULT_VERSION_OWNERS === 'object');
check('buildMergeGuardResult exported', typeof guard.buildMergeGuardResult === 'function');
check('readPackageJsonMeta exported',   typeof guard.readPackageJsonMeta === 'function');
check('listSmokeFilesOnDisk exported',  typeof guard.listSmokeFilesOnDisk === 'function');
check('checkSmokeConsistency exported', typeof guard.checkSmokeConsistency === 'function');
check('checkVersionOwnership exported', typeof guard.checkVersionOwnership === 'function');
check('checkTagCollision exported',     typeof guard.checkTagCollision === 'function');
check('checkVersionMismatch exported',  typeof guard.checkVersionMismatch === 'function');
check('checkOutOfScopeVersion exported', typeof guard.checkOutOfScopeVersion === 'function');
check('checkUntrackedRequired exported', typeof guard.checkUntrackedRequired === 'function');
check('checkCommitMessage exported',    typeof guard.checkCommitMessage === 'function');
check('isBroadStaging exported',        typeof guard.isBroadStaging === 'function');
check('scanFilesForDanger exported',    typeof guard.scanFilesForDanger === 'function');
check('scanTextForDanger exported',     typeof guard.scanTextForDanger === 'function');

// ── isBroadStaging ────────────────────────────────────────────────────────────

check('few files: not broad staging', guard.isBroadStaging(['tools/foo.js', 'smoke/foo-smoke.js', 'package.json']).triggered === false);
check('31 files: triggers broad staging', guard.isBroadStaging(Array.from({ length: 31 }, (_, i) => `tools/f${i}.js`)).triggered === true);
check('11 smoke files: triggers broad staging', guard.isBroadStaging(Array.from({ length: 11 }, (_, i) => `smoke/s${i}-smoke.js`)).triggered === true);

// ── scanFilesForDanger ────────────────────────────────────────────────────────

check('.env triggers danger', guard.scanFilesForDanger(['.env']).some(d => d.id === 'env_credentials'));
check('credentials.json triggers danger', guard.scanFilesForDanger(['credentials.json']).some(d => d.id === 'env_credentials'));
check('sales-dx.js triggers danger', guard.scanFilesForDanger(['tools/sales-dx-router.js']).some(d => d.id === 'sales_dx'));
check('anesty-board.js triggers danger', guard.scanFilesForDanger(['tools/anesty-board.js']).some(d => d.id === 'anesty_board'));
check('safe file: no danger', guard.scanFilesForDanger(['tools/kosame-parallel-agent-merge-guard.js']).length === 0);

// ── scanTextForDanger ─────────────────────────────────────────────────────────

check('sales DX in text triggers danger', guard.scanTextForDanger('営業DX update').some(d => d.id === 'sales_dx_text'));
check('ANESTY Board in text triggers danger', guard.scanTextForDanger('ANESTY Board access').some(d => d.id === 'anesty_board_text'));
check('api_key in text triggers danger', guard.scanTextForDanger('api_key = "abc"').some(d => d.id === 'secret_text'));
check('safe text: no danger', guard.scanTextForDanger('v110.67 Add Parallel Agent Merge Guard').length === 0);

// ── checkVersionOwnership ─────────────────────────────────────────────────────

check('claude owns 110.67', guard.checkVersionOwnership('110.67', 'claude', {}).ok === true);
check('gpt owns 110.66', guard.checkVersionOwnership('110.66', 'gpt', {}).ok === true);
check('claude trying 110.66 → collision', (() => {
  const r = guard.checkVersionOwnership('110.66', 'claude', {});
  return r.ok === false && r.collision === true;
})());
check('gpt trying 110.67 → collision', guard.checkVersionOwnership('110.67', 'gpt', {}).ok === false);
check('override reservedVersions works', guard.checkVersionOwnership('110.99', 'grok', { '110.99': 'grok' }).ok === true);
check('unknown version: no collision', guard.checkVersionOwnership('110.99', 'claude', {}).ok === true);
check('v prefix normalized', guard.checkVersionOwnership('v110.67', 'claude', {}).ok === true);
check('3-part version normalized', guard.checkVersionOwnership('110.67.0', 'claude', {}).ok === true);

// ── checkTagCollision ─────────────────────────────────────────────────────────

check('new tag: no collision', guard.checkTagCollision('v110.67', ['v110.63', 'v110.65']).ok === true);
check('existing tag: collision', guard.checkTagCollision('v110.65', ['v110.63', 'v110.65']).ok === false);
check('empty tag candidate: skipped', guard.checkTagCollision('', ['v110.65']).skipped === true);

// ── checkVersionMismatch ──────────────────────────────────────────────────────

check('matching versions: ok', guard.checkVersionMismatch('110.67.0', '110.67').ok === true);
check('mismatched versions: fail', guard.checkVersionMismatch('110.64.1', '110.67').ok === false);
check('empty version: skipped', guard.checkVersionMismatch('', '110.67').skipped === true);
check('3-part pkg, 2-part target: ok', guard.checkVersionMismatch('110.67.0', '110.67.0').ok === true);

// ── checkCommitMessage ────────────────────────────────────────────────────────

check('matching commit message: ok', guard.checkCommitMessage('v110.67 Add Guard', '110.67').ok === true);
check('mismatched commit message: caution', (() => {
  const r = guard.checkCommitMessage('v110.65 Add Something', '110.67');
  return r.ok === false && r.caution === true;
})());
check('empty commit message: skipped', guard.checkCommitMessage('', '110.67').skipped === true);

// ── checkOutOfScopeVersion ────────────────────────────────────────────────────

check('same version file: ok', guard.checkOutOfScopeVersion(['smoke/v110-67-foo.js'], '110.67', 'claude').length === 0);
check('other agent file: caution', (() => {
  const r = guard.checkOutOfScopeVersion(['smoke/v110-66-foo.js'], '110.67', 'claude');
  return r.length > 0 && includesText(r[0], 'v110-66');
})());
check('non-versioned file: ok', guard.checkOutOfScopeVersion(['tools/kosame-foo.js'], '110.67', 'claude').length === 0);

// ── checkSmokeConsistency (v110.64 failure 再発防止) ─────────────────────────

const existingSmokeDir = process.cwd() + '/smoke';
const existingSmoke    = require('fs').readdirSync(existingSmokeDir).map(f => `smoke/${f}`);

// All existing smokes should be on disk
const allSmokeEntries = {};
const allVerifySmokes = [];
for (const f of existingSmoke) {
  const key = 'smoke:' + f.replace('smoke/', '').replace('.js', '').replace('-smoke', '');
  allSmokeEntries[key] = f;
}
const consistencyCheck = guard.checkSmokeConsistency({
  smokeEntries:   allSmokeEntries,
  verifySmokes:   Object.keys(allSmokeEntries).slice(0, 5),
  changedFiles:   [],
  committedFiles: existingSmoke,
  repoRoot:       process.cwd(),
});
check('existing smoke files pass consistency check', consistencyCheck.blocked.length === 0);

// Missing smoke file triggers blocked when in verify
const missingSmokeCheck = guard.checkSmokeConsistency({
  smokeEntries:   { 'smoke:v999-99-nonexistent': 'smoke/v999-99-nonexistent-smoke.js' },
  verifySmokes:   ['smoke:v999-99-nonexistent'],
  changedFiles:   [],
  committedFiles: [],
  repoRoot:       process.cwd(),
});
check('missing smoke in verify → blocked', missingSmokeCheck.blocked.length > 0);
check('missing smoke in verify → mentions MODULE_NOT_FOUND', includesText(missingSmokeCheck.blocked, 'MODULE_NOT_FOUND'));

// Missing smoke NOT in verify → caution only
const missingNotInVerify = guard.checkSmokeConsistency({
  smokeEntries:   { 'smoke:v999-98-nonexistent': 'smoke/v999-98-nonexistent-smoke.js' },
  verifySmokes:   [],
  changedFiles:   [],
  committedFiles: [],
  repoRoot:       process.cwd(),
});
check('missing smoke not in verify → caution only (not blocked)', missingNotInVerify.blocked.length === 0 && missingNotInVerify.cautions.length > 0);

// Smoke file in changedFiles → ok (even if not on disk)
const inChangedFiles = guard.checkSmokeConsistency({
  smokeEntries:   { 'smoke:v999-97-new': 'smoke/v999-97-new-smoke.js' },
  verifySmokes:   ['smoke:v999-97-new'],
  changedFiles:   ['smoke/v999-97-new-smoke.js'],
  committedFiles: [],
  repoRoot:       process.cwd(),
});
check('smoke in changedFiles → ok even if not on disk', inChangedFiles.blocked.length === 0);

// ── checkUntrackedRequired ────────────────────────────────────────────────────

check('no untracked required files: ok', guard.checkUntrackedRequired(
  [],
  ['smoke:v110-67'],
  { 'smoke:v110-67': 'smoke/v110-67-parallel-agent-merge-guard-smoke.js' },
  process.cwd(),
).length === 0);

check('untracked file in verify → blocked', guard.checkUntrackedRequired(
  ['smoke/v110-67-parallel-agent-merge-guard-smoke.js'],
  ['smoke:v110-67'],
  { 'smoke:v110-67': 'smoke/v110-67-parallel-agent-merge-guard-smoke.js' },
  process.cwd(),
).length > 0);

// ── buildMergeGuardResult — safe ──────────────────────────────────────────────

const safeResult = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Parallel Agent Merge Guard',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/kosame-parallel-agent-merge-guard.js', 'smoke/v110-67-parallel-agent-merge-guard-smoke.js', 'package.json'],
  untrackedFiles:     [],
  packageJsonVersion: '110.67.0',
  smokeEntries:       { 'smoke:v110-67': 'smoke/v110-67-parallel-agent-merge-guard-smoke.js' },
  verifySmokes:       ['smoke:v110-67'],
  existingTags:       ['v110.63', 'v110.65'],
  reservedVersions:   { '110.66': 'gpt' },
  committedFiles:     existingSmoke,
  repoRoot:           process.cwd(),
});
check('safe result status is safe', safeResult.status === 'safe');
check('safe result dryRun=true', safeResult.dryRun === true);
check('safe result humanApprovalRequired=false', safeResult.humanApprovalRequired === false);
check('safe result mergeGuard.hasBlocked=false', safeResult.mergeGuard.hasBlocked === false);
check('safe result has checkedFiles', Array.isArray(safeResult.checkedFiles) && safeResult.checkedFiles.length > 0);
check('safe result has mergeGuard.items', Array.isArray(safeResult.mergeGuard.items) && safeResult.mergeGuard.items.length > 0);
check('safe result has version', safeResult.version === '110.67.0');
check('safe result nextAllowedAction mentions commit', includesText(safeResult.nextAllowedAction, 'commit'));
check('safe result humanGateInboxSummary is null', safeResult.humanGateInboxSummary === null);

// ── buildMergeGuardResult — version collision ─────────────────────────────────

const collisionResult = guard.buildMergeGuardResult({
  targetVersion:      '110.66',
  assignedAgent:      'claude',
  commitMessage:      'v110.66 Provider Availability Health Snapshot',
  tagCandidate:       'v110.66',
  changedFiles:       ['tools/kosame-provider-availability-health-snapshot.js'],
  packageJsonVersion: '110.66.0',
  smokeEntries:       {},
  verifySmokes:       [],
  existingTags:       ['v110.63', 'v110.65'],
  reservedVersions:   { '110.66': 'gpt' },
});
check('collision result is blocked', collisionResult.status === 'blocked');
check('collision result has VERSION COLLISION reason', collisionResult.blockedReasons.some(r => includesText(r, 'VERSION COLLISION')));
check('collision result has requiredFixes', collisionResult.requiredFixes.length > 0);

// ── buildMergeGuardResult — tag collision ─────────────────────────────────────

const tagCollision = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Guard',
  tagCandidate:       'v110.65',          // already exists
  changedFiles:       ['tools/foo.js'],
  packageJsonVersion: '110.67.0',
  existingTags:       ['v110.63', 'v110.65'],
  smokeEntries:       {},
  verifySmokes:       [],
});
check('tag collision is blocked', tagCollision.status === 'blocked');
check('tag collision has TAG COLLISION reason', tagCollision.blockedReasons.some(r => includesText(r, 'TAG COLLISION')));

// ── buildMergeGuardResult — package.json version mismatch ────────────────────

const versionMismatch = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Guard',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/foo.js'],
  packageJsonVersion: '110.64.1',         // wrong
  existingTags:       [],
  smokeEntries:       {},
  verifySmokes:       [],
});
check('version mismatch is blocked', versionMismatch.status === 'blocked');
check('version mismatch has VERSION MISMATCH reason', versionMismatch.blockedReasons.some(r => includesText(r, 'VERSION MISMATCH')));

// ── buildMergeGuardResult — broad staging ────────────────────────────────────

const broadStaging = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 test',
  tagCandidate:       'v110.67',
  changedFiles:       Array.from({ length: 35 }, (_, i) => `tools/f${i}.js`),
  packageJsonVersion: '110.67.0',
  existingTags:       [],
  smokeEntries:       {},
  verifySmokes:       [],
});
check('broad staging is blocked', broadStaging.status === 'blocked');
check('broad staging has BROAD STAGING reason', broadStaging.blockedReasons.some(r => includesText(r, 'BROAD STAGING')));

// ── buildMergeGuardResult — danger file → human_gate ─────────────────────────

const dangerFile = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 test',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/foo.js', '.env'],
  packageJsonVersion: '110.67.0',
  existingTags:       [],
  smokeEntries:       {},
  verifySmokes:       [],
});
check('danger file triggers human_gate', dangerFile.status === 'human_gate');
check('danger file humanApprovalRequired=true', dangerFile.humanApprovalRequired === true);
check('danger file mergeGuard.humanGate=true', dangerFile.mergeGuard.humanGate === true);
check('danger file has DANGER FILE reason', dangerFile.blockedReasons.some(r => includesText(r, 'DANGER FILE')));
check('danger file has humanGateInboxSummary', dangerFile.humanGateInboxSummary !== null);
check('danger file humanGateInboxSummary gateCategory=security', dangerFile.humanGateInboxSummary?.gateCategory === 'security');

// ── buildMergeGuardResult — sales DX content → human_gate ────────────────────

const salesDxDanger = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      '営業DX pipeline update v110.67',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/kosame-foo.js'],
  packageJsonVersion: '110.67.0',
  existingTags:       [],
  smokeEntries:       {},
  verifySmokes:       [],
});
check('sales DX in commit message → human_gate', salesDxDanger.status === 'human_gate');
check('sales DX has DANGER CONTENT reason', salesDxDanger.blockedReasons.some(r => includesText(r, 'DANGER CONTENT')));

// ── buildMergeGuardResult — untracked smoke file in verify ────────────────────

const untrackedSmoke = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Guard',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/kosame-foo.js', 'package.json'],
  untrackedFiles:     ['smoke/v110-67-foo-smoke.js'],  // not staged!
  packageJsonVersion: '110.67.0',
  smokeEntries:       { 'smoke:v110-67': 'smoke/v110-67-foo-smoke.js' },
  verifySmokes:       ['smoke:v110-67'],
  existingTags:       [],
  committedFiles:     [],
  repoRoot:           process.cwd(),
});
check('untracked smoke in verify → blocked', untrackedSmoke.status === 'blocked');
check('untracked smoke has UNTRACKED reason', untrackedSmoke.blockedReasons.some(r => includesText(r, 'UNTRACKED')));

// ── buildMergeGuardResult — missing smoke in verify (v110.64 pattern) ─────────

const missingSmoke = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Guard',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/kosame-foo.js', 'package.json'],
  untrackedFiles:     [],
  packageJsonVersion: '110.67.0',
  smokeEntries:       { 'smoke:v110-67': 'smoke/v110-67-nonexistent-smoke.js' },
  verifySmokes:       ['smoke:v110-67'],
  existingTags:       [],
  committedFiles:     [],
  repoRoot:           process.cwd(),
});
check('missing smoke file in verify → blocked (v110.64 pattern)', missingSmoke.status === 'blocked');
check('missing smoke mentions MODULE_NOT_FOUND', missingSmoke.blockedReasons.some(r => includesText(r, 'MODULE_NOT_FOUND')));

// ── buildMergeGuardResult — out-of-scope version caution ─────────────────────

const outOfScope = guard.buildMergeGuardResult({
  targetVersion:      '110.67',
  assignedAgent:      'claude',
  commitMessage:      'v110.67 Add Guard',
  tagCandidate:       'v110.67',
  changedFiles:       ['tools/kosame-foo.js', 'smoke/v110-66-something-smoke.js'],
  packageJsonVersion: '110.67.0',
  existingTags:       [],
  smokeEntries:       {},
  verifySmokes:       [],
  reservedVersions:   { '110.66': 'gpt' },
});
check('out-of-scope v110.66 file → caution', outOfScope.status === 'caution');
check('out-of-scope caution mentions v110-66', outOfScope.cautions.some(c => includesText(c, 'v110-66')));

// ── buildMergeGuardResult — mergeGuard summary fields ────────────────────────

check('mergeGuard.hasBlocked is boolean', typeof safeResult.mergeGuard.hasBlocked === 'boolean');
check('mergeGuard.hasCaution is boolean', typeof safeResult.mergeGuard.hasCaution === 'boolean');
check('mergeGuard.requiredFixes is array', Array.isArray(safeResult.mergeGuard.requiredFixes));
check('mergeGuard.nextAllowedAction is string', typeof safeResult.mergeGuard.nextAllowedAction === 'string');
check('mergeGuard.items is array', Array.isArray(safeResult.mergeGuard.items));
check('mergeGuard blocked: hasBlocked=true', collisionResult.mergeGuard.hasBlocked === true);

// ── readPackageJsonMeta ───────────────────────────────────────────────────────

const meta = guard.readPackageJsonMeta(process.cwd());
check('readPackageJsonMeta returns version', typeof meta.version === 'string' && meta.version.length > 0);
check('readPackageJsonMeta returns smokeEntries', typeof meta.smokeEntries === 'object');
check('readPackageJsonMeta returns verifySmokes', Array.isArray(meta.verifySmokes));
check('readPackageJsonMeta smokeEntries has v110-67', 'smoke:v110-67' in meta.smokeEntries);

// ── listSmokeFilesOnDisk ──────────────────────────────────────────────────────

const smokeFiles = guard.listSmokeFilesOnDisk(process.cwd());
check('listSmokeFilesOnDisk returns array', Array.isArray(smokeFiles));
check('listSmokeFilesOnDisk finds smoke files', smokeFiles.length > 0);
check('listSmokeFilesOnDisk includes v110-67', smokeFiles.some(f => f.includes('v110-67')));

// ── printMergeGuardDashboard does not throw ───────────────────────────────────

let dashboardOk = true;
try {
  const origLog = console.log;
  console.log = () => {};
  guard.printMergeGuardDashboard(safeResult);
  guard.printMergeGuardDashboard(collisionResult);
  guard.printMergeGuardDashboard(dangerFile);
  console.log = origLog;
} catch (e) {
  dashboardOk = false;
}
check('printMergeGuardDashboard does not throw', dashboardOk);

// ── v110.66 先取りしていないこと ──────────────────────────────────────────────

const v66Files  = require('fs').readdirSync(process.cwd() + '/tools').filter(f => /v110.66|110-66/.test(f));
const v66Smokes = require('fs').readdirSync(process.cwd() + '/smoke').filter(f => /v110-66/.test(f));
check('v110.66 tool files not implemented', v66Files.length === 0);
check('v110.66 smoke files not implemented', v66Smokes.length === 0);

// ── Result ────────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.log(`\nFAIL: v110.67 parallel agent merge guard smoke failed (${failures} checks)`);
  process.exit(1);
}

console.log('\n✅ v110.67 parallel agent merge guard smoke PASSED');
