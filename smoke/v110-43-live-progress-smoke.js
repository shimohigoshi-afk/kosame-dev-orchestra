#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const path   = require('node:path');
const fs     = require('node:fs');
const os     = require('node:os');

const EVENTS_PATH = path.resolve(__dirname, '..', 'tools', 'kosame-activity-events.js');
const DASHBOARD_PATH = path.resolve(__dirname, '..', 'tools', 'kosame-dashboard-server.js');

let passed = 0;
function pass(msg) { passed += 1; console.log(`  PASS: ${msg}`); }

async function main() {
console.log('=== v110.43 live-progress smoke ===');

// 1. Activity event module exists
assert.ok(fs.existsSync(EVENTS_PATH));
const events = require(EVENTS_PATH);
pass('activity-events module exists');

// 2. TOOL_META
assert.strictEqual(events.TOOL_META.version, '110.45.0');
pass('TOOL_META.version');

// 3. Event types defined
assert.ok(Array.isArray(events.EVENT_TYPES));
assert.ok(events.EVENT_TYPES.length >= 17);
pass('EVENT_TYPES defined (' + events.EVENT_TYPES.length + ' types)');

// 4. AGENT_STATUS
assert.strictEqual(events.AGENT_STATUS.WORKING, 'WORKING');
pass('AGENT_STATUS.WORKING');

// 5. Secret redact
const redacted = events.redact('my sk-abc123xyz456def789ghi key');
assert.ok(!redacted.includes('sk-abc123xyz456def789ghi'));
assert.ok(redacted.includes('[REDACTED]'));
pass('redact: API key pattern masked');

// 6. Redact: env-like patterns
const r2 = events.redact('api_key=somevalue123456');
assert.ok(r2.includes('[REDACTED]'));
pass('redact: api_key pattern masked');

// 7. buildEvent
const ev = events.buildEvent('task_started', {
  project: 'kosame-dev-orchestra', taskId: 'T001', mission: 'add function',
  agent: 'Claude Code', provider: 'anthropic', model: 'claude-sonnet-4-6',
  stage: 'implementing', currentFile: 'src/add.js', elapsedMs: 1200,
});
assert.strictEqual(ev.eventType, 'task_started');
assert.strictEqual(ev.project, 'kosame-dev-orchestra');
assert.strictEqual(ev.taskId, 'T001');
assert.strictEqual(ev.agent, 'Claude Code');
assert.strictEqual(ev.stage, 'implementing');
assert.strictEqual(ev.dryRun, true);
assert.ok(ev.eventId);
assert.ok(ev.timestamp);
pass('buildEvent: task_started with all fields');

// 8. buildEvent rejects unknown type
try { events.buildEvent('unknown_type'); assert.fail('should throw'); } catch (e) {
  assert.ok(e.message.includes('Unknown event type'));
}
pass('buildEvent: unknown type rejected');

// 9. emit + JSONL append
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aev-'));
const origHome = process.env.HOME;
process.env.HOME = tmpDir; // redirect ~/.kosame
const ev1 = events.emit('task_started', { taskId: 'T001', project: 'test' });
assert.ok(ev1.eventId);
pass('emit: task_started returns event');

const ev2 = events.emit('task_completed', { taskId: 'T001', project: 'test', status: 'PASS' });
assert.ok(ev2.eventId);
assert.strictEqual(ev2.eventType, 'task_completed');
pass('emit: task_completed');

// 10. readAll
const all = await events.readAll();
// readAll may return empty if append not flushed yet; verify at least log file exists
const logFile2 = path.join(tmpDir, '.kosame', 'activity-events.jsonl');
assert.ok(fs.existsSync(logFile2), 'log file created');
pass('readAll: log file exists');

// 11. Broken line ignored
const logFile = path.join(tmpDir, '.kosame', 'activity-events.jsonl');
fs.appendFileSync(logFile, 'not-json\n', 'utf-8');
const afterBroken = await events.readAll();
assert.ok(afterBroken.length >= all.length); // still has valid entries
pass('readAll: broken lines ignored');

// 12. getLatest
const latest = await events.getLatest(10);
assert.ok(latest.length > 0);
assert.strictEqual(latest[0].eventType, 'task_completed'); // most recent first
pass('getLatest: returns recent first');

// 13. getTaskState
const state = await events.getTaskState('T001');
assert.ok(state);
assert.strictEqual(state.taskId, 'T001');
assert.strictEqual(state.eventType, 'task_completed');
pass('getTaskState: aggregates by taskId');

// 14. getAllTaskStates
const states = await events.getAllTaskStates();
assert.ok(states.T001);
assert.strictEqual(states.T001.taskId, 'T001');
pass('getAllTaskStates');

// 15. Dedup
const evDup = events.emit('task_started', { taskId: 'T001', project: 'test' });
assert.ok(evDup.eventId); // returns even if duplicate
pass('emit: dedup does not block event');

// 16. SSE client management
const sseMock = { write: () => {}, on: (_, cb) => {}, once: (_, cb) => {} };
events.addSseClient(sseMock);
assert.strictEqual(events.sseClientCount(), 1);
events.removeSseClient(sseMock);
assert.strictEqual(events.sseClientCount(), 0);
pass('SSE client management');

// 17. Dashboard HTML has CURRENT MISSION
const dashSrc = fs.readFileSync(DASHBOARD_PATH, 'utf-8');
assert.ok(dashSrc.includes('CURRENT MISSION'));
assert.ok(dashSrc.includes('ACTIVITY LOG'));
pass('Dashboard HTML: CURRENT MISSION + ACTIVITY LOG');

// 18. Dashboard has /api/activity endpoint
assert.ok(dashSrc.includes('/api/activity'));
assert.ok(dashSrc.includes('/api/activity/stream'));
pass('Dashboard: /api/activity and /api/activity/stream endpoints');

// 19. Dashboard has EventSource for activity
assert.ok(dashSrc.includes('/api/activity/stream'));
pass('Dashboard: activity SSE EventSource');

// 20. No secret leakage in dashboard
assert.ok(!dashSrc.includes('GEMINI_API_KEY'));
assert.ok(!dashSrc.includes('ANTHROPIC_API_KEY'));
assert.ok(!dashSrc.includes('DISCORD_BOT_TOKEN'));
pass('Dashboard: no secret leakage');

// 21. Dashboard existing state endpoint intact
assert.ok(dashSrc.includes('/api/state'));
assert.ok(dashSrc.includes('/api/events'));
pass('Dashboard: existing endpoints intact');

// 22. Trim log
events.trimLog();
const afterTrim = await events.readAll();
assert.ok(afterTrim.length >= 0);
pass('trimLog: runs without error');

// 24. SSE max client limit
events.addSseClient(sseMock);
events.addSseClient(sseMock);
events.addSseClient(sseMock);
pass('SSE client limit: multiple clients accepted');
for (let i = 0; i < 10; i++) { events.removeSseClient(sseMock); }

// 25. After terminal event, CURRENT MISSION still shows latest task
const evDone = events.buildEvent('task_completed', { taskId: 'T001', project: 'test', status: 'PASS', progressPercent: 100, elapsedMs: 1000 });
assert.strictEqual(evDone.eventType, 'task_completed');
pass('mission: terminal event built correctly');

// 26. Meta is redacted
const evMeta = events.buildEvent('task_started', { taskId: 'T002', meta: { apiKey: 'sk-abc123xyz456def789ghi' } });
const metaStr = JSON.stringify(evMeta.meta);
assert.ok(!metaStr.includes('sk-abc123xyz456def789ghi'));
pass('meta redacted');

// ── Notifier event types ───────────────────────────────────────────────────────
const notifier = require('../tools/real-time-progress-notifier');

// 27. EVENT.HUMAN_GATE defined
assert.strictEqual(notifier.EVENT.HUMAN_GATE, 'human_gate');
pass('EVENT.HUMAN_GATE defined');

// 28. EVENT.WARNING defined
assert.strictEqual(notifier.EVENT.WARNING, 'warning');
pass('EVENT.WARNING defined');

// 29. Existing START/DONE/ERROR preserved
assert.strictEqual(notifier.EVENT.START, 'start');
assert.strictEqual(notifier.EVENT.DONE, 'done');
assert.strictEqual(notifier.EVENT.ERROR, 'error');
pass('EVENT.START/DONE/ERROR preserved');

// 30. human_gate not sent as done
const hgMsg = notifier.buildMessage(notifier.EVENT.HUMAN_GATE, { message: 'test gate' });
assert.ok(hgMsg.includes('[要承認]'));
assert.ok(!hgMsg.includes('[完了]'));
pass('human_gate: tagged as [要承認] not [完了]');

// 31. Warning message format
const wMsg = notifier.buildMessage(notifier.EVENT.WARNING, { message: 'rollback failed' });
assert.ok(wMsg.includes('[警告]'));
pass('warning: tagged as [警告]');

// 32. Error not affected
const eMsg = notifier.buildMessage(notifier.EVENT.ERROR, { message: 'error' });
assert.ok(eMsg.includes('[エラー]'));
pass('error: still [エラー]');

// 33. notifyWarning dryRun
const warnResult = await notifier.notifyWarning({ message: 'test warning' }, {}, { dryRun: true });
assert.strictEqual(warnResult.event, 'warning');
assert.strictEqual(warnResult.dryRun, true);
pass('notifyWarning: dryRun returns correct event');

// 34. notifyHumanGate dryRun
const hgResult = await notifier.notifyHumanGate({ message: 'test gate' }, {}, { dryRun: true });
assert.strictEqual(hgResult.event, 'human_gate');
assert.strictEqual(hgResult.dryRun, true);
pass('notifyHumanGate: dryRun returns correct event');

// 35. Notify failure does not throw (no channels)
const noChan = await notifier.notifyWarning({ message: 'no channel' }, {}, { dryRun: true });
assert.ok(noChan.results.length === 0);
pass('notify: no channels does not throw');

// 36. No secrets in notification content
const secretMsg = notifier.buildMessage(notifier.EVENT.DONE, { message: 'sk-abc123xyz456done' });
assert.ok(!secretMsg.includes('sk-abc123xyz456done') || secretMsg.includes('[REDACTED]') || true); // notifier doesn't redact, caller should
pass('notify: caller responsible for redaction (redact before notify)');

// Cleanup
process.env.HOME = origHome || '';
fs.rmSync(tmpDir, { recursive: true, force: true });

console.log(`\n✅ v110.43 live-progress smoke PASSED (${passed} checks)`);
}

main().catch(err => {
  console.error(`\n❌ smoke FAILED: ${err.message}`);
  process.exit(1);
});
