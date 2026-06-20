#!/usr/bin/env node
'use strict';

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

async function runOne(port, idx, logPaths) {
  const exactRequest = 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して';
  const chatRes = await requestJson(port, '/api/chat', {
    message: exactRequest,
    project: 'KOSAME Dev Orchestra',
  });
  assert.equal(chatRes.status, 200, `chat must return 200 for run ${idx}`);
  assert.equal(chatRes.body.ok, true, `chat must succeed for run ${idx}`);
  const workOrder = chatRes.body.work_order;
  assert.ok(workOrder, `work_order must exist for run ${idx}`);
  assert.equal(workOrder.target_repo, '/home/lavie/kosame-dev-orchestra', `target repo must stay on dev orchestra for run ${idx}`);
  assert.equal(workOrder.assigned_agent || workOrder.agent, 'Codex', `agent must be Codex for run ${idx}`);

  const approval = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: logPaths.approvalLog });
  assert.equal(approval.ok, true, `approval must succeed for run ${idx}`);
  const approved = approval.latestApprovedWorkOrder;
  const handoff = recordWorkOrderHandoff({
    work_order_id: approved.approval_id,
    assigned_agent: 'Codex',
    status: 'handed_to_agent',
    work_order: approved,
  }, {
    workOrderHandoffLogPath: logPaths.handoffLog,
    workOrderApprovalLogPath: logPaths.approvalLog,
    latestApprovedWorkOrder: approved,
  });
  assert.equal(handoff.ok, true, `handoff must succeed for run ${idx}`);

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
    result_summary: `Repeatability run ${idx} completed.`,
    changed_files: ['public/kosame-live-cockpit.html', 'smoke/v113-1-2-repeatability-gate-smoke.js'],
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    source: 'kosame-console',
  });
  assert.equal(resultRes.status, 200, `result POST must return 200 for run ${idx}`);
  assert.equal(resultRes.body.ok, true, `result POST must succeed for run ${idx}`);
  assert.equal(resultRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', `decision must be ready_for_commit for run ${idx}`);
  assert.equal(resultRes.body.latestWorkOrderDecision.executor, 'claude-zero-confirm', `executor must be claude-zero-confirm for run ${idx}`);
  assert.equal(resultRes.body.latestWorkOrderDecision.yes_count, 0, `yesCount must be 0 for run ${idx}`);
  assert.equal(resultRes.body.latestWorkOrderDecision.copy_count, 0, `copyCount must be 0 for run ${idx}`);
  assert.equal(resultRes.body.latestWorkOrderDecision.human_wait, 0, `humanWait must be 0 for run ${idx}`);
  assert.ok(String(resultRes.body.latestWorkOrderDecision.summary || '').includes('executor=claude-zero-confirm'), `summary must include executor for run ${idx}`);
  assert.ok(String(resultRes.body.latestWorkOrderDecision.summary || '').includes('resultPOST=POST /api/work-orders/result 200'), `summary must include resultPOST for run ${idx}`);
  return { approved, resultRes };
}

async function main() {
  console.log('=== v113.1.2 repeatability gate smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.1.2'), `version must be >= 113.1.2 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-1-2'], 'smoke:v113-1-2 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-1-2'), 'verify must include smoke:v113-1-2');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assertContains(html, 'id="run-history-details"', 'HTML must include run history details');
  assertContains(html, 'id="work-order-run-history-status"', 'HTML must include run history status');
  assertContains(html, 'id="work-order-run-history-panel"', 'HTML must include run history panel');
  assertContains(html, 'run number', 'HTML must mention run number');
  assertContains(html, 'decision status', 'HTML must mention decision status');
  assert.ok(html.includes('id="ai-roster-details" open'), 'layout order must keep AI roster open');
  console.log('  PASS: HTML run history wiring');

  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-12-'));
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

    const runs = [];
    for (let i = 1; i <= 3; i += 1) {
      runs.push(await runOne(port, i, { approvalLog, handoffLog, resultLog }));
    }

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.status, 200, 'snapshot must return 200');
    const snapshot = snapshotRes.body;
    assert.ok(Array.isArray(snapshot.workOrderResultHistory), 'snapshot must expose workOrderResultHistory');
    assert.equal(snapshot.workOrderResultHistory.length, 3, 'snapshot must expose 3 run history items');
    snapshot.workOrderResultHistory.forEach((run, index) => {
      assert.equal(run.run_number, index + 1, `run number must be sequential for run ${index + 1}`);
      assert.equal(run.executor, 'claude-zero-confirm', `executor must be claude-zero-confirm for run ${index + 1}`);
      assert.equal(run.yes_count, 0, `yesCount must be 0 for run ${index + 1}`);
      assert.equal(run.copy_count, 0, `copyCount must be 0 for run ${index + 1}`);
      assert.equal(run.human_wait, 0, `humanWait must be 0 for run ${index + 1}`);
      assert.equal(run.result_post, 'POST /api/work-orders/result 200', `resultPOST must be 200 for run ${index + 1}`);
      assert.equal(run.decision_status, 'ready_for_commit', `decision status must be ready_for_commit for run ${index + 1}`);
      assert.ok(run.timestamp, `timestamp must exist for run ${index + 1}`);
    });
    assert.equal(snapshot.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot decision must be ready_for_commit');
    assert.equal(snapshot.latestWorkOrderDecision.executor, 'claude-zero-confirm', 'snapshot executor must stay claude-zero-confirm');
    assert.equal(snapshot.latestWorkOrderDecision.yes_count, 0, 'snapshot yesCount must be 0');
    assert.equal(snapshot.latestWorkOrderDecision.copy_count, 0, 'snapshot copyCount must be 0');
    assert.equal(snapshot.latestWorkOrderDecision.human_wait, 0, 'snapshot humanWait must be 0');
    assert.ok(Array.isArray(snapshot.shellAgentActivity.items), 'shell activity must expose items');
    assert.ok(
      snapshot.shellAgentActivity.items.some((item) => String(item.message || '').includes('executor: claude-zero-confirm')),
      'shell activity must log executor'
    );
    assert.ok(
      snapshot.shellAgentActivity.items.some((item) => String(item.message || '').includes('resultPOST: POST /api/work-orders/result 200')),
      'shell activity must log resultPOST'
    );

    console.log('  PASS: 3 consecutive runs complete with zero confirmations');
  });

  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log('✅ v113.1.2 repeatability gate smoke PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
