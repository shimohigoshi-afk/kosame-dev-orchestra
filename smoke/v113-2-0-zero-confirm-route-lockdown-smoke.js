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
const WATCHER_PATH = path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js');
const CHAT_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const LINT_PATH = path.join(ROOT, 'tools', 'kosame-prompt-lint.js');
const GUARD_PATH = path.join(ROOT, 'tools', 'kosame-zero-confirm-guard.js');
const RESULT_STORE_PATH = path.join(ROOT, 'tools', 'kosame-work-order-result-store.js');
const RESULT_DECISION_PATH = path.join(ROOT, 'tools', 'kosame-work-order-result-decision.js');
const LIVE_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const { isVersionAtLeast } = require('./version-compare');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');
const { recordWorkOrderResult } = require('../tools/kosame-work-order-result-store');
const {
  ZERO_CONFIRM_EXECUTOR,
  ZERO_CONFIRM_ROUTE,
  buildZeroConfirmRunnerCommand,
  validateZeroConfirmRunnerCommand,
  assertNoZeroConfirmText,
  lintForZeroConfirmText,
} = require('../tools/kosame-zero-confirm-guard');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, pathname, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
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

async function withServer(fn) {
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-20-'));
  const approvalLog = path.join(TEMP, 'approvals.jsonl');
  const handoffLog = path.join(TEMP, 'handoffs.jsonl');
  const resultLog = path.join(TEMP, 'results.jsonl');
  const activityLog = path.join(TEMP, 'activity.jsonl');
  const { server } = createLiveCockpitServer({
    workOrderApprovalLogPath: approvalLog,
    workOrderHandoffLogPath: handoffLog,
    workOrderResultLogPath: resultLog,
    shellAgentActivityLogPath: activityLog,
  });
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
    return await fn({ port, approvalLog, handoffLog, resultLog, activityLog, tempDir: TEMP });
  } finally {
    await new Promise((resolve) => { try { server.close(resolve); } catch { resolve(); } });
    fs.rmSync(TEMP, { recursive: true, force: true });
  }
}

function assertIncludes(text, needle, label) {
  assert.ok(String(text).includes(needle), label);
}

