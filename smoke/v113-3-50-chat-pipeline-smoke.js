#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');

async function main() {
  console.log('=== v113.3.50 CHAT Pipeline smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.50'), `version >= 113.3.50 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-50'], 'smoke:v113-3-50 must exist');
  assert.ok(pkg.scripts['start:claude-pipeline'], 'start:claude-pipeline script must exist');
  console.log('  PASS package wiring');

  // ① kosame-claude-auto-launch.js
  const launchPath = path.join(ROOT, 'tools', 'kosame-claude-auto-launch.js');
  assert.ok(fs.existsSync(launchPath), 'tools/kosame-claude-auto-launch.js must exist');
  const launchSrc = fs.readFileSync(launchPath, 'utf8');

  assert.ok(launchSrc.includes('--dangerously-skip-permissions'), 'launcher must use --dangerously-skip-permissions');
  assert.ok(launchSrc.includes('SAFETY_STOP_PATTERNS'), 'launcher must define SAFETY_STOP_PATTERNS');
  assert.ok(launchSrc.includes('完了しました☂️'), 'launcher must emit 完了しました☂️ on success');
  assert.ok(launchSrc.includes('ここで止まりました'), 'launcher must emit ここで止まりました on failure');
  assert.ok(launchSrc.includes('notifyResult'), 'launcher must have notifyResult function');
  assert.ok(launchSrc.includes('appendActivity'), 'launcher must write to shell-agent-activity');
  assert.ok(launchSrc.includes('runner-notifications.jsonl'), 'launcher must write to notification file');
  assert.ok(launchSrc.includes('/api/runner-notify'), 'launcher must POST to /api/runner-notify');
  assert.ok(launchSrc.includes('npm'), 'launcher must run npm verify');
  assert.ok(launchSrc.includes('run verify'), 'launcher must run npm run verify');
  assert.ok(launchSrc.includes('DISPATCH_SAFETY_PREAMBLE'), 'launcher must include safety preamble');
  console.log('  PASS ① kosame-claude-auto-launch.js');

  // ② kosame-runner-queue.js: claudeChatExecutor
  const runnerPath = path.join(ROOT, 'tools', 'kosame-runner-queue.js');
  const runnerSrc = fs.readFileSync(runnerPath, 'utf8');

  assert.ok(runnerSrc.includes('claudeChatExecutor'), 'runner-queue must define claudeChatExecutor');
  assert.ok(runnerSrc.includes('kosame-chat-dispatch'), 'runner-queue must route kosame-chat-dispatch to claude');
  assert.ok(runnerSrc.includes('kosame-claude-auto-launch.js'), 'runner-queue must call kosame-claude-auto-launch.js');
  assert.ok(runnerSrc.includes('module.exports') && runnerSrc.includes("claudeChatExecutor"), 'runner-queue must export claudeChatExecutor');
  console.log('  PASS ② runner-queue: claudeChatExecutor wiring');

  // ③ kosame-live-cockpit-server.js: /api/runner-notify
  const cockpitPath = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
  const cockpitSrc = fs.readFileSync(cockpitPath, 'utf8');

  assert.ok(cockpitSrc.includes('/api/runner-notify'), 'cockpit server must have /api/runner-notify endpoint');
  assert.ok(cockpitSrc.includes("'notify'") || cockpitSrc.includes('"notify"'), 'cockpit must emit notify SSE event');
  console.log('  PASS ③ cockpit: /api/runner-notify endpoint');

  // ④ Safety Stop patterns present in launcher
  const stopPatterns = [
    '本番.*デプロイ',
    'production.*deploy',
    'force.?push',
    'rm\\s+-rf',
    'SAFETY\\s*STOP',
  ];
  for (const p of stopPatterns) {
    assert.ok(launchSrc.includes(p.replace(/\\\\/g, '\\')), `launcher must have pattern ${p}`);
  }
  console.log('  PASS ④ Safety Stop patterns');

  // ⑤ Smoke does NOT reference secrets
  assert.ok(!launchSrc.includes('OPENAI_API_KEY'), 'launcher must not contain OPENAI_API_KEY');
  assert.ok(!launchSrc.includes('GROQ_API_KEY'), 'launcher must not contain GROQ_API_KEY');
  console.log('  PASS ⑤ no secrets in launcher');

  // ⑥ verify script still intact
  assert.ok(pkg.scripts.verify.includes('smoke:cloud-run-launch-pack-max'), 'verify must include cloud-run smoke');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-50'), 'verify must include smoke:v113-3-50');
  console.log('  PASS ⑥ verify script integrity');

  console.log('\n✅ v113.3.50 CHAT Pipeline smoke PASSED');
}

main().catch(err => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
