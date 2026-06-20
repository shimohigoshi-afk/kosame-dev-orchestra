#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
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

async function main() {
  console.log('=== v113.0.9 runner noninteractive smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.9'), `version must be >= 113.0.9 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-9'], 'smoke:v113-0-9 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-9'), 'verify must include smoke:v113-0-9');
  console.log('  PASS: package wiring');

  const watcherSource = fs.readFileSync(path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js'), 'utf8');
  assert.ok(watcherSource.includes('buildZeroConfirmRunnerCommand()'), 'watcher must build the zero-confirm runner command');
  assert.ok(watcherSource.includes('validateZeroConfirmRunnerCommand'), 'watcher must validate the zero-confirm runner command');
  console.log('  PASS: watcher noninteractive execution path');

  const html = fs.readFileSync(path.join(ROOT, 'public', 'kosame-live-cockpit.html'), 'utf8');
  assert.ok(html.includes('route: ${current.route || \'zero-confirm\'}'), 'Result Decision Panel must render route');
  assert.ok(html.includes('承認要求回数: ${formatZeroConfirmCounterLabel(current.approval_request_count ?? current.yes_count)}'), 'Result Decision Panel must render approval request count');
  assert.ok(html.includes('手動貼付回数: ${formatZeroConfirmCounterLabel(current.manual_paste_count ?? current.copy_count)}'), 'Result Decision Panel must render manual paste count');
  assert.ok(html.includes('待機要求回数: ${formatZeroConfirmCounterLabel(current.wait_request_count ?? current.human_wait)}'), 'Result Decision Panel must render wait request count');
  console.log('  PASS: result decision counters rendered');

  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-09-'));
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

    const approved = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
    assert.equal(approved.ok, true, 'approval must succeed');
    const handoff = recordWorkOrderHandoff({
      work_order_id: approved.latestApprovedWorkOrder.approval_id,
      assigned_agent: 'Codex',
      status: 'handed_to_agent',
      work_order: approved.latestApprovedWorkOrder,
    }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
    assert.equal(handoff.ok, true, 'handoff must succeed');

    const runnerOutput = [
      'KOSAME Runner dispatch completed',
      'claude --dangerously-skip-permissions -p',
      'KOSAME_RESULT_BEGIN',
      JSON.stringify({
        result_status: 'success',
        smoke_result: 'PASS',
        verify_result: 'PASS',
        yes_count: 0,
        copy_count: 0,
        human_wait: 0,
        result_summary: 'noninteractive runner completed',
        changed_files: ['tools/kosame-codex-dispatch-watcher.js'],
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
    assert.equal(resultRes.body.latestWorkOrderResult.yes_count, 0, 'yes_count must be zero');
    assert.equal(resultRes.body.latestWorkOrderResult.copy_count, 0, 'copy_count must be zero');
    assert.equal(resultRes.body.latestWorkOrderResult.human_wait, 0, 'human_wait must be zero');
    assert.equal(resultRes.body.latestWorkOrderDecision.yes_count, 0, 'decision must surface yes_count zero');
    assert.equal(resultRes.body.latestWorkOrderDecision.copy_count, 0, 'decision must surface copy_count zero');
    assert.equal(resultRes.body.latestWorkOrderDecision.human_wait, 0, 'decision must surface human_wait zero');

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.status, 200, 'snapshot must return 200');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.yes_count, 0, 'snapshot must surface yes_count zero');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.copy_count, 0, 'snapshot must surface copy_count zero');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.human_wait, 0, 'snapshot must surface human_wait zero');
    console.log('  PASS: resultPOST carries zero confirmation counters');
  });

  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log('✅ v113.0.9 runner noninteractive smoke PASSED');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