async function main() {
  console.log('=== v113.2.0 zero-confirm route lockdown smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.2.0'), `version must be >= 113.2.0 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-2-0'], 'smoke:v113-2-0 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-2-0'), 'verify must include smoke:v113-2-0');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-1-2'), 'verify must keep repeatability gate');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assertIncludes(html, 'executor', 'HTML must mention executor');
  assertIncludes(html, 'zero-confirm', 'HTML must mention zero-confirm');
  assertIncludes(html, '承認要求回数', 'HTML must mention 承認要求回数');
  assertIncludes(html, '手動貼付回数', 'HTML must mention 手動貼付回数');
  assertIncludes(html, '待機要求回数', 'HTML must mention 待機要求回数');
  assertIncludes(html, 'resultPOST', 'HTML must mention resultPOST');
  assertIncludes(html, 'decision status', 'HTML must mention decision status');
  assertIncludes(html, 'timestamp', 'HTML must mention timestamp');
  console.log('  PASS: HTML zero-confirm labels');

  const watcherSource = read(WATCHER_PATH);
  assertIncludes(watcherSource, 'ZERO_CONFIRM_EXECUTOR', 'watcher must import zero-confirm executor constant');
  assertIncludes(watcherSource, 'ZERO_CONFIRM_ROUTE', 'watcher must import zero-confirm route constant');
  assertIncludes(watcherSource, 'buildZeroConfirmRunnerCommand()', 'watcher must build a fixed zero-confirm command');
  assertIncludes(watcherSource, 'validateZeroConfirmRunnerCommand', 'watcher must validate the command before execution');
  assertIncludes(watcherSource, 'lintForZeroConfirmText', 'watcher must use zero-confirm output guard');
  assert.ok(!/spawn\(\s*['"]codex['"]/.test(watcherSource), 'watcher must not spawn raw codex');
  console.log('  PASS: watcher source wiring');

  const chatSource = read(CHAT_PATH);
  assertIncludes(chatSource, 'ZERO_CONFIRM_ROUTE_LOCKDOWN', 'chat must inject zero-confirm lockdown policy');
  assertIncludes(chatSource, 'executor: \'claude-zero-confirm\'', 'chat work order must pin executor');
  assertIncludes(chatSource, 'route: \'zero-confirm\'', 'chat work order must pin route');
  assertIncludes(chatSource, 'assertNoZeroConfirmRequests', 'chat must lint zero-confirm text');
  console.log('  PASS: chat source wiring');

  const lintSource = read(LINT_PATH);
  assertIncludes(lintSource, 'ZERO_CONFIRM_ROUTE_LOCKDOWN', 'prompt lint must export zero-confirm policy');
  assertIncludes(lintSource, 'assertNoZeroConfirmRequests', 'prompt lint must export zero-confirm guard');
  assertIncludes(lintSource, '承認要求', 'prompt lint must include approval-request detection');
  assertIncludes(lintSource, '手動貼り付け', 'prompt lint must include manual-paste detection');
  console.log('  PASS: prompt lint wiring');

  const guard = require(GUARD_PATH);
  assert.equal(guard.ZERO_CONFIRM_EXECUTOR, ZERO_CONFIRM_EXECUTOR, 'guard executor must match');
  assert.equal(guard.ZERO_CONFIRM_ROUTE, ZERO_CONFIRM_ROUTE, 'guard route must match');
  assert.deepEqual(guard.buildZeroConfirmRunnerCommand().command, ['claude', '--dangerously-skip-permissions', '-p'], 'command must be fixed');
  assert.equal(validateZeroConfirmRunnerCommand(['claude', '--dangerously-skip-permissions', '-p']).ok, true, 'valid command must pass');
  assert.throws(() => validateZeroConfirmRunnerCommand(['claude', '-p']), /invalid runner command/, 'missing bypass flag must fail');
  assert.throws(() => validateZeroConfirmRunnerCommand(['codex', '--dangerously-skip-permissions', '-p']), /invalid runner command/, 'raw codex must fail');
  assertNoZeroConfirmText('【Zero-Confirm Route Lockdown】 route: zero-confirm / 承認要求回数: 0', 'policy text', { allowNegatedContext: true });
  assert.throws(() => assertNoZeroConfirmText('please confirm', 'bad text'), /Confirmation text/);
  assert.throws(() => assertNoZeroConfirmText('手動で貼り付けてください', 'bad text'), /Confirmation text/);
  assert.throws(() => assertNoZeroConfirmText('続けますか', 'bad text'), /Confirmation text/);
  console.log('  PASS: zero-confirm guard module');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-20-unit-'));
  const approvalLog = path.join(tempRoot, 'approvals.jsonl');
  const handoffLog = path.join(tempRoot, 'handoffs.jsonl');
  const resultLog = path.join(tempRoot, 'results.jsonl');
  const workOrderRequest = 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して';
  const chatResult = await handleChatRequest({
    message: workOrderRequest,
    project: 'KOSAME Console',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
  });
  assert.equal(chatResult.ok, true, 'chat work order must succeed');
  assert.ok(chatResult.work_order, 'chat work order must exist');
  assert.equal(chatResult.work_order.executor, ZERO_CONFIRM_EXECUTOR, 'work order must pin zero-confirm executor');
  assert.equal(chatResult.work_order.route, ZERO_CONFIRM_ROUTE, 'work order must pin zero-confirm route');
  assertIncludes(chatResult.reply, 'route: zero-confirm', 'reply must expose zero-confirm route');
  assertIncludes(chatResult.work_order.body, 'Zero-Confirm Route Lockdown', 'work order body must include zero-confirm policy');
  assertNoZeroConfirmText(chatResult.reply, 'chat reply', { allowNegatedContext: true });
  assertNoZeroConfirmText(chatResult.work_order.body, 'work order body', { allowNegatedContext: true });
  console.log('  PASS: chat work order lock');

  const approval = approveWorkOrder({ work_order: chatResult.work_order }, { workOrderApprovalLogPath: approvalLog });
  assert.equal(approval.ok, true, 'approval must succeed');
  const approved = approval.latestApprovedWorkOrder;
  const handoff = recordWorkOrderHandoff({
    work_order_id: approved.approval_id,
    assigned_agent: 'Codex',
    status: 'handed_to_agent',
    work_order: approved,
  }, {
    workOrderHandoffLogPath: handoffLog,
    workOrderApprovalLogPath: approvalLog,
    latestApprovedWorkOrder: approved,
  });
  assert.equal(handoff.ok, true, 'handoff must succeed');

  const directResult = recordWorkOrderResult({
    work_order_id: approved.approval_id,
    approval_id: approved.approval_id,
    handoff_id: approved.approval_id,
    work_order: handoff.latestHandoffWorkOrder,
    executor: ZERO_CONFIRM_EXECUTOR,
    route: ZERO_CONFIRM_ROUTE,
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    result_summary: 'Zero-confirm route locked down.',
    result_post: 'POST /api/work-orders/result 200',
    approval_request_count: 0,
    manual_paste_count: 0,
    wait_request_count: 0,
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    source: 'kosame-console',
  }, {
    workOrderApprovalLogPath: approvalLog,
    workOrderHandoffLogPath: handoffLog,
    workOrderResultLogPath: resultLog,
    latestApprovedWorkOrder: approved,
    latestHandoffWorkOrder: handoff.latestHandoffWorkOrder,
  });
  assert.equal(directResult.ok, true, 'direct result store must succeed');
  assert.equal(directResult.latestWorkOrderResult.executor, ZERO_CONFIRM_EXECUTOR, 'direct result executor must be zero-confirm');
  assert.equal(directResult.latestWorkOrderResult.route, ZERO_CONFIRM_ROUTE, 'direct result route must be zero-confirm');
  assert.equal(directResult.latestWorkOrderResult.approval_request_count, 0, 'direct approval count must be 0');
  assert.equal(directResult.latestWorkOrderResult.manual_paste_count, 0, 'direct manual paste count must be 0');
  assert.equal(directResult.latestWorkOrderResult.wait_request_count, 0, 'direct wait count must be 0');
  console.log('  PASS: result store lock');

  await withServer(async ({ port }) => {
    if (port == null) {
      console.log('  PASS: HTTP runtime skipped (EPERM)');
      return;
    }

    const chatRes = await requestJson(port, '/api/chat', {
      message: workOrderRequest,
      project: 'KOSAME Console',
      selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    });
    assert.equal(chatRes.status, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    assert.equal(chatRes.body.work_order.executor, ZERO_CONFIRM_EXECUTOR, 'HTTP work order executor must be zero-confirm');
    assert.equal(chatRes.body.work_order.route, ZERO_CONFIRM_ROUTE, 'HTTP work order route must be zero-confirm');

    const approvalRes = await requestJson(port, '/api/work-orders/approve', {
      work_order: chatRes.body.work_order,
    });
    assert.equal(approvalRes.status, 200, 'approve must return 200');
    assert.equal(approvalRes.body.ok, true, 'approve must succeed');

    const handoffRes = await requestJson(port, '/api/work-orders/handoff', {
      work_order_id: approvalRes.body.latestApprovedWorkOrder.approval_id,
      assigned_agent: approvalRes.body.latestApprovedWorkOrder.agent,
      status: 'handed_to_agent',
      work_order: approvalRes.body.latestApprovedWorkOrder,
    });
    assert.equal(handoffRes.status, 200, 'handoff must return 200');
    assert.equal(handoffRes.body.ok, true, 'handoff must succeed');

    const resultRes = await requestJson(port, '/api/work-orders/result', {
      work_order_id: approvalRes.body.latestApprovedWorkOrder.approval_id,
      approval_id: approvalRes.body.latestApprovedWorkOrder.approval_id,
      handoff_id: approvalRes.body.latestApprovedWorkOrder.approval_id,
      work_order: handoffRes.body.latestHandoffWorkOrder,
      executor: ZERO_CONFIRM_EXECUTOR,
      route: ZERO_CONFIRM_ROUTE,
      result_status: 'success',
      smoke_result: 'PASS',
      verify_result: 'PASS',
      result_summary: 'Zero-confirm route locked down.',
      result_post: 'POST /api/work-orders/result 200',
      approval_request_count: 0,
      manual_paste_count: 0,
      wait_request_count: 0,
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
      source: 'kosame-console',
    });
    assert.equal(resultRes.status, 200, 'result POST must return 200');
    assert.equal(resultRes.body.ok, true, 'result POST must succeed');
    assert.equal(resultRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'decision must be ready_for_commit');
    assert.equal(resultRes.body.latestWorkOrderDecision.executor, ZERO_CONFIRM_EXECUTOR, 'decision executor must be zero-confirm');
    assert.equal(resultRes.body.latestWorkOrderDecision.route, ZERO_CONFIRM_ROUTE, 'decision route must be zero-confirm');
    assert.equal(resultRes.body.latestWorkOrderDecision.approval_request_count, 0, 'decision approval count must be 0');
    assert.equal(resultRes.body.latestWorkOrderDecision.manual_paste_count, 0, 'decision manual paste count must be 0');
    assert.equal(resultRes.body.latestWorkOrderDecision.wait_request_count, 0, 'decision wait count must be 0');
    assertIncludes(resultRes.body.latestWorkOrderDecision.summary, 'route=zero-confirm', 'decision summary must show zero-confirm route');
    assertIncludes(resultRes.body.latestWorkOrderDecision.summary, '承認要求回数=0', 'decision summary must show approval count');
    assertIncludes(resultRes.body.latestWorkOrderDecision.summary, '手動貼付回数=0', 'decision summary must show manual paste count');
    assertIncludes(resultRes.body.latestWorkOrderDecision.summary, '待機要求回数=0', 'decision summary must show wait count');

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.status, 200, 'snapshot must return 200');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot decision must be ready_for_commit');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.route, ZERO_CONFIRM_ROUTE, 'snapshot route must be zero-confirm');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.approval_request_count, 0, 'snapshot approval count must be 0');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.manual_paste_count, 0, 'snapshot manual paste count must be 0');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.wait_request_count, 0, 'snapshot wait count must be 0');
    assert.ok(Array.isArray(snapshotRes.body.workOrderResultHistory), 'snapshot must include run history');
    console.log('  PASS: HTTP runtime resultPOST and decision panel update');
  });

  const resultDecisionSource = read(RESULT_DECISION_PATH);
  assertIncludes(resultDecisionSource, 'route', 'result decision module must carry route');
  assertIncludes(resultDecisionSource, '承認要求回数', 'result decision module must carry Japanese count labels');
  const resultStoreSource = read(RESULT_STORE_PATH);
  assertIncludes(resultStoreSource, 'approval_request_count', 'result store must carry approval count');
  assertIncludes(resultStoreSource, 'manual_paste_count', 'result store must carry manual paste count');
  assertIncludes(resultStoreSource, 'wait_request_count', 'result store must carry wait count');
  const liveServerSource = read(LIVE_SERVER_PATH);
  assertIncludes(liveServerSource, 'route:', 'live server must print route in activity');
  assertIncludes(liveServerSource, '承認要求回数', 'live server must print Japanese count labels');
  console.log('  PASS: source wiring for result/history display');

  console.log('✅ v113.2.0 zero-confirm route lockdown smoke PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
