#!/usr/bin/env node
'use strict';

/**
 * v113.1.0 Real Console Dogfood E2E Smoke
 * - Console layout: decision panel spacing / collapsible sections / default closed
 * - Execution path logging: executor / yesCount / copyCount / humanWait / resultPOST
 * - Local Console runtime: chat -> approve -> handoff -> resultPOST -> decision update
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
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');

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

function assertContains(html, value, label) {
  assert.ok(html.includes(value), label);
}

async function main() {
  console.log('=== v113.1.0 real console dogfood e2e smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.1.0'), `version must be >= 113.1.0 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-1-0'], 'smoke:v113-1-0 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-1-0'), 'verify must include smoke:v113-1-0');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assertContains(html, 'Handoff Inbox Bridge', 'HTML must keep Handoff Inbox Bridge');
  assertContains(html, 'HANDOFF QUEUE', 'HTML must keep HANDOFF QUEUE');
  assertContains(html, 'WORK ORDER RESULT', 'HTML must keep WORK ORDER RESULT');
  assertContains(html, 'RESULT DECISION PANEL', 'HTML must keep RESULT DECISION PANEL');
  assert.ok(!html.includes('<details class="chat-section-details" id="handoff-inbox-details" open>'), 'handoff inbox must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="handoff-queue-details" open>'), 'handoff queue must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="work-order-result-details" open>'), 'work order result must default closed');
  assert.ok(!html.includes('<details class="chat-section-details" id="result-decision-details" open>'), 'result decision must default closed');
  assertContains(html, 'details.open = false;', 'HTML must explicitly reset collapsible sections closed');
  assertContains(html, '"chat-outer" style="margin-top:10px"', 'chat-outer margin-top must remain natural');
  assertContains(html, '#result-decision-details .chat-section-body { padding-bottom: 2px; }', 'result-decision spacing must stay compact');
  assertContains(html, 'executor: ${current.executor || current.assigned_agent || \'Codex\'}', 'Result Decision Panel must render executor');
  assertContains(html, 'route: ${current.route || \'zero-confirm\'}', 'Result Decision Panel must render route');
  assertContains(html, 'resultPOST: ${current.result_post || current.resultPOST || \'POST /api/work-orders/result 200\'}', 'Result Decision Panel must render resultPOST');
  assertContains(html, 'execution path: ${current.execution_path || current.executionPath || \'Console → 作業票採用 → watcher → claude-zero-confirm → verify / smoke → commit → tag → push → resultPOST → Result Decision\'}', 'Result Decision Panel must render execution path');
  assertContains(html, '承認要求回数: ${formatZeroConfirmCounterLabel(current.approval_request_count ?? current.yes_count)}', 'Result Decision Panel must render approval request count');
  assertContains(html, '手動貼付回数: ${formatZeroConfirmCounterLabel(current.manual_paste_count ?? current.copy_count)}', 'Result Decision Panel must render manual paste count');
  assertContains(html, '待機要求回数: ${formatZeroConfirmCounterLabel(current.wait_request_count ?? current.human_wait)}', 'Result Decision Panel must render wait request count');
  assertContains(html, '最新の採用済み作業票', 'HTML must keep approval strip');
  assert.ok(!html.includes('結果貼り戻し後に、次アクションをここで見られます。'), 'empty decision panel must not show extra placeholder blank');
  console.log('  PASS: HTML layout / collapsible defaults / execution path labels');

  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-10-'));
  const approvalLog = path.join(TEMP, 'approvals.jsonl');
  const handoffLog = path.join(TEMP, 'handoffs.jsonl');
  const resultLog = path.join(TEMP, 'results.jsonl');
  const activityLog = path.join(TEMP, 'activity.jsonl');

  await withServer({
    workOrderApprovalLogPath: approvalLog,
    workOrderHandoffLogPath: handoffLog,
    workOrderResultLogPath: resultLog,
    shellAgentActivityLogPath: activityLog,
  }, async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP runtime skipped (EPERM)');
      return;
    }

    const exactRequest = 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して';
    const chatRes = await requestJson(port, '/api/chat', {
      message: exactRequest,
      project: 'KOSAME Dev Orchestra',
    });
    assert.equal(chatRes.status, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    const workOrder = chatRes.body.work_order;
    assert.ok(workOrder, 'work_order must exist');
    assert.equal(workOrder.target_repo, '/home/lavie/kosame-dev-orchestra', 'target repo must stay on KOSAME Dev Orchestra');
    assert.equal(workOrder.assigned_agent || workOrder.agent, 'Codex', 'agent must be Codex');
    assert.ok(String(workOrder.originalRequest || workOrder.original_request || '').includes('作業票化して'), 'originalRequest must remain');
    assert.ok(String(workOrder.body || '').includes('originalRequest'), 'body must preserve originalRequest');
    assert.ok(String(workOrder.body || '').includes('Complete-Run First Policy'), 'body must keep complete-run policy');

    const approval = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
    assert.equal(approval.ok, true, 'approval must succeed');
    const approved = approval.latestApprovedWorkOrder;
    assert.ok(approved, 'latestApprovedWorkOrder must exist');
    assert.equal(approved.target_repo, '/home/lavie/kosame-dev-orchestra', 'approval target must stay on dev orchestra');

    const handoff = recordWorkOrderHandoff({
      work_order_id: approved.approval_id,
      assigned_agent: 'Codex',
      status: 'handed_to_agent',
      work_order: approved,
    }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
    assert.equal(handoff.ok, true, 'handoff must succeed');

    const resultRes = await requestJson(port, '/api/work-orders/result', {
      work_order_id: approved.approval_id,
      approval_id: approved.approval_id,
      handoff_id: approved.approval_id,
      work_order: handoff.latestHandoffWorkOrder,
      executor: 'claude-zero-confirm',
      result_post: 'POST /api/work-orders/result 200',
      execution_path: 'Console → 作業票採用 → watcher → claude-zero-confirm → verify / smoke → commit → tag → push → resultPOST → Result Decision',
      result_status: 'success',
      smoke_result: 'PASS',
      verify_result: 'PASS',
      result_summary: 'Real Console dogfood end-to-end completed.',
      changed_files: ['public/kosame-live-cockpit.html', 'smoke/v113-1-0-real-console-dogfood-e2e-smoke.js'],
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
      source: 'kosame-console',
    });
    assert.equal(resultRes.status, 200, 'result POST must return 200');
    assert.equal(resultRes.body.ok, true, 'result POST must succeed');
    assert.equal(resultRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'decision panel must reach ready_for_commit');
    assert.equal(resultRes.body.latestWorkOrderDecision.commit_tag_push_allowed, true, 'decision panel must allow commit candidate');
    assert.equal(resultRes.body.latestWorkOrderDecision.executor, 'claude-zero-confirm', 'decision panel must surface executor');
    assert.equal(resultRes.body.latestWorkOrderDecision.result_post, 'POST /api/work-orders/result 200', 'decision panel must surface resultPOST');
    assert.equal(resultRes.body.latestWorkOrderDecision.yes_count, 0, 'yesCount must be 0');
    assert.equal(resultRes.body.latestWorkOrderDecision.copy_count, 0, 'copyCount must be 0');
    assert.equal(resultRes.body.latestWorkOrderDecision.human_wait, 0, 'humanWait must be 0');
    assert.ok(String(resultRes.body.latestWorkOrderDecision.summary || '').includes('executor=claude-zero-confirm'), 'decision summary must include executor');
    assert.ok(String(resultRes.body.latestWorkOrderDecision.summary || '').includes('resultPOST=POST /api/work-orders/result 200'), 'decision summary must include resultPOST');

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.status, 200, 'snapshot must return 200');
    const snapshot = snapshotRes.body;
    assert.equal(snapshot.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot must show updated decision');
    assert.equal(snapshot.latestWorkOrderDecision.executor, 'claude-zero-confirm', 'snapshot must keep executor');
    assert.equal(snapshot.latestWorkOrderDecision.result_post, 'POST /api/work-orders/result 200', 'snapshot must keep resultPOST');
    assert.equal(snapshot.latestWorkOrderDecision.yes_count, 0, 'snapshot yesCount must be 0');
    assert.equal(snapshot.latestWorkOrderDecision.copy_count, 0, 'snapshot copyCount must be 0');
    assert.equal(snapshot.latestWorkOrderDecision.human_wait, 0, 'snapshot humanWait must be 0');
    assert.ok(String(snapshot.latestWorkOrderDecision.execution_path || '').includes('claude-zero-confirm'), 'snapshot execution path must include claude-zero-confirm');
    assert.ok(Array.isArray(snapshot.shellAgentActivity.items), 'shell activity must expose items');
    assert.ok(
      snapshot.shellAgentActivity.items.some((item) => String(item.message || '').includes('executor: claude-zero-confirm') && String(item.message || '').includes('resultPOST: POST /api/work-orders/result 200')),
      'shell activity must log executor and resultPOST'
    );
    assert.ok(
      snapshot.shellAgentActivity.items.some((item) => String(item.message || '').includes('承認要求回数: 0') && String(item.message || '').includes('待機要求回数: 0')),
      'shell activity must log zero confirmation counters'
    );
    console.log('  PASS: full cycle resultPOST updates Result Decision Panel and execution log');
  });

  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log('✅ v113.1.0 real console dogfood e2e smoke PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
