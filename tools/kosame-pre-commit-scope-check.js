#!/usr/bin/env node
'use strict';

/**
 * KOSAME Pre-Commit Scope Check v110.75.3
 *
 * commit前に以下を確認するdryRun CLI:
 *   - git status相当の未コミット差分
 *   - staged / unstaged / untracked files
 *   - 指定された allowedFiles 以外が混ざっていないか
 *   - package.json version と targetVersion の一致
 *   - tag名候補が既存タグと衝突しないか
 *
 * 【制約】
 *   - dryRun以外では実行しない
 *   - Secret / API key / .env / credentials の値は読まない
 *   - 営業DX / transcriber / ANESTY Board には触れない
 *
 * Usage:
 *   node tools/kosame-pre-commit-scope-check.js --targetVersion=v110.75.3 --allowed=package.json --allowed=tools/foo.js
 *   node tools/kosame-pre-commit-scope-check.js --targetVersion=v110.75.3 --allowed=package.json --dryRun --json
 */

const fs   = require('fs');
const path = require('path');
const { execSync } = require('node:child_process');

const TOOL_META = {
  version:       '110.75.3',
  slug:          'kosame-pre-commit-scope-check',
  dryRunOnly:    true,
};

const STATUS = {
  SAFE:    'SAFE',
  CAUTION: 'CAUTION',
  BLOCKED: 'BLOCKED',
};

// ── Git helpers (no side effects, read-only) ─────────────────────────────────

function safeExec(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: 5000, stdio: 'pipe' }).trim();
  } catch {
    return '';
  }
}

function getStagedFiles() {
  return safeExec('git diff --cached --name-only').split('\n').filter(Boolean);
}

function getUnstagedFiles() {
  return safeExec('git diff --name-only').split('\n').filter(Boolean);
}

function getUntrackedFiles() {
  return safeExec('git ls-files --others --exclude-standard').split('\n').filter(Boolean);
}

function getExistingTags() {
  return safeExec('git tag --list').split('\n').filter(Boolean);
}

function getPackageVersion(repoRoot) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
    return String(pkg.version || '');
  } catch {
    return '';
  }
}

function getCurrentBranch() {
  return safeExec('git rev-parse --abbrev-ref HEAD');
}

// ── Core check function (mockable: accepts pre-computed inputs) ───────────────

