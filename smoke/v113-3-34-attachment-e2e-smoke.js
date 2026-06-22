#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');

function makeDataUrl(mimeType, text) {
  const payload = Buffer.from(String(text).repeat(80), 'utf8').toString('base64');
  return `data:${mimeType};base64,${payload}`;
}

console.log('===== v113.3.34 attachment e2e smoke =====');

async function main() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v113-3-34-e2e-'));
  const handoffDir = path.join(tmpRoot, 'handoff');
  const shellLog = path.join(tmpRoot, 'shell-agent-activity.jsonl');
  const resultLog = path.join(tmpRoot, 'work-order-results.jsonl');
  const handoffLog = path.join(tmpRoot, 'work-order-handoffs.jsonl');
  const approvalLog = path.join(tmpRoot, 'work-order-approvals.jsonl');
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = shellLog;
  process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = resultLog;
  process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = handoffLog;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = approvalLog;

  const attachments = [
    { attachmentId: 'att-1', originalName: 'screen-1.png', displayName: 'screen-1.png', name: 'screen-1.png', mimeType: 'image/png', size: 111, kind: 'image', ext: '.png', base64DataUrl: makeDataUrl('image/png', 'one') },
    { attachmentId: 'att-2', originalName: 'screen-2.png', displayName: 'screen-2.png', name: 'screen-2.png', mimeType: 'image/png', size: 112, kind: 'image', ext: '.png', base64DataUrl: makeDataUrl('image/png', 'two') },
    { attachmentId: 'att-3', originalName: 'screen-3.png', displayName: 'screen-3.png', name: 'screen-3.png', mimeType: 'image/png', size: 113, kind: 'image', ext: '.png', base64DataUrl: makeDataUrl('image/png', 'three') },
    { attachmentId: 'att-4', originalName: 'screen-4.png', displayName: 'screen-4.png', name: 'screen-4.png', mimeType: 'image/png', size: 114, kind: 'image', ext: '.png', base64DataUrl: makeDataUrl('image/png', 'four') },
  ];

  const reply = await handleChatRequest({
    message: 'このコンソールのページって作れる？機能も考慮して',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    handoffDir,
    attachments,
  });

  assert.equal(reply.ok, true, 'chat request should succeed');
  assert.ok(reply.reply.includes('設計書を受け付けました'), 'spec pipeline should complete');
  assert.ok(!/不明なエラー/.test(reply.reply), 'unknown error text should not appear');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'chat.received'), 'chat.received should be traced');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'attachments.received'), 'attachments.received should be traced');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'attachments.manifest.saved'), 'attachments.manifest.saved should be traced');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'spec-to-tasks.started'), 'spec-to-tasks.started should be traced');
  assert.ok(Array.isArray(reply.pipeline_trace) && reply.pipeline_trace.some((stage) => stage.stage === 'result.decision.updated'), 'result.decision.updated should be traced');
  assert.match(reply.reply, /作業票 \d+ 件を生成してHandoff Inboxに保存しました/);
  const handoffText = fs.readFileSync(path.join(handoffDir, 'latest.md'), 'utf8');
  const queueText = fs.readFileSync(path.join(handoffDir, 'queue.jsonl'), 'utf8');
  assert.ok(!/data:image\/png;base64/i.test(handoffText), 'latest.md should not contain raw base64');
  assert.ok(!/data:image\/png;base64/i.test(queueText), 'queue.jsonl should not contain raw base64');
  assert.ok(queueText.includes('attachment_manifest_path'), 'queue.jsonl should keep manifest reference');
  assert.ok(queueText.includes('codex_yes_hell_guard'), 'queue.jsonl should keep guard evidence');
  assert.ok(queueText.includes('interactive_prompt_blocked'), 'queue.jsonl should keep interactive prompt evidence');

  const attachmentManifestDir = path.join(handoffDir, 'attachments');
  const workDirs = fs.existsSync(attachmentManifestDir) ? fs.readdirSync(attachmentManifestDir, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => path.join(attachmentManifestDir, entry.name)) : [];
  assert.ok(workDirs.length >= 1, 'at least one attachment work directory should be created');
  const manifests = workDirs
    .map((dir) => path.join(dir, 'manifest.json'))
    .filter((manifestPath) => fs.existsSync(manifestPath))
    .map((manifestPath) => JSON.parse(fs.readFileSync(manifestPath, 'utf8')));
  assert.ok(manifests.length >= 1, 'manifest.json should exist');
  assert.ok(manifests.some((manifest) => manifest.attachments.length === 4), 'a manifest should include 4 attachments');
  assert.ok(manifests.some((manifest) => manifest.attachments.every((item) => fs.existsSync(item.storedPath))), 'storedPath should exist for every attachment');

  const activityLog = fs.readFileSync(shellLog, 'utf8');
  assert.ok(activityLog.includes('KOSAME: 受信した入力を受け付けました☂️') || activityLog.includes('KOSAME: 添付4件を受け取りました☂️'), 'shell activity should record receipt');
  assert.ok(activityLog.includes('DIRECTOR: 作業票化を開始します☂️'), 'shell activity should record spec start');
  assert.ok(activityLog.includes('Runner: result.decision.updated') || activityLog.includes('Runner'), 'runner activity should be recorded');
  assert.ok(!activityLog.includes('不明なエラー'), 'activity should not contain unknown error');

  console.log('  PASS: attachment e2e completed');
  console.log('  PASS: no raw base64 stored in handoff text');
  console.log('  PASS: AGENT STREAM LOG recorded pipeline stages');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
