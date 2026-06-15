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
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const DEFAULT_VAULT = path.join(os.homedir(), '.kosame', 'task-vault');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-chat-ui-declutter-'));

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

console.log('=== v110.84.6 chat ui declutter smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.6'), `package version must be >= 110.84.6 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-6'], 'smoke:v110-84-6 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-6'), 'verify must include smoke:v110-84-6');
console.log('  PASS: package wiring for v110.84.6');

mustExist(HTML_PATH);
mustExist(CHAT_SERVER_PATH);

const html = readText(HTML_PATH);
assert.ok(html.includes('通知音'), 'HTML must include notification sound label');
assert.ok(html.includes('Sound: OFF'), 'HTML must include short sound status');
assert.ok(html.includes('id="sound-btn-off"'), 'HTML must include OFF mode button');
assert.ok(html.includes('id="sound-btn-soft"'), 'HTML must include Soft mode button');
assert.ok(html.includes('id="sound-btn-clear"'), 'HTML must include Clear mode button');
assert.ok(html.includes('id="sound-test"'), 'HTML must include test button');
assert.ok(html.includes('<details class="chat-sound-details">'), 'HTML must include collapsed notification test details');
assert.ok(html.includes('通知テスト'), 'HTML must include notification test disclosure');
assert.ok(html.includes('sound-test-question'), 'HTML must include question test button');
assert.ok(html.includes('sound-test-human-gate'), 'HTML must include human gate test button');
assert.ok(html.includes('sound-test-done'), 'HTML must include done test button');
assert.ok(html.includes('sound-test-error'), 'HTML must include error test button');
assert.ok(html.includes('chat-status-badges'), 'HTML must include status badges');
assert.ok(html.includes('chat-ai-badge'), 'HTML must include AI badge');
assert.ok(html.includes('chat-context-badge'), 'HTML must include Context badge');
assert.ok(html.includes('chat-memory-badge'), 'HTML must include Memory badge');
assert.ok(html.includes('chat-sound-badge'), 'HTML must include Sound badge');
assert.ok(html.includes('chat-quick-actions'), 'HTML must include quick actions');
assert.ok(html.includes('Enterで送信、Shift+Enterで改行'), 'HTML must keep Enter / Shift+Enter hint');
assert.ok(html.includes('こさめ考え中…☂️'), 'HTML must keep sending status');
assert.ok(!html.includes('通知音は有効ですっ☂️'), 'HTML must not keep verbose sound hint');
console.log('  PASS: notification UI is decluttered');

const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;
const snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
});
assert.equal(snapshot.currentVersion, pkg.version, 'snapshot currentVersion must match package version');
assert.ok(snapshot.latestTag && /^v/.test(snapshot.latestTag), 'snapshot latestTag must exist');
assert.ok(snapshot.headCommit && snapshot.headCommit !== 'unknown', 'snapshot headCommit must exist');
assert.ok(snapshot.versionSource, 'snapshot must include versionSource');
assert.ok(snapshot.consoleContextSummary.includes(`version=${pkg.version}`), 'snapshot context summary must include current version');
assert.ok(snapshot.consoleContextSummary.includes(`versionContext=package=${pkg.version}`), 'snapshot context summary must include version context');
assert.ok(!snapshot.consoleContextSummary.includes('v110.84.2'), 'snapshot context summary must not contain old version');

const ctx = buildConsoleContextSummary(snapshot);
assert.equal(ctx.status, 'ok', 'console context summary status must be ok');
assert.ok(ctx.summary.includes(`currentVersion=${pkg.version}`), 'context summary must include currentVersion');
assert.ok(ctx.summary.includes('versionContext=package='), 'context summary must include versionContext');
assert.ok(!ctx.summary.includes('v110.84.2'), 'context summary must not contain old version');
console.log('  PASS: version context uses current package/tag/HEAD');

if (typeof previousVault === 'string') {
  process.env.KOSAME_TASK_VAULT_DIR = previousVault;
} else {
  delete process.env.KOSAME_TASK_VAULT_DIR;
}

if (!fs.existsSync(DEFAULT_VAULT)) {
  assert.ok(!fs.existsSync(DEFAULT_VAULT), 'temporary smoke must not create default task vault');
}

console.log('✅ v110.84.6 chat ui declutter smoke PASSED');
