#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { readShellAgentActivity } = require('../tools/kosame-shell-agent-activity');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const TOOL = path.join(ROOT, 'tools', 'kosame-shell-agent-activity.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-17-activity-'));
const TEMP_LOG = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');
const TEMP_ENV_LOG = path.join(TEMP_ROOT, 'shell-agent-activity-env.jsonl');
const MISSING_LOG = path.join(TEMP_ROOT, 'missing-shell-agent-activity.jsonl');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-17-vault-'));

function runAppend(args, env = {}) {
  return spawnSync('node', [TOOL, 'append', '--log-path', TEMP_LOG, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

console.log('=== v110.84.17 shell agent activity writer smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.17'), `package version must be 110.84.17+ compatible (got ${pkg.version})`);
assert.ok(pkg.scripts['activity:append'], 'activity:append script must exist');
assert.ok(pkg.scripts['smoke:v110-84-17'], 'smoke:v110-84-17 script must exist');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-17'), 'verify must include smoke:v110-84-17');
console.log('  PASS: package wiring for v110.84.17');

let result = runAppend([
  '--agent', 'Codex',
  '--project', 'KOSAME Dev Orchestra',
  '--status', 'running',
  '--task', 'v110.84.17 Activity Event Writer Lite',
  '--message', '実装を開始しました',
]);
assert.equal(result.status, 0, `append command must succeed: ${result.stderr || result.stdout}`);
assert.ok(fs.existsSync(TEMP_LOG), 'append command must create the JSONL log');

let lines = fs.readFileSync(TEMP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 1, 'append command must write one JSONL row');
let event = JSON.parse(lines[0]);
assert.equal(event.agent, 'Codex', 'appended event must keep agent');
assert.equal(event.status, 'running', 'appended event must keep status');
assert.equal(event.task, 'v110.84.17 Activity Event Writer Lite', 'appended event must keep task');
assert.equal(event.message, '実装を開始しました', 'appended event must keep message');
assert.equal(typeof event.timestamp, 'string', 'appended event must include timestamp');
assert.ok(!event.timestamp.includes('JST'), 'appended event must remain ISO UTC');

result = spawnSync('node', [TOOL, 'append', '--agent', 'Verify', '--project', 'KOSAME Dev Orchestra', '--status', 'verifying', '--task', 'env override check', '--message', '環境変数で保存先を切り替えます'], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: TEMP_ENV_LOG },
});
assert.equal(result.status, 0, `env override append must succeed: ${result.stderr || result.stdout}`);
assert.ok(fs.existsSync(TEMP_ENV_LOG), 'env override append must create the env JSONL log');
lines = fs.readFileSync(TEMP_ENV_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 1, 'env override append must write one JSONL row');
event = JSON.parse(lines[0]);
assert.equal(event.agent, 'Verify', 'env override append must keep agent');
assert.equal(event.status, 'verifying', 'env override append must keep status');

result = runAppend([
  '--agent', 'Codex',
  '--project', 'KOSAME Dev Orchestra',
  '--status', 'oops',
  '--task', 'invalid status check',
  '--message', 'should fail',
]);
assert.notEqual(result.status, 0, 'invalid status must fail');
const invalidOutput = String(result.stderr || result.stdout || '').trim();
if (invalidOutput) {
  assert.ok(/Invalid shell activity status/i.test(invalidOutput), 'invalid status output must be rejected');
}

result = runAppend([
  '--agent', 'Codex',
  '--project', 'KOSAME Dev Orchestra',
  '--status', 'running',
  '--task', 'secret guard check',
  '--message', 'token sk-abc123456789',
]);
assert.notEqual(result.status, 0, 'secret-like input must fail');
const secretOutput = String(result.stderr || result.stdout || '').trim();
if (secretOutput) {
  assert.ok(/Blocked dangerous shell activity/i.test(secretOutput), 'secret-like input output must be blocked');
}
lines = fs.readFileSync(TEMP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 1, 'blocked append must not add rows');

let snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  shellAgentActivityLogPath: TEMP_LOG,
});
assert.equal(snapshot.shellAgentActivity.status, 'ok', 'snapshot must see appended shell activity');
assert.equal(snapshot.shellAgentActivity.items.length, 1, 'snapshot must expose one appended event');
assert.equal(snapshot.shellAgentActivity.items[0].agent, 'Codex', 'snapshot must keep agent');
assert.equal(snapshot.shellAgentActivity.items[0].status, 'running', 'snapshot must keep status');
assert.ok(snapshot.consoleContextSummary.includes('shellActivity='), 'snapshot context summary must include shellActivity');

snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  shellAgentActivityLogPath: MISSING_LOG,
});
assert.equal(snapshot.shellAgentActivity.status, 'missing', 'missing log must not fail');
assert.equal(snapshot.shellAgentActivity.items.length, 0, 'missing log must yield empty items');

const helperView = readShellAgentActivity({ shellAgentActivityLogPath: TEMP_LOG });
assert.equal(helperView.status, 'ok', 'direct helper read must succeed');
assert.equal(helperView.items.length, 1, 'direct helper read must keep one event');

console.log('✅ v110.84.17 shell agent activity writer smoke PASSED');
