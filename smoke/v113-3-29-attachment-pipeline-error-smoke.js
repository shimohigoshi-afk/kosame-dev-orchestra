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

function checkNotContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (!found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" unexpectedly found` : 'pattern unexpectedly found');
}

function makeDataUrl(mimeType, text) {
  return `data:${mimeType};base64,${Buffer.from(text, 'utf8').toString('base64')}`;
}

async function main() {
  console.log('===== v113-3-29-attachment-pipeline-error smoke =====');
  console.log('Verifies: structured error transparency + no unknown error fallback');
  console.log('');

  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  const specSrc = readFile('tools/kosame-spec-to-tasks.js');
  const telemetrySrc = readFile('tools/kosame-pipeline-telemetry.js');
  checkNotContains('chat: unknown error fallback removed', chatSrc, /不明なエラー/);
  checkContains('chat: failure formatter exists', chatSrc, 'formatSpecPipelineFailureReply');
  checkContains('spec: structured pipeline error helper exists', specSrc, 'createPipelineError(');
  checkContains('spec: stage history summary exists', specSrc, 'stageHistorySummary');
  checkContains('telemetry: appendPipelineStageEvent exists', telemetrySrc, 'function appendPipelineStageEvent(');
  checkContains('telemetry: createPipelineError exists', telemetrySrc, 'function createPipelineError(');

  const { processSpec } = require(path.join(ROOT, 'tools/kosame-spec-to-tasks.js'));
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-attachment-error-'));
  const attachments = [
    {
      attachmentId: 'att-error-1',
      originalName: 'diagram-1.png',
      displayName: 'diagram-1.png',
      name: 'diagram-1.png',
      mimeType: 'image/png',
      size: 123,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'image-one'),
    },
    {
      attachmentId: 'att-error-2',
      originalName: 'diagram-2.png',
      displayName: 'diagram-2.png',
      name: 'diagram-2.png',
      mimeType: 'image/png',
      size: 124,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'image-two'),
    },
    {
      attachmentId: 'att-error-3',
      originalName: 'diagram-3.png',
      displayName: 'diagram-3.png',
      name: 'diagram-3.png',
      mimeType: 'image/png',
      size: 125,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'image-three'),
    },
    {
      attachmentId: 'att-error-4',
      originalName: 'diagram-4.png',
      displayName: 'diagram-4.png',
      name: 'diagram-4.png',
      mimeType: 'image/png',
      size: 126,
      kind: 'image',
      ext: '.png',
      base64DataUrl: makeDataUrl('image/png', 'image-four'),
    },
    {
      attachmentId: 'att-error-text',
      originalName: 'notes.md',
      displayName: 'notes.md',
      name: 'notes.md',
      mimeType: 'text/markdown',
      size: 48,
      kind: 'text',
      ext: '.md',
      textContent: '# notes\n- 4 images attached\n- implement console page',
    },
  ];

  const failingResult = await processSpec({
    message: 'このコンソールのページって作れる？機能も考慮して',
    attachments,
    projectPath: '/home/lavie/kosame-dev-orchestra',
    handoffDir: tmpRoot,
    saveHandoffInbox: () => { throw new Error('forced manifest failure for error transparency'); },
  });

  assert.ok(!failingResult.ok, 'forced failure should return ok=false');
  assert.strictEqual(failingResult.errorStage, 'handoff.save');
  assert.strictEqual(failingResult.errorCode, 'HANDOFF_SAVE_FAILED');
  assert.ok(/forced manifest failure/.test(failingResult.errorMessage), 'errorMessage should be preserved');
  assert.ok(failingResult.workOrderId, 'workOrderId should be present');
  assert.strictEqual(failingResult.attachmentCount, 5);
  assert.ok(Array.isArray(failingResult.attachmentIds) && failingResult.attachmentIds.length === 5, 'attachmentIds should be preserved');
  assert.strictEqual(failingResult.route, 'spec-to-tasks');
  assert.ok(failingResult.timestamp, 'timestamp should be present');
  assert.ok(Array.isArray(failingResult.stageHistory) && failingResult.stageHistory.some((stage) => stage.stage === 'handoff.save.started'), 'stageHistory should include handoff.save.started');
  assert.ok(Array.isArray(failingResult.stageHistory) && failingResult.stageHistory.some((stage) => stage.stage === 'handoff.save' && stage.status === 'failed'), 'stageHistory should include failed handoff.save');
  assert.ok(!/不明なエラー/.test(failingResult.errorMessage || ''), 'unknown error fallback must not appear');
  ok('structured failure: stage/code/message/workOrderId returned');

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