function checkScope(request = {}) {
  const targetVersion    = String(request.targetVersion || '').trim().replace(/^v/i, '');
  const allowedFiles     = (request.allowedFiles || []).map(f => String(f).trim()).filter(Boolean);
  const stagedFiles      = request.stagedFiles !== undefined ? request.stagedFiles : getStagedFiles();
  const unstagedFiles    = request.unstagedFiles !== undefined ? request.unstagedFiles : getUnstagedFiles();
  const untrackedFiles   = request.untrackedFiles !== undefined ? request.untrackedFiles : getUntrackedFiles();
  const existingTags     = request.existingTags !== undefined ? request.existingTags : getExistingTags();
  const repoRoot         = request.repoRoot || process.cwd();
  const packageVersion   = request.packageVersion || getPackageVersion(repoRoot);

  const taggedFiles      = [...new Set([...stagedFiles, ...unstagedFiles, ...untrackedFiles])];

  // Find unexpected files
  const unexpectedFiles = !request.mockMode
    ? []
    : [];

  // Use mock-friendly detection
  const unexpected = taggedFiles.filter(f => {
    if (allowedFiles.length === 0) return true;
    // Check if file is in allowedFiles (exact or relative)
    const normalized = f.replace(/\\/g, '/');
    const allowed = allowedFiles.some(a => {
      const an = a.replace(/\\/g, '/');
      return normalized === an || normalized.startsWith(an + '/');
    });
    return !allowed;
  });

  const existingTagConflict = existingTags.some(t => {
    const tClean = t.replace(/^v/i, '');
    return tClean === targetVersion;
  });

  const pkgVersionMatch = packageVersion === targetVersion || packageVersion.startsWith(targetVersion + '.');

  // ── Status determination ────────────────────────────────────────────────

  let status;
  let nextAllowedAction;
  const blockedReasons = [];
  const cautions = [];
  let humanGateRequired = false;

  if (unexpected.length > 0) {
    status = STATUS.BLOCKED;
    blockedReasons.push(`Unexpected files: ${unexpected.join(', ')}`);
    nextAllowedAction = 'remove_unexpected_files_from_scope_or_add_to_allowed';
  } else if (existingTagConflict) {
    status = STATUS.CAUTION;
    cautions.push(`Tag v${targetVersion} already exists`);
    nextAllowedAction = 'choose_different_tag';
  } else if (!pkgVersionMatch) {
    status = STATUS.CAUTION;
    cautions.push(`package.json version ${packageVersion} does not match target ${targetVersion}`);
    nextAllowedAction = 'update_package_json_version_or_target';
  } else if (unstagedFiles.length > 0) {
    status = STATUS.CAUTION;
    cautions.push(`${unstagedFiles.length} unstaged file(s) exist: ${unstagedFiles.join(', ')}`);
    nextAllowedAction = 'stage_all_intended_files_before_commit';
  } else {
    status = STATUS.SAFE;
    nextAllowedAction = 'proceed_to_commit_and_tag';
  }

  // human gate if blocked
  if (status === STATUS.BLOCKED) {
    humanGateRequired = true;
  }

  return {
    tool:       TOOL_META.slug,
    version:    TOOL_META.version,
    timestamp:  new Date().toISOString(),
    dryRun:     true,
    status,
    targetVersion,
    allowedFiles,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
    unexpectedFiles: unexpected,
    existingTagConflict,
    existingTagCandidate: existingTagConflict ? `v${targetVersion}` : null,
    packageVersion,
    packageVersionMatches: pkgVersionMatch,
    canCommit: status !== STATUS.BLOCKED,
    canTag:    !existingTagConflict,
    humanGateRequired,
    nextAllowedAction,
    blockedReasons,
    cautions,
    summaryForDashboard: {
      status,
      targetVersion,
      totalFiles: taggedFiles.length,
      unexpectedCount: unexpected.length,
      canCommit: status !== STATUS.BLOCKED,
      canTag: !existingTagConflict,
      nextAllowedAction,
    },
  };
}

// ── Mock input factory for testing ──────────────────────────────────────────

function createMockInput(overrides = {}) {
  return {
    targetVersion: overrides.targetVersion || '110.75.3',
    allowedFiles:  overrides.allowedFiles || ['package.json', 'tools/foo.js', 'smoke/foo-smoke.js'],
    stagedFiles:   overrides.stagedFiles || ['package.json', 'tools/foo.js', 'smoke/foo-smoke.js'],
    unstagedFiles: overrides.unstagedFiles || [],
    untrackedFiles: overrides.untrackedFiles || [],
    existingTags:  overrides.existingTags || ['v110.75.0', 'v110.75.1', 'v110.75.2'],
    packageVersion: overrides.packageVersion || '110.75.3',
    mockMode: true,
  };
}

// ── CLI display ──────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', blue: '\x1b[34m',
  cyan: '\x1b[36m', red: '\x1b[31m', gray: '\x1b[90m',
};
const c = (col, t) => `${C[col] || ''}${t}${C.reset}`;

