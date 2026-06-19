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
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-16-vault-'));
const TEMP_ACTIVITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-16-activity-'));
const TEMP_ACTIVITY_LOG = path.join(TEMP_ACTIVITY_DIR, 'shell-agent-activity.jsonl');
const EMPTY_ACTIVITY_LOG = path.join(TEMP_ACTIVITY_DIR, 'missing-shell-agent-activity.jsonl');

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

console.log('=== v110.84.16 shell agent activity bridge smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.16'), `package version must be 110.84.16+ compatible (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-16'], 'smoke:v110-84-16 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-16'), 'verify must include smoke:v110-84-16');
console.log('  PASS: package wiring for v110.84.16');

mustExist(HTML_PATH);
const html = readText(HTML_PATH);
assert.ok(html.includes('実行状況'), 'HTML must include the activity tab');
assert.ok(html.includes('shell-agent-activity'), 'HTML must include the shell agent activity section');
assert.ok(html.includes('Shell Agent Activity はまだありません。') || html.includes('shell-agent-activity-feed'), 'HTML must include the shell activity feed markup');
console.log('  PASS: activity markup exists');

const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
try {
  process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;

  const emptySnapshot = collectLiveCockpitSnapshot({
    taskVaultDir: TEMP_VAULT,
    shellAgentActivityLogPath: EMPTY_ACTIVITY_LOG,
  });
  assert.ok(emptySnapshot, 'empty snapshot must be created');
  assert.ok(emptySnapshot.shellAgentActivity, 'empty snapshot must expose shellAgentActivity');
  assert.equal(emptySnapshot.shellAgentActivity.status, 'missing', 'missing activity log must not fail');
  assert.ok(Array.isArray(emptySnapshot.shellAgentActivity.items), 'missing activity log must return items array');
  assert.equal(emptySnapshot.shellAgentActivity.items.length, 0, 'missing activity log must return empty items');

  fs.writeFileSync(
    TEMP_ACTIVITY_LOG,
    [
      JSON.stringify({
        timestamp: '2026-06-16T14:30:00.000Z',
        agent: 'Codex',
        project: 'KOSAME Dev Orchestra',
        status: 'running',
        message: 'v110.84.16 の実装を開始しました',
        task: 'Shell Agent Activity Bridge Lite',
      }),
      '{invalid json}',
      JSON.stringify({
        timestamp: '2026-06-16T14:31:00.000Z',
        agent: 'Claude Code',
        project: 'KOSAME Dev Orchestra',
        status: 'verifying',
        message: 'verify を確認しています',
        task: 'Shell Agent Activity Bridge Lite',
      }),
      JSON.stringify({
        timestamp: '2026-06-16T14:32:00.000Z',
        agent: 'GitHub Actions',
        project: 'KOSAME Dev Orchestra',
        status: 'success',
        message: 'smoke が PASS しました',
        task: 'Shell Agent Activity Bridge Lite',
      }),
    ].join('\n') + '\n',
    'utf8'
  );

  const snapshot = collectLiveCockpitSnapshot({
    taskVaultDir: TEMP_VAULT,
    shellAgentActivityLogPath: TEMP_ACTIVITY_LOG,
  });
  assert.ok(snapshot.shellAgentActivity, 'snapshot must expose shellAgentActivity');
  assert.equal(snapshot.shellAgentActivity.status, 'ok', 'valid activity log must be ok');
  assert.equal(snapshot.shellAgentActivity.items.length, 3, 'invalid JSON rows must be ignored');
  assert.equal(snapshot.shellAgentActivity.items[0].agent, 'GitHub Actions', 'latest shell activity must be first');
  assert.equal(snapshot.shellAgentActivity.items[0].status, 'success', 'success status must be preserved');
  assert.equal(snapshot.shellAgentActivity.items[1].status, 'verifying', 'verifying status must be preserved');
  assert.equal(snapshot.shellAgentActivity.items[2].status, 'running', 'running status must be preserved');
  assert.ok(snapshot.shellAgentActivity.items.every((item) => typeof item.text === 'string' && item.text.length > 0), 'shell activity items must have readable text');
  assert.ok(snapshot.consoleContextSummary.includes('shellActivity='), 'console context summary must include shellActivity');
  assert.ok(snapshot.consoleContextSummary.includes('GitHub Actions'), 'console context summary must include shell agent names');
  assert.ok(!snapshot.consoleContextSummary.includes('OPENAI_API_KEY'), 'console context summary must not leak API keys');
  assert.ok(!snapshot.consoleContextSummary.includes('.env'), 'console context summary must not leak env files');

  const ctx = buildConsoleContextSummary(snapshot);
  assert.equal(ctx.status, 'ok', 'context summary must be ok');
  assert.ok(ctx.summary.includes('shellActivity='), 'context summary must include shellActivity');
  assert.ok(ctx.summary.includes('running='), 'context summary must include shell activity counts');
  assert.ok(!/(?:^|[^0-9])v110\.84\.2(?:[^0-9]|$)/.test(ctx.summary), 'context summary must not include stale version text');

  console.log('  PASS: shell activity snapshot and context integration');
} finally {
  if (typeof previousVault === 'string') {
    process.env.KOSAME_TASK_VAULT_DIR = previousVault;
  } else {
    delete process.env.KOSAME_TASK_VAULT_DIR;
  }
}

console.log('✅ v110.84.16 shell agent activity bridge smoke PASSED');
