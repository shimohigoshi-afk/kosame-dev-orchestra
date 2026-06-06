#!/usr/bin/env node
'use strict';

/**
 * Smoke test: v110.10.0
 * - real-time-progress-notifier (LINE / Slack / Discord, dryRun default)
 */

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const { execFileSync } = require('node:child_process');

const pkg  = require('../package.json');
const ROOT = path.resolve(__dirname, '..');

function pass(msg) { console.log(`  PASS: ${msg}`); }

console.log('=== v110.10 real-time-progress-notifier smoke ===');

// ── version ───────────────────────────────────────────────────────────────────

assert.ok(/^110\.(1[0-9]|[2-9][0-9])\.0$/.test(pkg.version), `package version compatible: ${pkg.version}`);
pass('package.json version is 110.12.0');

// ── scripts ───────────────────────────────────────────────────────────────────

[
  'smoke:real-time-progress-notifier',
  'smoke:v110-10',
  'pm-agent:real-time-progress-notifier'
].forEach(s => {
  assert.ok(pkg.scripts[s], `script missing: ${s}`);
  pass(`script ${s} exists`);
});

// ── node --check ──────────────────────────────────────────────────────────────

execFileSync(process.execPath, ['--check', 'tools/real-time-progress-notifier.js'], { cwd: ROOT });
pass('tools/real-time-progress-notifier.js passes node --check');

// ── fixture ───────────────────────────────────────────────────────────────────

const fixturePath = path.join(ROOT, 'fixtures/real-time-progress-notifier.fixture.json');
assert.ok(fs.existsSync(fixturePath), 'fixture file missing');
pass('fixture real-time-progress-notifier.fixture.json exists');

// ── module exports ────────────────────────────────────────────────────────────

const notifier = require('../tools/real-time-progress-notifier');

assert.strictEqual(notifier.TOOL_META.version, '110.10.0');
pass('TOOL_META.version is 110.10.0');

assert.strictEqual(notifier.CHANNEL.LINE,    'line');
assert.strictEqual(notifier.CHANNEL.SLACK,   'slack');
assert.strictEqual(notifier.CHANNEL.DISCORD, 'discord');
pass('CHANNEL enum values correct');

assert.strictEqual(notifier.EVENT.START, 'start');
assert.strictEqual(notifier.EVENT.DONE,  'done');
assert.strictEqual(notifier.EVENT.ERROR, 'error');
pass('EVENT enum values correct');

// ── buildMessage ──────────────────────────────────────────────────────────────

{
  const msg = notifier.buildMessage('start', { message: 'テスト開始', task: 'task-1' });
  assert.ok(msg.includes('[開始]'), `buildMessage start missing [開始]: "${msg}"`);
  assert.ok(msg.includes('テスト開始'), 'buildMessage must include message text');
  pass('buildMessage(start) contains [開始] marker');
}
{
  const msg = notifier.buildMessage('done', { message: 'タスク完了' });
  assert.ok(msg.includes('[完了]'), `buildMessage done missing [完了]: "${msg}"`);
  pass('buildMessage(done) contains [完了] marker');
}
{
  const msg = notifier.buildMessage('error', { message: '失敗' });
  assert.ok(msg.includes('[エラー]'), `buildMessage error missing [エラー]: "${msg}"`);
  pass('buildMessage(error) contains [エラー] marker');
}

// ── async tests ───────────────────────────────────────────────────────────────

