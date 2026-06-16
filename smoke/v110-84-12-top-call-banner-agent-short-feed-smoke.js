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
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-12-vault-'));
const TEMP_ACTIVITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-12-activity-'));
const TEMP_ACTIVITY_LOG = path.join(TEMP_ACTIVITY_DIR, 'activity-events.jsonl');

function mustExist(filePath) {
  assert.ok(fs.existsSync(filePath), `${filePath} must exist`);
}

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function writeActivityLog(entries) {
  fs.writeFileSync(TEMP_ACTIVITY_LOG, entries.map((entry) => JSON.stringify(entry)).join('\n') + '\n', 'utf8');
}

console.log('=== v110.84.12 top call banner / agent short feed smoke ===');

assert.ok(pkg.version === '110.84.12' || pkg.version === '110.84.13', `package version must be 110.84.12+ compatible (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-12'], 'smoke:v110-84-12 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-12'), 'verify must include smoke:v110-84-12');
console.log('  PASS: package wiring for v110.84.12');

mustExist(HTML_PATH);
const html = readText(HTML_PATH);

assert.ok(html.includes('☂️ KOSAME Console'), 'HTML must include KOSAME Console branding');
assert.ok(html.includes('Dev Orchestra Command Center'), 'HTML must include subtitle');
assert.ok(html.includes('CURRENT MISSION'), 'HTML must include current mission eyebrow');
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
assert.ok(!html.includes('LIVE COMMAND STAGE'), 'HTML must not keep the old live command stage wording');
assert.ok(!html.includes('Cannot set properties of null'), 'HTML must not expose null error text');
console.log('  PASS: signal grid hero and null guard');

assert.ok(html.includes('chat-callout'), 'HTML must include floating chat callout pill');
assert.ok(html.includes('chat-callout-jump'), 'HTML must include chat jump button');
assert.ok(!html.includes('priority-callout'), 'HTML must not include top-center priority alert');
console.log('  PASS: top call banner');

assert.ok(html.includes('AGENT SHORT CONVERSATION FEED'), 'HTML must include agent short conversation feed heading');
assert.ok(html.includes('agent-event-feed'), 'HTML must include agent event feed class');
assert.ok(html.includes('agent-event-feed-item'), 'HTML must include agent event feed item class');
assert.ok(html.includes('START / RUNNING / VERIFY / VERIFY_PASS / HUMAN_GATE / DONE / ERROR / WAITING / BLOCKED'), 'HTML must include level2 template kinds');
console.log('  PASS: short conversation feed markup');

assert.ok(html.includes('ACTIVE TASK STRIP'), 'HTML must include active task strip heading');
assert.ok(html.includes('running-panel'), 'HTML must include running-panel class');
assert.ok(html.includes('task-signal-stream'), 'HTML must include task-signal-stream class');
assert.ok(html.includes('現在進行中のタスクはありません。') || html.includes('running •'), 'HTML must include active task motion copy');
console.log('  PASS: active task motion preserved');

assert.ok(html.includes('KOSAME CHAT'), 'HTML must include KOSAME CHAT heading');
assert.ok(html.includes('chat-action-drawer'), 'HTML must include chat action drawer');
assert.ok(html.includes('通知音: Clear') || html.includes('Sound: Clear') || html.includes('Sound: OFF'), 'HTML must include compact sound label');
assert.ok(html.includes('chat-typing-indicator'), 'HTML must include typing indicator');
console.log('  PASS: chat controls preserved');

const previousVault = process.env.KOSAME_TASK_VAULT_DIR;
process.env.KOSAME_TASK_VAULT_DIR = TEMP_VAULT;

writeActivityLog([
  {
    eventType: 'task_started',
    project: 'dev-orchestra',
    taskId: 'task-001',
    agent: 'Codex',
    message: 'start',
    timestamp: '2026-06-16T00:00:00.000Z',
  },
  {
    eventType: 'agent_started',
    project: 'sales-dx',
    taskId: 'task-002',
    agent: 'Claude Code',
    message: 'running',
    timestamp: '2026-06-16T00:00:10.000Z',
  },
  {
    eventType: 'verify_started',
    project: 'dev-orchestra',
    taskId: 'task-001',
    agent: 'Claude Code',
    message: 'verify',
    timestamp: '2026-06-16T00:00:20.000Z',
  },
  {
    eventType: 'verify_passed',
    project: 'dev-orchestra',
    taskId: 'task-001',
    agent: 'GitHub Actions',
    status: 'PASS',
    message: 'passed',
    timestamp: '2026-06-16T00:00:30.000Z',
  },
  {
    eventType: 'human_gate',
    project: 'sales-dx',
    taskId: 'task-002',
    agent: 'KOSAME',
    message: 'gate',
    timestamp: '2026-06-16T00:00:40.000Z',
  },
  {
    eventType: 'task_completed',
    project: 'dev-orchestra',
    taskId: 'task-001',
    agent: 'KOSAME',
    status: 'PASS',
    message: 'done',
    timestamp: '2026-06-16T00:00:50.000Z',
  },
  {
    eventType: 'task_failed',
    project: 'sales-dx',
    taskId: 'task-002',
    agent: 'KOSAME',
    status: 'FAIL',
    message: 'error',
    timestamp: '2026-06-16T00:01:00.000Z',
  },
  {
    eventType: 'review_started',
    project: 'sales-dx',
    taskId: 'task-002',
    agent: 'KOSAME',
    message: 'waiting',
    timestamp: '2026-06-16T00:01:10.000Z',
  },
  {
    eventType: 'blocked',
    project: 'sales-dx',
    taskId: 'task-003',
    agent: 'KOSAME',
    status: 'BLOCKED',
    message: 'blocked',
    timestamp: '2026-06-16T00:01:20.000Z',
  },
]);

const snapshot = collectLiveCockpitSnapshot({
  taskVaultDir: TEMP_VAULT,
  activityEventLogPath: TEMP_ACTIVITY_LOG,
});

assert.equal(snapshot.currentVersion, pkg.version, 'snapshot currentVersion must match package version');
assert.ok(Array.isArray(snapshot.projectStrip.items), 'snapshot project strip items must exist');
assert.ok(snapshot.projectStrip.items.some((item) => item.selected), 'snapshot project strip must include a selected project');
assert.ok(Array.isArray(snapshot.agentEventFeed.items), 'snapshot agent event feed items must exist');
assert.ok(snapshot.agentEventFeed.items.length >= 6, 'snapshot agent event feed must include template items');
assert.ok(snapshot.agentEventFeed.items.every((item) => typeof item.text === 'string' && item.text.includes('「') && item.text.includes('」')), 'agent event feed text must use short conversation quotes');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'START'), 'agent event feed must include START');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'RUNNING'), 'agent event feed must include RUNNING');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'VERIFY'), 'agent event feed must include VERIFY');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'VERIFY_PASS'), 'agent event feed must include VERIFY_PASS');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'HUMAN_GATE'), 'agent event feed must include HUMAN_GATE');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'DONE'), 'agent event feed must include DONE');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'ERROR'), 'agent event feed must include ERROR');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'WAITING'), 'agent event feed must include WAITING');
assert.ok(snapshot.agentEventFeed.items.some((item) => item.kind === 'BLOCKED'), 'agent event feed must include BLOCKED');
assert.ok(snapshot.consoleContextSummary.includes('projectStrip='), 'console context must include project strip summary');
assert.ok(snapshot.consoleContextSummary.includes('agentEventFeed='), 'console context must include agent event feed summary');
assert.ok(snapshot.consoleContextSummary.includes('releaseTag=v'), 'console context must include release tag');
assert.ok(!snapshot.consoleContextSummary.includes('OPENAI_API_KEY'), 'console context must not leak API key names');
assert.ok(!snapshot.consoleContextSummary.includes('Cannot set properties of null'), 'console context must not leak null errors');

const ctx = buildConsoleContextSummary(snapshot);
assert.equal(ctx.status, 'ok', 'console context summary status must be ok');
assert.ok(ctx.summary.includes('projectStrip='), 'context summary must include project strip summary');
assert.ok(ctx.summary.includes('agentEventFeed='), 'context summary must include agent event feed summary');
assert.ok(ctx.summary.includes(`currentVersion=${pkg.version}`), 'context summary must include current version');
assert.ok(!ctx.summary.includes('v110.84.2'), 'context summary must not keep stale fixed version text');
assert.ok(!ctx.summary.includes('OPENAI_API_KEY'), 'context summary must not leak API key names');
assert.ok(!ctx.summary.includes('.env'), 'context summary must not leak env file names');
console.log('  PASS: snapshot project strip and agent feed safety');

if (typeof previousVault === 'string') {
  process.env.KOSAME_TASK_VAULT_DIR = previousVault;
} else {
  delete process.env.KOSAME_TASK_VAULT_DIR;
}

console.log('✅ v110.84.12 top call banner / agent short feed smoke PASSED');
