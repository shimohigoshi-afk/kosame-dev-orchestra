#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');
const { recordWorkOrderResult, readLatestWorkOrderResult, buildNextRecommendedAction } = require('../tools/kosame-work-order-result-store');
const { readShellAgentActivity } = require('../tools/kosame-shell-agent-activity');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');
const CONTEXT_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-context.js');
const ACTIVITY_PATH = path.join(ROOT, 'tools', 'kosame-shell-agent-activity.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-25-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');
const HANDOFF_LOG_PATH = path.join(TEMP_ROOT, 'work-order-handoffs.jsonl');
const RESULT_LOG_PATH = path.join(TEMP_ROOT, 'work-order-results.jsonl');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');
const SECRET_SENTINEL = 'sk-RESULT-LEAK-1234567890';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function requestJson(port, pathname, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode || 0, body: JSON.parse(raw || '{}'), raw });
          } catch (error) {
            reject(new Error(`invalid json response: ${error.message}\nraw=${raw}`));
          }
        });
      }
    );
    req.on('error', reject);
    if (method !== 'GET') req.write(JSON.stringify(body || {}));
    req.end();
  });
}

function makeWorkOrder(title, agent = 'Codex') {
  return {
    title,
    agent,
    target_repo: '/home/lavie/kosame-dev-orchestra',
    risk_level: 'medium',
    requires_human_confirmation: true,
    prompt: [
      'cd /home/lavie/kosame-dev-orchestra',
      '',
      `${title} の実装結果をまとめてください。`,
      '',
      '安全条件:',
      '- commit/tag/pushは未実行で止める',
      '- git add . / git add -Aは禁止',
      '- Secret/.env/credentials/API keyを読まない',
      '- 外部APIを呼ばない',
      '- 対象repo以外を触らない',
      '- git status -sb',
    ].join('\n'),
  };
}

async function startServerIfPossible() {
  const previousApproval = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  const previousHandoff = process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
  const previousResult = process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
  const previousActivity = process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = APPROVAL_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = HANDOFF_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = RESULT_LOG_PATH;
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = ACTIVITY_LOG_PATH;

  const { server } = createLiveCockpitServer({
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });

  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') {
        resolve(null);
      } else {
        reject(error);
      }
    };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve(server.address().port);
      });
    } catch (error) {
      server.off('error', onError);
      if (error && error.code === 'EPERM') {
        resolve(null);
      } else {
        reject(error);
      }
    }
  });

  return {
    server,
    port,
    restoreEnv() {
      if (typeof previousApproval === 'string') process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = previousApproval;
      else delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
      if (typeof previousHandoff === 'string') process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = previousHandoff;
      else delete process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
      if (typeof previousResult === 'string') process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = previousResult;
      else delete process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
      if (typeof previousActivity === 'string') process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = previousActivity;
      else delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    },
  };
}

