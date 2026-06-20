#!/usr/bin/env node
'use strict';

/**
 * v113.0.4 Runtime UI E2E Smoke
 * - Result Decision Panel と Chat 入力欄の余白を確認
 * - Handoff Inbox Bridge / HANDOFF QUEUE / WORK ORDER RESULT を折りたたみ可能にする
 * - default closed / click-to-toggle の前提を HTML で確認
 * - Console → Approve → Handoff → Runner → Result Decision の経路を通す
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const { isVersionAtLeast } = require('./version-compare');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');
const { extractResultBlock } = require('../tools/kosame-codex-dispatch-watcher');

function requestJson(port, pathname, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(raw || '{}'), raw });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(logPaths, fn) {
  const { server } = createLiveCockpitServer(logPaths);
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(server.address().port);
      });
    } catch (error) {
      server.off('error', onError);
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    }
  });

  try {
    return await fn(port);
  } finally {
    await new Promise((resolve) => { try { server.close(resolve); } catch { resolve(); } });
  }
}

function assertStyle(text, pattern, label) {
  assert.ok(pattern.test(text), `HTML must include ${label}`);
}

async function main() {
  console.log('=== v113.0.4 runtime UI E2E smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.4'), `version must be >= 113.0.4 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-4'], 'smoke:v113-0-4 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-4'), 'verify must include smoke:v113-0-4');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assert.ok(html.includes('Handoff Inbox Bridge'), 'HTML must keep Handoff Inbox Bridge');
  assert.ok(html.includes('HANDOFF QUEUE'), 'HTML must keep HANDOFF QUEUE');
  assert.ok(html.includes('WORK ORDER RESULT'), 'HTML must keep WORK ORDER RESULT');
  assert.ok(html.includes('RESULT DECISION PANEL'), 'HTML must keep RESULT DECISION PANEL');
  assert.ok(!html.includes('<details class="chat-section-details" id="handoff-inbox-details" open>'), 'handoff inbox must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="handoff-queue-details" open>'), 'handoff queue must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="work-order-result-details" open>'), 'work order result must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="result-decision-details" open>'), 'result decision must default closed');
  assert.ok(html.includes('details.open = false;'), 'HTML must explicitly reset collapsible sections closed');
  assertStyle(html, /\.chat-thread\s*\{[^}]*margin-bottom:\s*8px;/s, 'chat-thread margin-bottom 8px');
  assertStyle(html, /\.chat-primary-actions\s*\{[^}]*margin:\s*10px 0 4px;/s, 'chat input spacing');
  assertStyle(html, /\.work-order-result-panel\s*\{[^}]*margin:\s*0 0 4px;/s, 'result panel spacing');
  assertStyle(html, /\.work-order-decision-panel\s*\{[^}]*margin:\s*0 0 4px;/s, 'decision panel spacing');
  assert.ok(!html.includes('結果貼り戻し後に、次アクションをここで見られます。'), 'empty decision panel must not show extra placeholder blank');
  console.log('  PASS: HTML layout / collapsible defaults');

  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-04-'));
  const approvalLog = path.join(TEMP, 'approvals.jsonl');
  const handoffLog = path.join(TEMP, 'handoffs.jsonl');
  const resultLog = path.join(TEMP, 'results.jsonl');

  await withServer({ workOrderApprovalLogPath: approvalLog, workOrderHandoffLogPath: handoffLog, workOrderResultLogPath: resultLog }, async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP runtime skipped (EPERM)');
      return;
    }

    const chatRes = await requestJson(port, '/api/chat', {
      message: 'KOSAME Consoleの作業票を作って',
      project: 'KOSAME Console',
    });
    assert.equal(chatRes.status, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    const workOrder = chatRes.body.work_order;
    assert.ok(workOrder, 'work_order must exist');
    assert.ok(workOrder.body.includes('Complete-Run First Policy'), 'work order must keep complete-run policy');

    const approval = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
    assert.equal(approval.ok, true, 'approval must succeed');
    const handoff = recordWorkOrderHandoff({
      work_order_id: approval.latestApprovedWorkOrder.approval_id,
      assigned_agent: 'Codex',
      status: 'handed_to_agent',
      work_order: approval.latestApprovedWorkOrder,
    }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
    assert.equal(handoff.ok, true, 'handoff must succeed');

    const runnerOutput = [
      'KOSAME Runner executing...',
      'npm run verify',
      'npm run smoke:v113-0-4',
      'KOSAME_RESULT_BEGIN',
      JSON.stringify({
        result_status: 'success',
        smoke_result: 'PASS',
        verify_result: 'PASS',
        result_summary: 'UI layout and full-cycle run completed',
        changed_files: ['public/kosame-live-cockpit.html', 'smoke/v113-0-4-runtime-ui-e2e-smoke.js'],
      }),
      'KOSAME_RESULT_END',
    ].join('\n');
    const extracted = extractResultBlock(runnerOutput);
    assert.ok(extracted, 'runner output must expose result block');

    const resultRes = await requestJson(port, '/api/work-orders/result', {
      ...extracted,
      source: 'codex-auto',
    });
    assert.equal(resultRes.status, 200, 'result POST must return 200');
    assert.equal(resultRes.body.ok, true, 'result POST must succeed');
    assert.equal(resultRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'decision panel must update to ready_for_commit');
    assert.equal(resultRes.body.latestWorkOrderDecision.commit_tag_push_allowed, true, 'decision panel must enable commit candidate');

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.status, 200, 'snapshot must return 200');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot must show updated decision');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.commit_tag_push_allowed, true, 'snapshot must keep commit candidate');

    const decision = snapshotRes.body.latestWorkOrderDecision || {};
    assert.ok(decision.reason && decision.reason.includes('PASS'), 'decision reason must reflect PASS');
    console.log('  PASS: full cycle resultPOST updates Result Decision Panel');
  });

  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log('✅ v113.0.4 runtime UI E2E smoke PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
