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
const TOOL = path.join(ROOT, 'tools', 'kosame-shell-agent-activity-runner.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-18-runner-'));
const TEMP_LOG = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');
const MISSING_LOG = path.join(TEMP_ROOT, 'missing-shell-agent-activity.jsonl');
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-18-vault-'));

function runRunner(scriptName, extraArgs = [], env = {}) {
  return spawnSync('node', [TOOL, '--script', scriptName, '--agent', 'Codex', '--project', 'KOSAME Dev Orchestra', '--task', 'v110.84.18 Agent Activity Auto Hooks Lite', ...extraArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

console.log('=== v110.84.18 shell agent activity runner smoke ===');

assert.ok(isVersionAtLeast(pkg.version, '110.84.18'), `package version must be 110.84.18+ compatible (got ${pkg.version})`);
assert.ok(pkg.scripts['activity:run'], 'activity:run script must exist');
assert.ok(pkg.scripts['activity:verify'], 'activity:verify script must exist');
assert.ok(pkg.scripts['activity:smoke:v110-84-18'], 'activity:smoke:v110-84-18 script must exist');
assert.ok(pkg.scripts['smoke:v110-84-18'], 'smoke:v110-84-18 script must exist');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-18'), 'verify must include smoke:v110-84-18');
console.log('  PASS: package wiring for v110.84.18');

let result = runRunner('smoke:v110-84-17', ['--message', 'success path check'], {
  KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: TEMP_LOG,
});
assert.equal(result.status, 0, `runner success path must succeed: ${result.stderr || result.stdout}`);
let lines = fs.readFileSync(TEMP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 2, 'runner success path must append start and success events');
let event = JSON.parse(lines[0]);
assert.equal(event.status, 'running', 'runner success path must start with running');
assert.equal(event.agent, 'Codex', 'runner event must keep agent');
assert.equal(event.project, 'KOSAME Dev Orchestra', 'runner event must keep project');
assert.equal(event.task, 'v110.84.18 Agent Activity Auto Hooks Lite', 'runner event must keep task');
assert.equal(event.message, 'smoke:v110-84-17 を開始しました', 'runner start message must be short');
assert.deepEqual(Object.keys(event).sort(), ['agent', 'message', 'project', 'status', 'task', 'timestamp'], 'runner event must stay on safe fields');
event = JSON.parse(lines[1]);
assert.equal(event.status, 'success', 'runner success path must append success event');
assert.equal(event.message, 'smoke:v110-84-17 が成功しました', 'runner success message must be short');

result = runRunner('activity:fail-sample', ['--message', 'failure path check'], {
  KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: TEMP_LOG,
});
assert.notEqual(result.status, 0, 'runner failure path must fail');
lines = fs.readFileSync(TEMP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 4, 'runner failure path must append start and failed events');
event = JSON.parse(lines[2]);
assert.equal(event.status, 'running', 'runner failure path must start with running');
event = JSON.parse(lines[3]);
assert.equal(event.status, 'failed', 'runner failure path must append failed event');
assert.equal(event.message, 'activity:fail-sample が失敗しました', 'runner failed message must be short');

result = runRunner('not-allowed-script', [], {
  KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: TEMP_LOG,
});
assert.notEqual(result.status, 0, 'whitelist rejection must fail');
lines = fs.readFileSync(TEMP_LOG, 'utf8').trim().split(/\r?\n/).filter(Boolean);
assert.equal(lines.length, 4, 'whitelist rejection must not append rows');

const snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  shellAgentActivityLogPath: TEMP_LOG,
});
assert.equal(snapshot.shellAgentActivity.status, 'ok', 'snapshot must see runner events');
assert.ok(snapshot.shellAgentActivity.items.length >= 4, 'snapshot must include runner events');
assert.ok(snapshot.consoleContextSummary.includes('shellActivity='), 'console context summary must include shell activity');

const helperView = readShellAgentActivity({ shellAgentActivityLogPath: MISSING_LOG });
assert.equal(helperView.status, 'missing', 'missing log must not fail');
assert.equal(helperView.items.length, 0, 'missing log must yield empty items');

console.log('✅ v110.84.18 shell agent activity runner smoke PASSED');
