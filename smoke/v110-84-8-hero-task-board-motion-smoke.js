#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-8-'));

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

console.log('=== v110.84.8 hero task board motion smoke ===');

assert.ok(pkg.version >= '110.84.8', `package version must be >= 110.84.8 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-8'], 'smoke:v110-84-8 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-8'), 'verify must include smoke:v110-84-8');
console.log('  PASS: package wiring for v110.84.8');

mustExist(HTML_PATH);
const html = readText(HTML_PATH);

// Console Hero
assert.ok(html.includes('KOSAME Console'), 'HTML must include KOSAME Console title');
assert.ok(html.includes('LIVE COMMAND STAGE'), 'HTML must include LIVE COMMAND STAGE eyebrow');
assert.ok(html.includes('Command Center'), 'HTML must include Command Center subtitle');
assert.ok(html.includes('stage-halo'), 'HTML must include stage halo animation class');
assert.ok(html.includes('stage-ring-a'), 'HTML must include stage ring class');
assert.ok(html.includes('stage-grid'), 'HTML must include stage grid class');
assert.ok(html.includes('stage-scanline'), 'HTML must include stage scanline class');
assert.ok(html.includes('stage-glow'), 'HTML must include stage glow class');
console.log('  PASS: Console Hero elements');

// Active Task Board
assert.ok(html.includes('active-task-board'), 'HTML must include active-task-board section');
assert.ok(html.includes('ACTIVE TASK BOARD') || html.includes('ACTIVE TASKS'), 'HTML must include Active Task Board heading');
assert.ok(html.includes('NEXT TASK FEED'), 'HTML must include NEXT TASK FEED integrated in board');
assert.ok(html.includes('WISHLIST / LATER IDEAS'), 'HTML must include WISHLIST / LATER IDEAS integrated in board');
assert.ok(html.includes('Task Vault'), 'HTML must include Task Vault in board');
assert.ok(html.includes('Auto Save'), 'HTML must include Auto Save in board');
assert.ok(html.includes('vault-details'), 'HTML must include vault-details in collapsible');
assert.ok(html.includes('autosave-details'), 'HTML must include autosave-details in collapsible');
assert.ok(html.includes('task-board-details'), 'HTML must include task-board-details collapsible section');
console.log('  PASS: Active Task Board integration');

// Running task animation
assert.ok(html.includes('taskBorderSpin'), 'HTML must include taskBorderSpin animation');
assert.ok(html.includes('active-task-card') || html.includes('running-task-wrapper'), 'HTML must include running task card class');
assert.ok(html.includes('conic-gradient') || html.includes('rotating') || html.includes('border-glow'), 'HTML must include conic-gradient or glow animation');
assert.ok(html.includes('prefers-reduced-motion'), 'HTML must include prefers-reduced-motion guard');
console.log('  PASS: running task animation');

// KOSAME CHAT
assert.ok(html.includes('KOSAME CHAT'), 'HTML must include KOSAME CHAT section');
assert.ok(!html.includes('KOSAME CHAT — こさめ相談'), 'HTML must not have old chat title');
assert.ok(!html.includes('こさめ相談AI'), 'HTML must not include こさめ相談AI label');
assert.ok(html.includes('chat-quick-actions'), 'HTML must keep Quick Actions');
assert.ok(html.includes('chat-callout'), 'HTML must keep chat callout banner');
assert.ok(html.includes('Enterで送信、Shift+Enterで改行'), 'HTML must keep input hint');
console.log('  PASS: KOSAME CHAT cleaned up');

// Typing indicator
assert.ok(html.includes('chat-typing-indicator'), 'HTML must include chat-typing-indicator element');
assert.ok(html.includes('こさめが入力中'), 'HTML must include typing indicator text');
assert.ok(html.includes('typing-dot'), 'HTML must include typing dot animation class');
assert.ok(html.includes('typingDotBlink'), 'HTML must include typingDotBlink keyframe');
console.log('  PASS: typing indicator');

// Notification sound UI (collapsed)
assert.ok(html.includes('chat-sound-details-compact'), 'HTML must keep collapsed sound UI');
assert.ok(html.includes('id="sound-btn-off"'), 'HTML must include OFF sound button');
assert.ok(html.includes('id="sound-btn-soft"'), 'HTML must include Soft sound button');
assert.ok(html.includes('id="sound-btn-clear"'), 'HTML must include Clear sound button');
assert.ok(html.includes('sound-test-question'), 'HTML must keep sound-test-question button');
assert.ok(html.includes('通知音'), 'HTML must include 通知音 label');
console.log('  PASS: notification sound UI maintained');

// cockpit wording cleaned up → Console
assert.ok(!html.includes('この cockpit'), 'HTML must not use cockpit wording');
assert.ok(!html.includes('cockpit から'), 'HTML must not use cockpit wording');
assert.ok(html.includes('Console からの書き込みはできません'), 'HTML must use Console wording');
console.log('  PASS: cockpit wording replaced with Console');

// JST timestamp maintained
assert.ok(html.includes('最終更新:'), 'HTML must include JST timestamp label');
assert.ok(html.includes('JST'), 'HTML must include JST timestamp text');
console.log('  PASS: JST timestamp maintained');

// Compatibility: previous features maintained
assert.ok(html.includes('serviceWorker'), 'HTML must include PWA service worker');
assert.ok(html.includes('MEMORY VAULT'), 'HTML must include MEMORY VAULT display');
assert.ok(html.includes('project-status-grid'), 'HTML must include project registry section');
assert.ok(html.includes('consoleContextSummary'), 'HTML must include console context injection');
assert.ok(html.includes('buildChatPayload'), 'HTML must include chat payload helper');
assert.ok(html.includes('playNotificationChime'), 'HTML must include notification chime function');
assert.ok(html.includes('payload.contextSummary = latestSnapshot.consoleContextSummary;'), 'HTML must send console context summary');
assert.ok(html.includes('こさめ考え中…☂️'), 'HTML must include こさめ thinking status text');
assert.ok(html.includes('API COST METER'), 'HTML must include API cost meter section');
console.log('  PASS: previous features maintained');

// Snapshot / version checks
const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;
const snapshot = collectLiveCockpitSnapshot({ taskVaultDir: TEMP_VAULT });
assert.equal(snapshot.currentVersion, pkg.version, 'snapshot currentVersion must match package version');
assert.ok(snapshot.generatedAtLocal && snapshot.generatedAtLocal.includes('JST'), 'snapshot must include JST local timestamp');
assert.ok(snapshot.consoleContextSummary.includes(`currentVersion=${pkg.version}`), 'snapshot context must include currentVersion');

const ctx = buildConsoleContextSummary(snapshot);
assert.equal(ctx.status, 'ok', 'console context summary status must be ok');
assert.ok(ctx.summary.includes(`currentVersion=${pkg.version}`), 'context summary must include currentVersion');
console.log('  PASS: version context and JST timestamp checks');

if (typeof previousVault === 'string') {
  process.env.KOSAME_TASK_VAULT_DIR = previousVault;
} else {
  delete process.env.KOSAME_TASK_VAULT_DIR;
}

console.log('✅ v110.84.8 hero task board motion smoke PASSED');