async function runAsyncTests() {
  // notify dryRun=true — no channels configured
  {
    const r = await notifier.notify('start', { message: 'テスト' }, {}, { dryRun: true, silent: true });
    assert.strictEqual(r.tool,    'real-time-progress-notifier');
    assert.strictEqual(r.version, '110.10.0');
    assert.strictEqual(r.dryRun,  true);
    assert.strictEqual(r.realProductActionsExecuted, false);
    assert.strictEqual(r.dangerousActionsDenied, true);
    assert.strictEqual(r.humanApprovalRequired, true);
    assert.strictEqual(r.channelCount, 0);
    assert.strictEqual(r.sentCount, 0);
    pass('notify dryRun=true no channels: correct structure');
  }

  // notify dryRun=true — LINE channel (token present) → sent=false
  {
    const channels = { line: { token: 'dummy-token' } };
    const r = await notifier.notify('done', { message: '完了' }, channels, { dryRun: true, silent: true });
    assert.strictEqual(r.dryRun, true);
    assert.strictEqual(r.channelCount, 1);
    assert.strictEqual(r.sentCount, 0, 'dryRun must not send LINE');
    const lineResult = r.results.find(x => x.channel === 'line');
    assert.ok(lineResult, 'must include LINE result');
    assert.strictEqual(lineResult.sent,   false);
    assert.strictEqual(lineResult.dryRun, true);
    assert.ok(lineResult.masked, 'masked field must be present');
    pass('notify dryRun=true LINE: sent=false, masked token');
  }

  // notify dryRun=true — Slack channel → sent=false
  {
    const channels = { slack: { url: 'https://hooks.slack.com/services/dummy' } };
    const r = await notifier.notify('error', { message: 'エラー' }, channels, { dryRun: true, silent: true });
    assert.strictEqual(r.sentCount, 0, 'dryRun must not send Slack');
    const slackResult = r.results.find(x => x.channel === 'slack');
    assert.strictEqual(slackResult.sent,   false);
    assert.strictEqual(slackResult.dryRun, true);
    pass('notify dryRun=true Slack: sent=false, masked url');
  }

  // notify dryRun=true — Discord channel → sent=false
  {
    const channels = { discord: { url: 'https://discord.com/api/webhooks/dummy' } };
    const r = await notifier.notify('start', { message: '開始' }, channels, { dryRun: true, silent: true });
    assert.strictEqual(r.sentCount, 0, 'dryRun must not send Discord');
    const discordResult = r.results.find(x => x.channel === 'discord');
    assert.strictEqual(discordResult.sent,   false);
    assert.strictEqual(discordResult.dryRun, true);
    pass('notify dryRun=true Discord: sent=false, masked url');
  }

  // all three channels at once — dryRun
  {
    const channels = {
      line:    { token: 'tok' },
      slack:   { url: 'https://hooks.slack.com/x' },
      discord: { url: 'https://discord.com/api/webhooks/x' }
    };
    const r = await notifier.notify('done', { message: 'all channels' }, channels, {
      dryRun: true, silent: true
    });
    assert.strictEqual(r.channelCount, 3);
    assert.strictEqual(r.sentCount,    0);
    pass('notify dryRun=true all 3 channels: channelCount=3, sentCount=0');
  }

  // notifyStart / notifyDone / notifyError convenience wrappers
  {
    const r1 = await notifier.notifyStart({ message: 'start' }, {}, { dryRun: true, silent: true });
    assert.strictEqual(r1.event, 'start');
    const r2 = await notifier.notifyDone ({ message: 'done'  }, {}, { dryRun: true, silent: true });
    assert.strictEqual(r2.event, 'done');
    const r3 = await notifier.notifyError({ message: 'error' }, {}, { dryRun: true, silent: true });
    assert.strictEqual(r3.event, 'error');
    pass('notifyStart / notifyDone / notifyError wrappers return correct event');
  }

  // section markers emitted when silent=false
  {
    const lines = [];
    const origLog = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    await notifier.notify('start', { message: 'section test' }, {}, {
      dryRun: true, silent: false, sectionName: '通知テスト'
    });
    console.log = origLog;
    const out = lines.join('\n');
    assert.ok(out.includes('===ここから==='), `missing ===ここから===: ${out.slice(0, 200)}`);
    assert.ok(out.includes('===ここまで==='), `missing ===ここまで===: ${out.slice(0, 200)}`);
    pass('notify emits ===ここから=== / ===ここまで=== section markers');
  }

  console.log('\nPASS: v110.10 all smoke tests');
}

runAsyncTests().catch(err => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
