#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`); failed++; }

function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch { return null; }
}

function checkContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" not found` : 'pattern not found');
}

function makeDataUrl(mimeType, text) {
  return `data:${mimeType};base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

async function main() {
  console.log('===== v113-3-29-attachment-e2e smoke =====');
  console.log('Verifies: multi-image chat -> spec-to-tasks -> handoff save -> AGENT STREAM LOG');
  console.log('');

  const htmlSrc = readFile('public/kosame-live-cockpit.html');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  const liveSrc = readFile('tools/kosame-live-cockpit-server.js');
  checkContains('HTML: error details block exists', htmlSrc, 'chat-error-details');
  checkContains('HTML: file input multiple exists', htmlSrc, /id="chat-file-input"[^>]*multiple/);
  checkContains('chat: stage logs wired', chatSrc, 'appendPipelineStageEvent({');
  checkContains('chat: spec pipeline failure formatter wired', chatSrc, 'formatSpecPipelineFailureReply');
  checkContains('live: runner dispatch stage logs wired', liveSrc, 'runner.dispatch.started');
  checkContains('live: result decision stage logs wired', liveSrc, 'result.decision.updated');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-attachment-e2e-'));
  const activityLog = path.join(tmpRoot, 'shell-agent-activity.jsonl');
  const handoffDir = path.join(tmpRoot, 'handoff');
  const originalEnv = {
    KOSAME_HANDOFF_DIR: process.env.KOSAME_HANDOFF_DIR,
    KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH: process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH,
    KOSAME_WORK_ORDER_HANDOFF_LOG_PATH: process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH,
    KOSAME_WORK_ORDER_RESULT_LOG_PATH: process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH,
    KOSAME_WORK_ORDER_APPROVAL_LOG_PATH: process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH,
  };
  process.env.KOSAME_HANDOFF_DIR = handoffDir;
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = activityLog;
  process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = path.join(tmpRoot, 'hand-offs.jsonl');
  process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = path.join(tmpRoot, 'results.jsonl');
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = path.join(tmpRoot, 'approvals.jsonl');

  const attachments = [
    {
      attachmentId: 'att-e2e-1',
      originalName: 'screen-1.png',
      displayName: 'screen-1.png',
      name: 'screen-1.png',
      mimeType: 'image/png',
      size: 132,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'one'),
    },
    {
      attachmentId: 'att-e2e-2',
      originalName: 'screen-2.png',
      displayName: 'screen-2.png',
      name: 'screen-2.png',
      mimeType: 'image/png',
      size: 133,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'two'),
    },
    {
      attachmentId: 'att-e2e-3',
      originalName: 'screen-3.png',
      displayName: 'screen-3.png',
      name: 'screen-3.png',
      mimeType: 'image/png',
      size: 134,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'three'),
    },
    {
      attachmentId: 'att-e2e-4',
      originalName: 'screen-4.png',
      displayName: 'screen-4.png',
      name: 'screen-4.png',
      mimeType: 'image/png',
      size: 135,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'four'),
    },
  ];

  let reply;
  try {
    const { handleChatRequest } = require(path.join(ROOT, 'tools/kosame-cockpit-chat-server.js'));
    reply = await handleChatRequest({
      message: 'このコンソールのページって作れる？機能も考慮して',
      selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
      selectedProjectId: 'dev-orchestra',
      selectedProjectLabel: 'KOSAME Dev Orchestra',
      attachments,
    });
  } finally {
    if (originalEnv.KOSAME_HANDOFF_DIR === undefined) delete process.env.KOSAME_HANDOFF_DIR;
    else process.env.KOSAME_HANDOFF_DIR = originalEnv.KOSAME_HANDOFF_DIR;
    if (originalEnv.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH === undefined) delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    else process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = originalEnv.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    if (originalEnv.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH === undefined) delete process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
    else process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = originalEnv.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
    if (originalEnv.KOSAME_WORK_ORDER_RESULT_LOG_PATH === undefined) delete process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
    else process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = originalEnv.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
    if (originalEnv.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH === undefined) delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
    else process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = originalEnv.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  }

  assert.ok(reply && reply.ok, 'handleChatRequest should succeed');
  assert.ok(typeof reply.reply === 'string' && reply.reply.includes('設計書を受け付けました'), 'reply should confirm spec pipeline success');
  assert.ok(!/不明なエラー/.test(reply.reply), 'reply should not contain unknown error');
  assert.ok(!reply.error_details, 'success reply should not include error details');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'handoff.save.completed'), 'pipeline trace should include handoff.save.completed');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'attachments.received'), 'pipeline trace should include attachments.received');
  ok('chat->spec pipeline: success reply and trace returned');

  const queuePath = path.join(handoffDir, 'queue.jsonl');
  const latestPath = path.join(handoffDir, 'latest.md');
  assert.ok(fs.existsSync(queuePath), 'queue.jsonl exists');
  assert.ok(fs.existsSync(latestPath), 'latest.md exists');
  const latest = fs.readFileSync(latestPath, 'utf8');
  const queue = fs.readFileSync(queuePath, 'utf8');
  assert.ok(!/data:image\/png;base64/i.test(latest), 'latest.md should not contain raw base64');
  assert.ok(!/data:image\/png;base64/i.test(queue), 'queue.jsonl should not contain raw base64');
  assert.ok(/attachment_manifest_path/.test(queue), 'queue.jsonl should include attachment_manifest_path');
  assert.ok(/attachment_ids/.test(queue), 'queue.jsonl should include attachment_ids');
  ok('handoff save: manifest path and attachment ids persisted safely');

  const manifestDir = path.join(handoffDir, 'attachments');
  const manifestFiles = fs.existsSync(manifestDir)
    ? fs.readdirSync(manifestDir, { withFileTypes: true })
      .flatMap((entry) => entry.isDirectory()
        ? fs.readdirSync(path.join(manifestDir, entry.name)).filter((name) => name === 'manifest.json').map(() => path.join(manifestDir, entry.name, 'manifest.json'))
        : [])
    : [];
  assert.ok(manifestFiles.length >= 1, 'attachment manifest should exist');
  const manifest = JSON.parse(fs.readFileSync(manifestFiles[0], 'utf8'));
  assert.strictEqual(manifest.attachments.length, 4, 'manifest should contain 4 attachments');
  assert.ok(manifest.attachments.every((att) => fs.existsSync(att.storedPath)), 'storedPath should exist for each attachment');
  ok('attachment manifest: storedPath and manifest are valid');

  const activity = fs.existsSync(activityLog) ? fs.readFileSync(activityLog, 'utf8') : '';
  assert.ok(/stage=chat\.received/.test(activity), 'AGENT STREAM LOG should include chat.received');
  assert.ok(/stage=attachments\.received/.test(activity), 'AGENT STREAM LOG should include attachments.received');
  assert.ok(/stage=attachments\.manifest\.saved/.test(activity), 'AGENT STREAM LOG should include attachments.manifest.saved');
  assert.ok(/stage=spec-to-tasks\.started/.test(activity), 'AGENT STREAM LOG should include spec-to-tasks.started');
  assert.ok(/stage=spec-to-tasks\.decomposed/.test(activity), 'AGENT STREAM LOG should include spec-to-tasks.decomposed');
  assert.ok(/stage=handoff\.save\.started/.test(activity), 'AGENT STREAM LOG should include handoff.save.started');
  assert.ok(/stage=handoff\.save\.completed/.test(activity), 'AGENT STREAM LOG should include handoff.save.completed');
  ok('AGENT STREAM LOG: pipeline stage events recorded');

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