function assertStaticWiring() {
  assert.ok(isVersionAtLeast(pkg.version, '110.84.25'), `package version must be >= 110.84.25 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-25'], 'smoke:v110-84-25 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-25'), 'verify must include smoke:v110-84-25');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('work-order-result-status'), 'HTML must include result status area');
  assert.ok(html.includes('work-order-result-panel'), 'HTML must include result panel');
  assert.ok(html.includes('data-result-form'), 'HTML must include result form wiring');
  assert.ok(html.includes('結果を保存'), 'HTML must include result save button');
  assert.ok(html.includes('result_status'), 'HTML must include result status field');
  assert.ok(html.includes('changed_files'), 'HTML must include changed files field');
  assert.ok(html.includes('notificationSoundEnabled'), 'HTML must keep notification state wiring');
  assert.ok(html.includes('通知音をONにする'), 'HTML must keep notification ON button');
  assert.ok(html.includes('通知音をOFFにする'), 'HTML must keep notification OFF button');
  assert.ok(html.includes('chat-llama-audit-badge'), 'HTML must keep llama audit badge');
  assert.ok(!html.includes('sound-hint-legacy'), 'HTML must not keep legacy sound hint');
  console.log('  PASS: HTML result intake wiring');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('/api/work-orders/result'), 'server must expose result API');
  assert.ok(serverSource.includes('recordWorkOrderResult'), 'server must use result store helper');
  assert.ok(serverSource.includes('buildResultActivityMessage'), 'server must build a safe result activity message');
  assert.ok(serverSource.includes('appendShellAgentActivityEvent'), 'server must append activity events for result intake');
  console.log('  PASS: server result wiring');

  const snapshotSource = read(SNAPSHOT_PATH);
  assert.ok(snapshotSource.includes('readLatestWorkOrderResult'), 'snapshot must read latest work order result state');
  assert.ok(snapshotSource.includes('latestWorkOrderResult'), 'snapshot must expose latestWorkOrderResult');
  assert.ok(snapshotSource.includes('workOrderResultQueue'), 'snapshot must expose workOrderResultQueue');
  console.log('  PASS: snapshot result wiring');

  const contextSource = read(CONTEXT_PATH);
  assert.ok(contextSource.includes('workOrderResult='), 'console context must include work order result summary');
  console.log('  PASS: console context result wiring');

  const activitySource = read(ACTIVITY_PATH);
  assert.ok(activitySource.includes('review_ready'), 'activity must recognize review_ready');
  assert.ok(activitySource.includes('needs_attention'), 'activity must recognize needs_attention');
  assert.ok(activitySource.includes('revision_needed'), 'activity must recognize revision_needed');
  console.log('  PASS: shell activity result wiring');
}

function assertNoLeak(filePath, sentinel) {
  if (!fs.existsSync(filePath)) return;
  const text = read(filePath);
  assert.ok(!text.includes(sentinel), `${path.basename(filePath)} must not leak sentinel`);
  assert.ok(!text.includes('API key'), `${path.basename(filePath)} must not leak API key`);
  assert.ok(!text.includes('.env'), `${path.basename(filePath)} must not leak .env`);
  assert.ok(!text.includes('credentials'), `${path.basename(filePath)} must not leak credentials`);
  assert.ok(!text.includes('customer data'), `${path.basename(filePath)} must not leak customer data`);
}

async function runHttpCycle(port, { title, resultStatus, smokeResult, verifyResult, expectedNext, expectedHandoffStatus, agent = 'Codex' }) {
  const workOrder = makeWorkOrder(title, agent);
  const approve = await requestJson(port, '/api/work-orders/approve', { work_order: workOrder });
  assert.equal(approve.statusCode, 200, 'approval must return 200');
  assert.equal(approve.body.ok, true, 'approval must be ok');

  const handoff = await requestJson(port, '/api/work-orders/handoff', {
    work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
    assigned_agent: approve.body.latestApprovedWorkOrder.agent,
    status: 'handed_to_agent',
    work_order: approve.body.latestApprovedWorkOrder,
  });
  assert.equal(handoff.statusCode, 200, 'handoff must return 200');
  assert.equal(handoff.body.ok, true, 'handoff must be ok');
  assert.equal(handoff.body.status, 'handed_to_agent', 'handoff must move to handed_to_agent');

  const result = await requestJson(port, '/api/work-orders/result', {
    work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
    result_status: resultStatus,
    result_summary: `${title} の結果です。`,
    changed_files: ['public/kosame-live-cockpit.html', 'tools/kosame-live-cockpit-server.js'],
    smoke_result: smokeResult,
    verify_result: verifyResult,
    notes: `${title} の補足メモ`,
  });
  assert.equal(result.statusCode, 200, 'result POST must return 200');
  assert.equal(result.body.ok, true, 'result POST must be ok');
  assert.equal(result.body.activityLogged, true, 'result activity must be logged');
  assert.equal(result.body.latestWorkOrderResult.result_status, resultStatus, 'result status must round trip');
  assert.equal(result.body.nextRecommendedAction, expectedNext, 'nextRecommendedAction must match');
  assert.equal(result.body.latestHandoffWorkOrder.status, expectedHandoffStatus, 'handoff status must update after result');

  const resultGet = await requestJson(port, '/api/work-orders/result', null, 'GET');
  assert.equal(resultGet.statusCode, 200, 'result GET must return 200');
  assert.equal(resultGet.body.ok, true, 'result GET must be ok');
  assert.equal(resultGet.body.latestWorkOrderResult.result_status, resultStatus, 'result GET must surface latest result');
  assert.equal(resultGet.body.latestHandoffWorkOrder.status, expectedHandoffStatus, 'result GET must surface updated handoff status');

  const snapshot = await requestJson(port, '/api/snapshot', null, 'GET');
  assert.equal(snapshot.statusCode, 200, 'snapshot must return 200');
  assert.equal(snapshot.body.latestWorkOrderResult.result_status, resultStatus, 'snapshot must surface latest result');
  assert.equal(snapshot.body.latestHandoffWorkOrder.status, expectedHandoffStatus, 'snapshot must surface result-merged handoff status');
  assert.ok(Array.isArray(snapshot.body.workOrderResultQueue), 'snapshot must expose workOrderResultQueue');
}

async function runFallbackCycle({ title, resultStatus, smokeResult, verifyResult, expectedNext, expectedHandoffStatus, agent = 'Codex' }) {
  const workOrder = makeWorkOrder(title, agent);
  const approval = approveWorkOrder({ work_order: workOrder }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
  });
  const handoff = recordWorkOrderHandoff({
    status: 'handed_to_agent',
    work_order_id: approval.latestApprovedWorkOrder.approval_id,
    assigned_agent: approval.latestApprovedWorkOrder.agent,
    work_order: approval.latestApprovedWorkOrder,
  }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    latestApprovedWorkOrder: approval.latestApprovedWorkOrder,
  });
  assert.equal(handoff.latestHandoffWorkOrder.status, 'handed_to_agent', 'fallback handoff must start handed_to_agent');

  const result = recordWorkOrderResult({
    work_order_id: approval.latestApprovedWorkOrder.approval_id,
    result_status: resultStatus,
    result_summary: `${title} の結果です。`,
    changed_files: ['public/kosame-live-cockpit.html', 'tools/kosame-live-cockpit-server.js'],
    smoke_result: smokeResult,
    verify_result: verifyResult,
    notes: `${title} の補足メモ`,
    work_order: handoff.latestHandoffWorkOrder,
  }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    latestApprovedWorkOrder: approval.latestApprovedWorkOrder,
    latestHandoffWorkOrder: handoff.latestHandoffWorkOrder,
  });
  assert.equal(result.latestWorkOrderResult.result_status, resultStatus, 'fallback result must round trip');
  assert.equal(result.latestWorkOrderResult.nextRecommendedAction, expectedNext, 'fallback nextRecommendedAction must match');

  const latest = readLatestWorkOrderResult({
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    latestHandoffWorkOrder: handoff.latestHandoffWorkOrder,
  });
  assert.equal(latest.latestWorkOrderResult.result_status, resultStatus, 'fallback latest result must surface');
  assert.equal(latest.latestHandoffWorkOrder.status, expectedHandoffStatus, 'fallback latest handoff status must update');

  const snapshot = collectLiveCockpitSnapshot({
    activeRepoPath: ROOT,
    devRepoPath: ROOT,
    salesRepoPath: '/home/lavie/repos/transcriber',
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  assert.equal(snapshot.latestWorkOrderResult.result_status, resultStatus, 'fallback snapshot must surface latest result');
  assert.equal(snapshot.latestHandoffWorkOrder.status, expectedHandoffStatus, 'fallback snapshot must surface updated handoff status');
  assert.ok(Array.isArray(snapshot.workOrderResultQueue), 'fallback snapshot must expose workOrderResultQueue');
  assert.equal(snapshot.workOrderResultQueue[0].result_status, resultStatus, 'fallback workOrderResultQueue must surface latest result');
}

async function main() {
  console.log('=== v110.84.25 work order result intake smoke ===');

  assertStaticWiring();

  const previousApproval = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  const previousHandoff = process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
  const previousResult = process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
  const previousActivity = process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;

  const runtime = await startServerIfPossible();
  const { server, port, restoreEnv } = runtime;

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime unavailable in this environment; running direct store/snapshot verification');
      await runFallbackCycle({
        title: 'v110.84.25 success result intake',
        resultStatus: 'success',
        smokeResult: 'PASS',
        verifyResult: 'PASS',
        expectedNext: buildNextRecommendedAction('success', 'PASS', 'PASS'),
        expectedHandoffStatus: 'review_ready',
      });
      await runFallbackCycle({
        title: 'v110.84.25 failed result intake',
        resultStatus: 'failed',
        smokeResult: 'FAIL',
        verifyResult: 'FAIL',
        expectedNext: buildNextRecommendedAction('failed', 'FAIL', 'FAIL'),
        expectedHandoffStatus: 'needs_attention',
      });
      await runFallbackCycle({
        title: 'v110.84.25 needs_fix result intake',
        resultStatus: 'needs_fix',
        smokeResult: 'PASS',
        verifyResult: 'FAIL',
        expectedNext: buildNextRecommendedAction('needs_fix', 'PASS', 'FAIL'),
        expectedHandoffStatus: 'revision_needed',
      });
      assertNoLeak(RESULT_LOG_PATH, SECRET_SENTINEL);
      assertNoLeak(ACTIVITY_LOG_PATH, SECRET_SENTINEL);
      console.log('  PASS: fallback result logging is safe');
    } else {
      const salesWorkOrder = makeWorkOrder('v110.84.25 Sales DX approval regression', 'Codex');
      salesWorkOrder.target_repo = '/home/lavie/repos/transcriber';
      salesWorkOrder.risk_level = 'medium';

      const salesApprove = await requestJson(port, '/api/work-orders/approve', { work_order: salesWorkOrder });
      assert.equal(salesApprove.statusCode, 200, 'sales approval must return 200');
      assert.equal(salesApprove.body.ok, true, 'sales approval must be ok');

      const salesSnapshot = await requestJson(port, '/api/snapshot', null, 'GET');
      assert.equal(salesSnapshot.statusCode, 200, 'sales snapshot must return 200');
      const salesSnapshotApproved = salesSnapshot.body.latestApprovedWorkOrder || null;
      const salesApprovedTargetRepo = salesSnapshotApproved?.target_repo || salesApprove.body.latestApprovedWorkOrder?.target_repo || null;
      assert.equal(salesApprovedTargetRepo, '/home/lavie/repos/transcriber', 'shared snapshot or approval response must keep Sales DX approval');
      const salesSnapshotHandoff = salesSnapshot.body.latestHandoffWorkOrder || null;
      assert.notEqual(salesSnapshotHandoff?.target_repo || '', '/home/lavie/repos/transcriber', 'handoff queue must stay Dev Orchestra only');

      await runHttpCycle(port, {
        title: 'v110.84.25 success result intake',
        resultStatus: 'success',
        smokeResult: 'PASS',
        verifyResult: 'PASS',
        expectedNext: 'ready_for_commit',
        expectedHandoffStatus: 'review_ready',
      });
      await runHttpCycle(port, {
        title: 'v110.84.25 failed result intake',
        resultStatus: 'failed',
        smokeResult: 'FAIL',
        verifyResult: 'FAIL',
        expectedNext: 'stop_and_investigate',
        expectedHandoffStatus: 'needs_attention',
      });
      await runHttpCycle(port, {
        title: 'v110.84.25 needs_fix result intake',
        resultStatus: 'needs_fix',
        smokeResult: 'PASS',
        verifyResult: 'FAIL',
        expectedNext: 'request_fix',
        expectedHandoffStatus: 'revision_needed',
      });

      const secretGate = await requestJson(port, '/api/work-orders/result', {
        work_order_id: 'secret-gate-work-order',
        result_status: 'needs_fix',
        result_summary: '安全確認',
        changed_files: ['public/kosame-live-cockpit.html'],
        smoke_result: 'PASS',
        verify_result: 'PASS',
        notes: SECRET_SENTINEL,
      });
      assert.equal(secretGate.statusCode, 400, 'secret-like result payload must be rejected');
      assert.equal(secretGate.body.ok, false, 'secret-like result payload must fail');

      const resultLog = fs.existsSync(RESULT_LOG_PATH) ? read(RESULT_LOG_PATH) : '';
      const activityLog = fs.existsSync(ACTIVITY_LOG_PATH) ? read(ACTIVITY_LOG_PATH) : '';
      assert.ok(!resultLog.includes(SECRET_SENTINEL), 'result log must not leak secret sentinel');
      assert.ok(!activityLog.includes(SECRET_SENTINEL), 'activity log must not leak secret sentinel');
      assert.ok(activityLog.includes('review_ready'), 'activity log must include review_ready');
      assert.ok(activityLog.includes('needs_attention'), 'activity log must include needs_attention');
      assert.ok(activityLog.includes('revision_needed'), 'activity log must include revision_needed');
      console.log('  PASS: result intake API, activity logging, and safety checks');

      const directLatest = readLatestWorkOrderResult({
        workOrderApprovalLogPath: APPROVAL_LOG_PATH,
        workOrderHandoffLogPath: HANDOFF_LOG_PATH,
        workOrderResultLogPath: RESULT_LOG_PATH,
      });
      assert.ok(directLatest.latestWorkOrderResult, 'latest result must be readable from store');
      assert.ok(directLatest.latestHandoffWorkOrder, 'latest handoff must be readable from store');
      assert.ok(Array.isArray(directLatest.latestWorkOrderResult.changed_files), 'latest result must keep changed files array');
    }
  } finally {
    if (server) {
      await new Promise((resolve) => {
        try { server.close(resolve); } catch { resolve(); }
      });
    }
    restoreEnv();
    if (typeof previousApproval === 'string') {
      process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = previousApproval;
    } else {
      delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
    }
    if (typeof previousHandoff === 'string') {
      process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = previousHandoff;
    } else {
      delete process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
    }
    if (typeof previousResult === 'string') {
      process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = previousResult;
    } else {
      delete process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
    }
    if (typeof previousActivity === 'string') {
      process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = previousActivity;
    } else {
      delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    }
  }

  console.log('✅ v110.84.25 work order result intake smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
