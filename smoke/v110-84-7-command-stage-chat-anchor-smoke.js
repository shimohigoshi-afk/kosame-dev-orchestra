#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-chat-stage-'));

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

console.log('=== v110.84.7 command stage / chat anchor smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.7'), `package version must be >= 110.84.7 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-7'], 'smoke:v110-84-7 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-7'), 'verify must include smoke:v110-84-7');
console.log('  PASS: package wiring for v110.84.7');

mustExist(HTML_PATH);

const html = readText(HTML_PATH);
assert.ok(html.includes('KOSAME Console'), 'HTML must include KOSAME Console');
assert.ok(html.includes('LIVE COMMAND STAGE'), 'HTML must include Live Command Stage');
assert.ok(html.includes('stage-halo'), 'HTML must include halo class');
assert.ok(html.includes('stage-ring-a'), 'HTML must include ring class');
assert.ok(html.includes('stage-grid'), 'HTML must include grid class');
assert.ok(html.includes('stage-scanline'), 'HTML must include scanline class');
assert.ok(html.includes('stage-glow'), 'HTML must include glow class');
assert.ok(html.includes('prefers-reduced-motion'), 'HTML must include prefers-reduced-motion guard');
assert.ok(html.includes('KOSAME CHAT'), 'HTML must include KOSAME CHAT');
assert.ok(!html.includes('KOSAME CHAT — こさめ相談'), 'HTML must not keep old chat title');
assert.ok(html.includes('chat-callout'), 'HTML must include chat callout banner');
assert.ok(html.includes('chat-callout-jump'), 'HTML must include chat callout jump button');
assert.ok(html.includes('チャットへ'), 'HTML must include chat anchor button');
assert.ok(html.includes('scrollIntoView({ behavior: \'smooth\''), 'HTML must include smooth scroll handler');
assert.ok(html.includes('chat-sound-details-compact'), 'HTML must keep collapsed sound UI');
assert.ok(html.includes('sound-summary-mode'), 'HTML must include compact sound summary');
assert.ok(html.includes('sound-test-question'), 'HTML must keep hidden sound tests');
assert.ok(html.includes('最終更新:'), 'HTML must include local timestamp label');
assert.ok(html.includes('JST'), 'HTML must include JST timestamp text');
assert.ok(html.includes('Command Center'), 'HTML must keep subtitle');
assert.ok(html.includes('Console からの書き込みはできません'), 'HTML must use Console wording');
assert.ok(!html.includes('この cockpit'), 'HTML must not use cockpit wording');
assert.ok(!html.includes('cockpit から'), 'HTML must not use cockpit wording');
console.log('  PASS: layout, animation, anchor, and Console wording checks');

const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;
const snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
});
assert.equal(snapshot.currentVersion, pkg.version, 'snapshot currentVersion must match package version');
assert.ok(snapshot.generatedAtLocal && snapshot.generatedAtLocal.includes('JST'), 'snapshot must include JST local timestamp');
assert.ok(snapshot.consoleContextSummary.includes(`currentVersion=${pkg.version}`), 'snapshot context summary must include currentVersion');
assert.ok(snapshot.consoleContextSummary.includes(`versionContext=package=${pkg.version}`), 'snapshot context summary must include versionContext');

const ctx = buildConsoleContextSummary(snapshot);
assert.equal(ctx.status, 'ok', 'console context summary status must be ok');
assert.ok(ctx.summary.includes(`currentVersion=${pkg.version}`), 'context summary must include currentVersion');
assert.ok(ctx.summary.includes(`releaseTag=v${pkg.version}`), 'context summary must include releaseTag');
console.log('  PASS: version context and JST timestamp checks');

if (typeof previousVault === 'string') {
  process.env.KOSAME_TASK_VAULT_DIR = previousVault;
} else {
  delete process.env.KOSAME_TASK_VAULT_DIR;
}

console.log('✅ v110.84.7 command stage / chat anchor smoke PASSED');
