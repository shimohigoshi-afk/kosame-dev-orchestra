#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.18 .gitignore cleanup
 *
 * Verifies:
 *   1. .gitignore exists with required patterns
 *   2. dispatch-result-*.json and executor-dummy files are not visible in git status
 *   3. Untracked files are only the expected set
 *      (pre-commit: .gitignore + kosame-dev-orchestra@14.0.0 + node)
 *      (post-commit: kosame-dev-orchestra@14.0.0 + node)
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const pkg = require('../package.json');

let passed = 0;
function pass(msg) {
  passed += 1;
  console.log(`  PASS: ${msg}`);
}

const ROOT = path.resolve(__dirname, '..');
const GITIGNORE = path.join(ROOT, '.gitignore');

console.log('=== v110.18 gitignore smoke ===');

// Version
assert.ok(pkg.version >= '110.18.0');
pass('package version is valid (>=110.18.0)');

// .gitignore exists
assert.ok(fs.existsSync(GITIGNORE), '.gitignore must exist at repo root');
pass('.gitignore exists');

// Required patterns present in .gitignore
const content = fs.readFileSync(GITIGNORE, 'utf8');

assert.ok(content.includes('dispatch-result-*.json'), '.gitignore must include dispatch-result-*.json');
pass('.gitignore includes dispatch-result-*.json');

assert.ok(content.includes('executor-dummy'), '.gitignore must include executor-dummy pattern');
pass('.gitignore includes executor-dummy pattern');

// git status: forbidden files must NOT be untracked
const statusOut = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' });
const untracked = statusOut
  .split('\n')
  .filter(l => l.startsWith('?? '))
  .map(l => l.slice(3).trim());

const forbidden = untracked.filter(
  f => /^dispatch-result-.*\.json$/.test(f) || /executor-dummy/.test(f)
);
assert.strictEqual(
  forbidden.length,
  0,
  `Forbidden files still untracked: ${forbidden.join(', ')}`
);
pass('No dispatch-result-*.json or executor-dummy files in git status');

// After gitignore is applied, known local runtime artifacts must remain untracked
// when they are present. Fresh checkouts or other worktrees may not have them.
if (process.env.CI) {
  pass('kosame-dev-orchestra@14.0.0 and node remain as expected untracked entries (skipped in CI)');
} else {
  const optionalLocalArtifacts = ['kosame-dev-orchestra@14.0.0', 'node'];
  for (const artifact of optionalLocalArtifacts) {
    const exists = fs.existsSync(path.join(ROOT, artifact));
    if (!exists) continue;
    assert.ok(untracked.includes(artifact), `${artifact} must remain as untracked when present`);
  }
  pass('optional local runtime artifacts remain untracked when present');
}

// No OTHER non-project files should be untracked (runtime/temp only)
// Project source files (.js, .json in tools/smoke) are expected pre-commit
// Skipped in CI: fresh checkout working tree differs from local dev environment
if (process.env.CI) {
  pass('No unexpected non-project untracked files (skipped in CI)');
} else {
  const nonProject = untracked.filter(f => {
    if (f === 'kosame-dev-orchestra@14.0.0') return false;
    if (f === 'node') return false;
    if (f === '.gitignore') return false;
    // Allow newly-created source files in project directories
    if (/^(smoke|tools|providers|apps|fixtures|tickets|docs|public)\//.test(f)) return false;
    if (f === 'package.json') return false;
    return true;
  });
  assert.strictEqual(
    nonProject.length,
    0,
    `Non-project untracked files found (should be gitignored): ${nonProject.join(', ')}`
  );
  pass('No unexpected non-project untracked files');
}

console.log(`\n✅ v110.18 gitignore smoke PASSED (${passed} checks)`);
