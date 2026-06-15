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
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-10-'));

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

console.log('=== v110.84.10 stable layout signal grid running motion smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.10'), `package version must be at least 110.84.10 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-10'], 'smoke:v110-84-10 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-10'), 'verify must include smoke:v110-84-10');
console.log('  PASS: package wiring for v110.84.10');

mustExist(HTML_PATH);
const html = readText(HTML_PATH);

assert.ok(html.includes('☂️ KOSAME Console'), 'HTML must include KOSAME Console branding');
assert.ok(html.includes('Dev Orchestra Command Center'), 'HTML must include subtitle');
assert.ok(html.includes('SIGNAL GRID HERO LITE'), 'HTML must include signal grid hero eyebrow');
assert.ok(html.includes('signal-grid-hero-lite'), 'HTML must include compact hero class');
assert.ok(html.includes('stage-grid'), 'HTML must include stage grid class');
assert.ok(html.includes('stage-lines'), 'HTML must include stage lines class');
assert.ok(html.includes('stage-trace'), 'HTML must include stage trace class');
assert.ok(html.includes('stage-dots'), 'HTML must include stage dots class');
assert.ok(html.includes('stage-blip'), 'HTML must include stage blip class');
assert.ok(html.includes('stage-scanline'), 'HTML must include stage scanline class');
assert.ok(html.includes('stage-glow'), 'HTML must include stage glow class');
assert.ok(!html.includes('stage-halo'), 'HTML must not include stage halo class');
assert.ok(!html.includes('stage-ring-a'), 'HTML must not include stage ring class');
assert.ok(!html.includes('stage-arc'), 'HTML must not include stage arc class');
assert.ok(!html.includes('大きい丸中心'), 'HTML must not describe a big central circle');
console.log('  PASS: signal grid hero');

assert.ok(html.includes('ACTIVE TASK STRIP'), 'HTML must include active task strip heading');
assert.ok(html.includes('ACTIVE RUNNER'), 'HTML must include active runner label');
assert.ok(html.includes('running-panel'), 'HTML must include running-panel class');
assert.ok(html.includes('task-signal-stream'), 'HTML must include task-signal-stream class');
assert.ok(html.includes('task-motion-grid'), 'HTML must include task motion grid');
assert.ok(html.includes('task-motion-panel'), 'HTML must include task motion panel');
assert.ok(html.includes('現在進行中のタスクはありません。') || html.includes('running •'), 'HTML must include active task motion copy');
assert.ok(html.includes('AGENT SHORT CONVERSATION FEED'), 'HTML must include agent short conversation feed');
console.log('  PASS: running task motion');

assert.ok(html.includes('KOSAME CHAT'), 'HTML must include KOSAME CHAT heading');
assert.ok(!html.includes('KOSAME CHAT — こさめ相談'), 'HTML must not include old chat subtitle');
assert.ok(html.includes('chat-primary-actions'), 'HTML must include primary chat action row');
assert.ok(html.includes('この内容で進める'), 'HTML must include the main proceed button');
assert.ok(html.includes('chat-action-drawer'), 'HTML must include chat action drawer');
assert.ok(html.includes('chat-action-tabs'), 'HTML must include chat action tabs');
assert.ok(html.includes('現在地'), 'HTML must include current location action');
assert.ok(html.includes('次の一手'), 'HTML must include next action action');
assert.ok(html.includes('危険ゲート'), 'HTML must include danger gate action');
assert.ok(html.includes('代替案を出す'), 'HTML must include alternative proposal action');
assert.ok(html.includes('Wishlistに保存'), 'HTML must include wishlist action');
assert.ok(html.includes('今日はここで終了'), 'HTML must include finish action');
assert.ok(html.includes('通知音: Clear') || html.includes('Sound: Clear') || html.includes('Sound: OFF'), 'HTML must include compact sound label');
assert.ok(html.includes('sound-test'), 'HTML must include test sound button');
assert.ok(html.includes('sound-btn-off'), 'HTML must include off sound button');
assert.ok(html.includes('sound-btn-soft'), 'HTML must include soft sound button');
assert.ok(html.includes('sound-btn-clear'), 'HTML must include clear sound button');
console.log('  PASS: chat action drawer');

assert.ok(html.includes('COLLAPSED DETAILS'), 'HTML must include collapsed details section');
assert.ok(html.includes('support-details-stack'), 'HTML must include support details stack');
assert.ok(html.includes('AUTO SAVE / TASK VAULT'), 'HTML must include auto save / task vault detail');
assert.ok(html.includes('MEMORY VAULT'), 'HTML must include memory vault detail');
assert.ok(html.includes('WISHLIST / IDEA BOARD'), 'HTML must include idea board detail');
assert.ok(html.includes('API COST METER'), 'HTML must include API cost meter detail');
assert.ok(html.includes('CONFIRMATION BRIDGE'), 'HTML must include confirmation bridge detail');
assert.ok(html.includes('WARNINGS / HUMAN GATE / RECENT COMMITS'), 'HTML must include warnings support detail');
assert.ok(html.includes('task-board-details'), 'HTML must keep legacy task-board-details marker for compatibility');
console.log('  PASS: collapsed details');

assert.ok(html.includes('JST'), 'HTML must include JST timestamp display');
assert.ok(!html.includes('cockpit では'), 'HTML must not use cockpit wording');
assert.ok(!html.includes('cockpit から'), 'HTML must not use cockpit wording');
assert.ok(html.includes('Console からの書き込みはできません'), 'HTML must use Console wording');
console.log('  PASS: console wording and timestamps');

const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;
const snapshot = collectLiveCockpitSnapshot({ taskVaultDir: TEMP_VAULT });
assert.equal(snapshot.currentVersion, pkg.version, 'snapshot currentVersion must match package version');
assert.equal(snapshot.packageVersion, pkg.version, 'snapshot packageVersion must match package version');
assert.ok(snapshot.consoleContextSummary.includes(`currentVersion=${pkg.version}`), 'snapshot console context must include currentVersion');
assert.ok(!snapshot.consoleContextSummary.includes('v110.84.2'), 'snapshot console context must not keep old fixed version text');
assert.ok(!snapshot.consoleContextSummary.includes('OPENAI_API_KEY'), 'snapshot console context must not leak API key names');

const ctx = buildConsoleContextSummary(snapshot);
assert.equal(ctx.status, 'ok', 'console context summary status must be ok');
assert.ok(ctx.summary.includes(`currentVersion=${pkg.version}`), 'context summary must include currentVersion');
assert.ok(!ctx.summary.includes('v110.84.2'), 'context summary must not keep old fixed version text');
assert.ok(!ctx.summary.includes('OPENAI_API_KEY'), 'context summary must not leak API key names');
assert.ok(!ctx.summary.includes('.env'), 'context summary must not leak env file names');
console.log('  PASS: snapshot version context safety');

if (typeof previousVault === 'string') {
  process.env.KOSAME_TASK_VAULT_DIR = previousVault;
} else {
  delete process.env.KOSAME_TASK_VAULT_DIR;
}

console.log('✅ v110.84.10 stable layout signal grid running motion smoke PASSED');
