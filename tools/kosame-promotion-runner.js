#!/usr/bin/env node
'use strict';

/**
 * KOSAME Promotion Runner v110.6.0
 *
 * verify→add→commit→tag→push→Actions確認 を1コマンドで完結させる。
 * --yes なしは dry-run のみ。git add -A 禁止。.env/Secret/deploy 禁止。
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

// ── Preset definitions ────────────────────────────────────────────────────────

const PRESETS = {
  'anesty-v87.0.12': {
    repoPath: '/home/shimohigoshi/anesty-board',
    files: [
      'smoke-completion-review-gate.js',
      'tickets/v87_0_12_completion_review_gate.md',
      'tools/completion-review-gate.js',
    ],
    commitMessage: 'v87.0.12 Add completion review gate',
    tag: 'v87.0.12-completion-review-gate',
  },
};

// ── Safety guards ─────────────────────────────────────────────────────────────

const FORBIDDEN_FILE_RE = /\.env|Secret|deploy/i;

function assertSafeFiles(files) {
  for (const f of files) {
    if (FORBIDDEN_FILE_RE.test(path.basename(f))) {
      throw new Error(`SAFETY BLOCK: forbidden file pattern in "${f}" (.env/Secret/deploy 禁止)`);
    }
  }
}

// ── Arg parsing ───────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = argv.slice(2);
  let preset = null;
  let yes = false;
  for (const a of args) {
    if (a.startsWith('--preset=')) preset = a.slice('--preset='.length);
    if (a === '--yes') yes = true;
  }
  return { preset, yes };
}

// ── Step runner ───────────────────────────────────────────────────────────────

function run(cmd, args, cwd, dryRun) {
  const label = [cmd, ...args].join(' ');
  if (dryRun) {
    console.log(`  [DRY] ${label}`);
    return '';
  }
  console.log(`  $ ${label}`);
  try {
    const out = execFileSync(cmd, args, { cwd, encoding: 'utf8' });
    if (out.trim()) console.log(out.trim());
    return out;
  } catch (err) {
    const msg = err.stderr?.trim() || err.stdout?.trim() || err.message;
    throw new Error(`FAIL: ${label}\n${msg}`);
  }
}

// ── Actions check (gh cli) ────────────────────────────────────────────────────

function checkActions(repoPath, dryRun) {
  console.log('\n[Actions確認]');
  if (dryRun) {
    console.log('  [DRY] gh run list --limit=3');
    return;
  }
  try {
    const out = execFileSync('gh', ['run', 'list', '--limit=3'], { cwd: repoPath, encoding: 'utf8' });
    console.log(out.trim() || '  (no recent runs)');
  } catch (_) {
    console.log('  gh CLI unavailable — open GitHub Actions manually to confirm.');
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

function promote({ preset: presetName, yes }) {
  if (!presetName) {
    console.error('ERROR: --preset=<name> is required');
    process.exit(1);
  }

  const preset = PRESETS[presetName];
  if (!preset) {
    const known = Object.keys(PRESETS).join(', ');
    console.error(`ERROR: unknown preset "${presetName}". Known: ${known}`);
    process.exit(1);
  }

  const dryRun = !yes;
  const { repoPath, files, commitMessage, tag } = preset;

  // Safety: validate files before anything else
  assertSafeFiles(files);

  console.log(`\n===== KOSAME Promotion Runner =====`);
  console.log(`PRESET  : ${presetName}`);
  console.log(`REPO    : ${repoPath}`);
  console.log(`FILES   : ${files.join(', ')}`);
  console.log(`COMMIT  : ${commitMessage}`);
  console.log(`TAG     : ${tag}`);
  console.log(`DRY RUN : ${dryRun}`);
  console.log('===================================\n');

  if (dryRun) {
    console.log('── dry-run plan (pass --yes to execute) ──');
  }

  // 1. verify
  console.log('[1/5] verify');
  run('bash', ['verify.sh'], repoPath, dryRun);

  // 2. add (individual files only — never -A)
  console.log('\n[2/5] add');
  for (const f of files) {
    if (!dryRun && !fs.existsSync(path.join(repoPath, f))) {
      throw new Error(`FAIL: file not found in repo — ${f}`);
    }
    run('git', ['add', f], repoPath, dryRun);
  }

  // 3. commit
  console.log('\n[3/5] commit');
  run('git', ['commit', '-m', commitMessage], repoPath, dryRun);

  // 4. tag
  console.log('\n[4/5] tag');
  run('git', ['tag', tag], repoPath, dryRun);

  // 5. push (branch + tag)
  console.log('\n[5/5] push');
  run('git', ['push', 'origin', 'HEAD'], repoPath, dryRun);
  run('git', ['push', 'origin', tag], repoPath, dryRun);

  // 6. Actions確認
  checkActions(repoPath, dryRun);

  console.log(`\n✅ promotion ${dryRun ? 'dry-run' : 'complete'}: ${presetName}`);
}

// ── Export (for smoke) & CLI entry ────────────────────────────────────────────

module.exports = { PRESETS, promote, assertSafeFiles, parseArgs };

if (require.main === module) {
  const args = parseArgs(process.argv);
  promote(args);
}
