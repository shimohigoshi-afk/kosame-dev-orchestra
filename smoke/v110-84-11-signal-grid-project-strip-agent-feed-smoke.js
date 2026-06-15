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
const TEMP_VAULT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-11-vault-'));
const TEMP_ACTIVITY_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-11-activity-'));
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

console.log('=== v110.84.11 signal grid project strip agent feed smoke ===');

assert.equal(pkg.version, '110.84.11', `package version must be 110.84.11 (got ${pkg.version})`);
assert.ok(pkg.scripts['smoke:v110-84-11'], 'smoke:v110-84-11 must exist in scripts');
assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-11'), 'verify must include smoke:v110-84-11');
console.log('  PASS: package wiring for v110.84.11');

mustExist(HTML_PATH);
const html = readText(HTML_PATH);

assert.ok(html.includes('☂️ KOSAME Console'), 'HTML must include KOSAME Console branding');
assert.ok(html.includes('Dev Orchestra Command Center'), 'HTML must include subtitle');
assert.ok(html.includes('SIGNAL GRID HERO LITE'), 'HTML must include signal grid hero lite eyebrow');
assert.ok(html.includes('signal-grid-hero-visual'), 'HTML must include signal grid hero visual class');
assert.ok(!html.includes('大きい丸'), 'HTML must not bring back the big circle hero');
console.log('  PASS: signal grid hero lite');

assert.ok(html.includes('PROJECT STRIP'), 'HTML must include project strip');
assert.ok(html.includes('project-strip'), 'HTML must include project strip class');
assert.ok(html.includes('project-strip-item'), 'HTML must include project strip item class');
assert.ok(html.includes('SELECTED PROJECT FOCUS PANEL'), 'HTML must include project focus panel');
assert.ok(html.includes('project-focus-panel'), 'HTML must include project focus panel class');
assert.ok(html.includes('DEV ORCHESTRA STATUS') || html.includes('Sales DX STATUS'), 'HTML must keep project registry status titles');
console.log('  PASS: project strip and focus panel');

assert.ok(html.includes('AGENT EVENT FEED'), 'HTML must include agent event feed heading');
assert.ok(html.includes('agent-event-feed'), 'HTML must include agent event feed class');
assert.ok(html.includes('agent-event-feed-item'), 'HTML must include agent event feed item class');
assert.ok(html.includes('START / RUNNING / VERIFY / VERIFY_PASS / HUMAN_GATE / DONE / ERROR / WAITING / BLOCKED'), 'HTML must include level2 template kinds');
assert.ok(!html.includes('OPENAI_API_KEY'), 'HTML must not leak API key names');
console.log('  PASS: agent event feed markup');

assert.ok(html.includes('ACTIVE TASK STRIP'), 'HTML must include active task strip heading');
assert.ok(html.includes('running-panel'), 'HTML must include running-panel class');
assert.ok(html.includes('task-signal-stream'), 'HTML must include task-signal-stream class');
assert.ok(html.includes('running •') || html.includes('現在進行中のタスクはありません。'), 'HTML must include running task motion copy');
console.log('  PASS: running task motion');

assert.ok(html.includes('KOSAME CHAT'), 'HTML must include KOSAME CHAT heading');
assert.ok(!html.includes('KOSAME CHAT — こさめ相談'), 'HTML must not include old chat subtitle');
assert.ok(html.includes('この内容で進める'), 'HTML must include the main proceed button');
assert.ok(html.includes('chat-action-drawer'), 'HTML must include chat action drawer');
assert.ok(html.includes('chat-action-tabs'), 'HTML must include chat action tabs');
assert.ok(html.includes('通知音: Clear') || html.includes('Sound: Clear') || html.includes('Sound: OFF'), 'HTML must include compact sound label');
assert.ok(html.includes('sound-test'), 'HTML must include test sound button');
console.log('  PASS: chat retains compact controls');

assert.ok(html.includes('COLLAPSED DETAILS'), 'HTML must include collapsed details section');
assert.ok(html.includes('support-details-stack'), 'HTML must include support details stack');
assert.ok(html.includes('AUTO SAVE / TASK VAULT'), 'HTML must include auto save / task vault detail');
assert.ok(html.includes('MEMORY VAULT'), 'HTML must include memory vault detail');
assert.ok(html.includes('WISHLIST / IDEA BOARD'), 'HTML must include idea board detail');
console.log('  PASS: collapsed details preserved');

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
assert.equal(snapshot.packageVersion, pkg.version, 'snapshot packageVersion must match package version');
assert.ok(Array.isArray(snapshot.projectStrip.items), 'snapshot projectStrip items must exist');
assert.ok(snapshot.projectStrip.items.length >= 2, 'snapshot project strip must include at least 2 projects');
assert.ok(snapshot.projectStrip.items.some((item) => item.selected), 'snapshot project strip must include a selected project');
assert.ok(Array.isArray(snapshot.agentEventFeed.items), 'snapshot agent event feed items must exist');
assert.ok(snapshot.agentEventFeed.items.length >= 6, 'snapshot agent event feed must include template items');
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
assert.ok(!snapshot.consoleContextSummary.includes('OPENAI_API_KEY'), 'console context must not leak API key names');

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

console.log('✅ v110.84.11 signal grid project strip agent feed smoke PASSED');
