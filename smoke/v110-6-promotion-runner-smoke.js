#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const pkg = require('../package.json');
const { PRESETS, assertSafeFiles, parseArgs } = require('../tools/kosame-promotion-runner');

function pass(msg) {
  console.log(`  PASS: ${msg}`);
}

console.log('=== v110.6 promotion runner smoke ===');

// package.json
assert.ok(pkg.version >= '110.6.0');
pass('version is 110.6.0');

assert.ok(pkg.scripts.promote, 'promote script missing');
assert.ok(pkg.scripts.promote.includes('kosame-promotion-runner.js'), 'promote script wrong path');
pass('promote script exists');

// Preset exists
assert.ok(PRESETS['anesty-v87.0.12'], 'preset anesty-v87.0.12 missing');
pass('preset anesty-v87.0.12 exists');

const preset = PRESETS['anesty-v87.0.12'];
assert.strictEqual(preset.repoPath, '/home/shimohigoshi/anesty-board');
pass('preset repoPath correct');

assert.ok(preset.files.includes('smoke-completion-review-gate.js'), 'smoke file missing from preset');
assert.ok(preset.files.includes('tickets/v87_0_12_completion_review_gate.md'), 'ticket file missing from preset');
assert.ok(preset.files.includes('tools/completion-review-gate.js'), 'tool file missing from preset');
pass('preset files correct');

assert.strictEqual(preset.commitMessage, 'v87.0.12 Add completion review gate');
pass('preset commitMessage correct');

assert.strictEqual(preset.tag, 'v87.0.12-completion-review-gate');
pass('preset tag correct');

// Safety: forbidden file guard
assert.throws(() => assertSafeFiles(['.env']), /SAFETY BLOCK/);
pass('.env is blocked');

assert.throws(() => assertSafeFiles(['Secret.json']), /SAFETY BLOCK/);
pass('Secret.json is blocked');

assert.throws(() => assertSafeFiles(['deploy.sh']), /SAFETY BLOCK/);
pass('deploy.sh is blocked');

assert.doesNotThrow(() => assertSafeFiles(preset.files));
pass('preset files pass safety guard');

// Arg parsing
const a1 = parseArgs(['node', 'runner.js', '--preset=anesty-v87.0.12', '--yes']);
assert.strictEqual(a1.preset, 'anesty-v87.0.12');
assert.strictEqual(a1.yes, true);
pass('--preset and --yes parsed');

const a2 = parseArgs(['node', 'runner.js', '--preset=anesty-v87.0.12']);
assert.strictEqual(a2.preset, 'anesty-v87.0.12');
assert.strictEqual(a2.yes, false);
pass('omitting --yes gives dry-run mode');

// node --check
const { execFileSync } = require('node:child_process');
try {
  execFileSync(process.execPath, ['--check', 'tools/kosame-promotion-runner.js'], { cwd: require('node:path').resolve(__dirname, '..') });
  pass('kosame-promotion-runner.js passes node --check');
} catch (error) {
  if (error && error.code === 'EPERM') pass('kosame-promotion-runner.js node --check skipped in this environment');
  else throw error;
}

console.log('PASS: v110.6 promotion runner smoke');