function printResult(result) {
  const sc = result.status === 'SAFE' ? 'green' : result.status === 'CAUTION' ? 'yellow' : 'red';
  const si = result.status === 'SAFE' ? '✓' : result.status === 'CAUTION' ? '⚠' : '✗';

  console.log(`\n${c('bold', c('blue', '╡ KOSAME Pre-Commit Scope Check'))}  ${c('cyan', `v${result.version}`)}`);
  console.log(`  ${c('bold', 'Target Version:')} ${c('cyan', result.targetVersion)}  |  ${c('bold', 'Status:')} ${c(sc, `${si} ${result.status}`)}`);
  console.log(`  ${c('bold', 'Package:')} ${result.packageVersion}  ${result.packageVersionMatches ? c('green', '✓') : c('red', '✗')}  |  ${c('bold', 'Tag Conflict:')} ${result.existingTagConflict ? c('red', `v${result.targetVersion} exists`) : c('green', 'none')}`);
  console.log(`  ${c('bold', 'Can Commit:')} ${result.canCommit ? c('green', 'YES') : c('red', 'NO')}  ${c('bold', 'Can Tag:')} ${result.canTag ? c('green', 'YES') : c('red', 'NO')}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);

  console.log(`\n  ${c('bold', 'Scope Files')}`);
  console.log(`    ${c('bold', 'Allowed:')}`);
  for (const f of result.allowedFiles)   console.log(`      ${c('gray', '·')} ${f}`);
  console.log(`    ${c('bold', 'Staged:')} ${result.stagedFiles.length > 0 ? c('green', ` ${result.stagedFiles.length}`) : c('gray', ' (none)')}`);
  console.log(`    ${c('bold', 'Unstaged:')} ${result.unstagedFiles.length > 0 ? c('yellow', ` ${result.unstagedFiles.join(', ')}`) : c('gray', ' (none)')}`);
  console.log(`    ${c('bold', 'Untracked:')} ${result.untrackedFiles.length > 0 ? c('yellow', ` ${result.untrackedFiles.join(', ')}`) : c('gray', ' (none)')}`);

  if (result.unexpectedFiles.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'UNEXPECTED FILES'))}`);
    for (const f of result.unexpectedFiles) console.log(`    ${c('red', '✗')} ${f}`);
  }

  if (result.blockedReasons.length > 0) {
    console.log(`\n  ${c('bold', c('red', 'BLOCKED'))}`);
    for (const r of result.blockedReasons) console.log(`    ${c('red', '✗')} ${r}`);
  }
  if (result.cautions.length > 0) {
    console.log(`\n  ${c('bold', c('yellow', 'CAUTIONS'))}`);
    for (const r of result.cautions) console.log(`    ${c('yellow', '⚠')} ${r}`);
  }

  console.log(`\n  ${c('bold', 'Next:')} ${c('bold', result.nextAllowedAction)}`);
  console.log(`  ${c('gray', '─'.repeat(64))}`);
  console.log(`  ${c('bold', c('blue', '╡ End of Check'))} ${c('gray', `${result.summaryForDashboard.totalFiles} files, status: ${result.status}`)}`);
  console.log('');
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  const get = (name) => {
    const eq = `--${name}=`;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === eq) return '';
      if (args[i].startsWith(eq)) return args[i].slice(eq.length);
    }
    const idx = args.indexOf(`--${name}`);
    if (idx >= 0 && idx + 1 < args.length && !args[idx + 1].startsWith('--')) return args[idx + 1];
    return null;
  };
  const allowed = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--allowed' && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      allowed.push(args[i + 1]);
      i++;
    }
    const eq = '--allowed=';
    if (args[i].startsWith(eq)) allowed.push(args[i].slice(eq.length));
  }
  return {
    targetVersion: get('targetVersion') || get('target-version') || '',
    allowed,
    json: args.includes('--json'),
    dryRun: !args.includes('--no-dry-run'),
  };
}

if (require.main === module) {
  const cliArgs = parseArgs(process.argv);
  const result = checkScope({
    targetVersion: cliArgs.targetVersion,
    allowedFiles: cliArgs.allowed,
  });
  if (cliArgs.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printResult(result);
  }
}

module.exports = {
  TOOL_META,
  STATUS,
  checkScope,
  createMockInput,
  printResult,
};
