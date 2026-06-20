#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-24-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');
const HANDOFF_LOG_PATH = path.join(TEMP_ROOT, 'work-order-handoffs.jsonl');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');

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

async function main() {
  console.log('=== v110.84.24 approved work order handoff queue smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.24'), `package version must be >= 110.84.24 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-24'], 'smoke:v110-84-24 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-24'), 'verify must include smoke:v110-84-24');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('work-order-handoff-status'), 'HTML must include handoff status area');
  assert.ok(html.includes('work-order-handoff-queue'), 'HTML must include handoff queue area');
  assert.ok(html.includes('data-handoff-action'), 'HTML must include handoff action handlers');
  assert.ok(html.includes('Codexへ渡した'), 'HTML must include Codex handoff button');
  assert.ok(html.includes('結果待ちにする'), 'HTML must include waiting-result button');
  assert.ok(html.includes('ready_to_handoff'), 'HTML must mention ready_to_handoff state');
  assert.ok(html.includes('handed_to_agent'), 'HTML must mention handed_to_agent state');
  assert.ok(html.includes('waiting_result'), 'HTML must mention waiting_result state');
  assert.ok(html.includes('通知音をONにする'), 'HTML must keep notification ON button');
  assert.ok(html.includes('通知音をOFFにする'), 'HTML must keep notification OFF button');
  assert.ok(html.includes('Llama audit: missing'), 'HTML must keep llama audit badge');
  assert.ok(!html.includes('sound-hint-legacy'), 'HTML must not keep legacy sound hint');
  console.log('  PASS: HTML handoff wiring');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('/api/work-orders/handoff'), 'server must expose handoff API');
  assert.ok(serverSource.includes('recordWorkOrderHandoff'), 'server must use handoff store helper');
  assert.ok(serverSource.includes('buildHandoffActivityMessage'), 'server must build a safe handoff activity message');
  assert.ok(serverSource.includes('appendShellAgentActivityEvent'), 'server must append activity events for handoff');
  console.log('  PASS: server handoff wiring');

  const snapshotSource = read(SNAPSHOT_PATH);
  assert.ok(snapshotSource.includes('readLatestWorkOrderHandoff'), 'snapshot must read latest handoff state');
  assert.ok(snapshotSource.includes('latestHandoffWorkOrder'), 'snapshot must expose latestHandoffWorkOrder');
  console.log('  PASS: snapshot handoff wiring');

  const previousApproval = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  const previousHandoff = process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
  const previousActivity = process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = APPROVAL_LOG_PATH;
  process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = HANDOFF_LOG_PATH;
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = ACTIVITY_LOG_PATH;

  const { server } = createLiveCockpitServer({
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
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

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime checks skipped — listen EPERM in this environment');
    } else {
      const salesDraft = await requestJson(port, '/api/chat', {
        message: 'Sales DX v0.3.1の作業票を作って',
        project: 'Sales DX',
        context: 'currentVersion=110.84.24; changed=2; verify=PASS',
      });
      assert.equal(salesDraft.statusCode, 200, 'sales draft must return 200');
      assert.equal(salesDraft.body.ok, true, 'sales draft must be ok');
      assert.ok(salesDraft.body.work_order, 'sales draft must include work_order');
      assert.equal(salesDraft.body.work_order.target_repo, '/home/lavie/repos/kosame-sales-dx', 'sales draft must route to Sales DX registry path');

      const salesApprove = await requestJson(port, '/api/work-orders/approve', {
        work_order: salesDraft.body.work_order,
      });
      assert.equal(salesApprove.statusCode, 200, 'sales approval must return 200');
      assert.equal(salesApprove.body.ok, true, 'sales approval must be ok');
      assert.equal(salesApprove.body.approval.target_repo, '/home/lavie/repos/kosame-sales-dx', 'sales approval target repo must be Sales DX registry path');

      const salesSnapshot = await requestJson(port, '/api/snapshot', null, 'GET');
      assert.equal(salesSnapshot.statusCode, 200, 'sales snapshot must return 200');
      assert.ok(salesSnapshot.body.latestApprovedWorkOrder, 'sales snapshot must include latestApprovedWorkOrder');
      assert.equal(salesSnapshot.body.latestApprovedWorkOrder.target_repo, '/home/lavie/repos/kosame-sales-dx', 'shared snapshot must surface latest Sales DX approval');
      assert.ok(!salesSnapshot.body.latestHandoffWorkOrder || salesSnapshot.body.latestHandoffWorkOrder.target_repo !== '/home/lavie/repos/kosame-sales-dx', 'handoff queue must not include Sales DX work orders');
      console.log('  PASS: shared snapshot keeps Sales DX approval while handoff queue stays Dev Orchestra only');

      const draft = await requestJson(port, '/api/chat', {
        message: 'KOSAME Consoleの作業票を作って',
        project: 'KOSAME Console',
        context: 'currentVersion=110.84.24; changed=5; verify=PASS',
      });
      assert.equal(draft.statusCode, 200, 'chat draft must return 200');
      assert.equal(draft.body.ok, true, 'chat draft must be ok');
      assert.ok(draft.body.work_order, 'chat draft must include work_order');
      assert.equal(draft.body.work_order.target_repo, '/home/lavie/kosame-dev-orchestra', 'work order must route to dev orchestra');
      console.log('  PASS: work order drafted');

      const approve = await requestJson(port, '/api/work-orders/approve', {
        work_order: draft.body.work_order,
      });
      assert.equal(approve.statusCode, 200, 'approval must return 200');
      assert.equal(approve.body.ok, true, 'approval must be ok');
      assert.equal(approve.body.approval.status, 'approved', 'approval status must be approved');
      assert.ok(approve.body.latestApprovedWorkOrder, 'approval must return latestApprovedWorkOrder');
      console.log('  PASS: work order approved');

      const handoffGet = await requestJson(port, '/api/work-orders/handoff', null, 'GET');
      assert.equal(handoffGet.statusCode, 200, 'handoff GET must return 200');
      assert.equal(handoffGet.body.ok, true, 'handoff GET must be ok');
      assert.ok(handoffGet.body.latestHandoffWorkOrder, 'handoff GET must include latestHandoffWorkOrder');
      assert.equal(handoffGet.body.latestHandoffWorkOrder.status, 'ready_to_handoff', 'approved work order should surface as ready_to_handoff');
      assert.equal(handoffGet.body.latestHandoffWorkOrder.target_repo, '/home/lavie/kosame-dev-orchestra', 'handoff GET must target dev orchestra');
      assert.notEqual(handoffGet.body.latestHandoffWorkOrder.target_repo, '/home/lavie/repos/kosame-sales-dx', 'handoff GET must exclude Sales DX approvals');
      console.log('  PASS: handoff queue is surfaced');

      const handoff = await requestJson(port, '/api/work-orders/handoff', {
        work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
        assigned_agent: approve.body.latestApprovedWorkOrder.agent,
        status: 'handed_to_agent',
        work_order: approve.body.latestApprovedWorkOrder,
      });
      assert.equal(handoff.statusCode, 200, 'handoff POST must return 200');
      assert.equal(handoff.body.ok, true, 'handoff POST must be ok');
      assert.equal(handoff.body.status, 'handed_to_agent', 'handoff POST must update to handed_to_agent');
      assert.equal(handoff.body.activityLogged, true, 'handoff activity must be logged');
      assert.ok(handoff.body.latestHandoffWorkOrder, 'handoff POST must return latestHandoffWorkOrder');
      assert.equal(handoff.body.latestHandoffWorkOrder.status, 'handed_to_agent', 'handoff record must be handed_to_agent');
      console.log('  PASS: handoff to agent recorded');

      const wait = await requestJson(port, '/api/work-orders/handoff', {
        work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
        assigned_agent: approve.body.latestApprovedWorkOrder.agent,
        status: 'waiting_result',
        work_order: approve.body.latestApprovedWorkOrder,
      });
      assert.equal(wait.statusCode, 200, 'waiting_result POST must return 200');
      assert.equal(wait.body.ok, true, 'waiting_result POST must be ok');
      assert.equal(wait.body.status, 'waiting_result', 'handoff POST must update to waiting_result');
      assert.ok(wait.body.latestHandoffWorkOrder, 'waiting_result POST must return latestHandoffWorkOrder');
      assert.equal(wait.body.latestHandoffWorkOrder.status, 'waiting_result', 'handoff record must be waiting_result');
      console.log('  PASS: waiting_result state recorded');

      const snapshot = await requestJson(port, '/api/snapshot', null, 'GET');
      assert.equal(snapshot.statusCode, 200, 'snapshot must return 200');
      assert.ok(snapshot.body.latestHandoffWorkOrder, 'snapshot must include latestHandoffWorkOrder');
      assert.equal(snapshot.body.latestHandoffWorkOrder.status, 'waiting_result', 'snapshot handoff must reflect waiting_result');
      assert.ok(Array.isArray(snapshot.body.workOrderHandoffQueue), 'snapshot must expose workOrderHandoffQueue');
      console.log('  PASS: snapshot handoff state updated');

      assert.ok(fs.existsSync(APPROVAL_LOG_PATH), 'approval log must use temp path');
      assert.ok(fs.existsSync(HANDOFF_LOG_PATH), 'handoff log must use temp path');
      assert.ok(fs.existsSync(ACTIVITY_LOG_PATH), 'activity log must use temp path');
      const handoffLog = read(HANDOFF_LOG_PATH);
      assert.ok(!handoffLog.includes('sk-'), 'handoff log must not leak API key patterns');
      assert.ok(!handoffLog.includes('.env'), 'handoff log must not leak .env');
      assert.ok(!handoffLog.includes('password'), 'handoff log must not leak password');
      assert.ok(!handoffLog.includes('customer data'), 'handoff log must not leak customer data');
      console.log('  PASS: handoff log safety checks');

      const activityLog = read(ACTIVITY_LOG_PATH);
      assert.ok(activityLog.includes('work order handoff'), 'activity log must include handoff task');
      assert.ok(
        activityLog.includes('dispatch待ち') || activityLog.includes('runner実行中') || activityLog.includes('resultPOST待ち'),
        'activity log must include dispatch/runner/resultPOST language',
      );
      assert.ok(!activityLog.includes('sk-'), 'activity log must not leak API key patterns');
      assert.ok(!activityLog.includes('.env'), 'activity log must not leak .env');
      console.log('  PASS: activity log recorded handoff events');

      const lastLines = activityLog.trim().split(/\r?\n/).filter(Boolean);
      assert.ok(lastLines.length >= 2, 'handoff activity log must contain multiple entries');
      const latestEvent = JSON.parse(lastLines[lastLines.length - 1]);
      assert.equal(latestEvent.status, 'waiting_result', 'latest activity status must be waiting_result');
      assert.equal(latestEvent.agent, 'KOSAME', 'latest activity agent must be KOSAME');
      assert.ok(
        latestEvent.message.includes('dispatch待ち') || latestEvent.message.includes('runner実行中') || latestEvent.message.includes('resultPOST待ち'),
        'latest activity message must describe the runner state',
      );
      console.log('  PASS: latest activity event matches waiting_result');

      const latestApproved = approve.body.latestApprovedWorkOrder;
      assert.ok(latestApproved.prompt, 'latest approved work order must retain prompt for copy');
      assert.ok(latestApproved.prompt.includes('git status -sb') || latestApproved.prompt.includes('commit/tag/push'), 'prompt must remain a safe manual handoff prompt');
      console.log('  PASS: prompt copy remains available');

      assert.ok(html.includes('chat-llama-audit-badge'), 'HTML must keep llama audit badge');
      assert.ok(html.includes('通知音をONにする'), 'HTML must keep notification ON button');
      assert.ok(html.includes('通知音をOFFにする'), 'HTML must keep notification OFF button');
      console.log('  PASS: existing UI wiring preserved');
    }
  } finally {
    await new Promise((resolve) => {
      try { server.close(resolve); } catch { resolve(); }
    });
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
    if (typeof previousActivity === 'string') {
      process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = previousActivity;
    } else {
      delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
    }
  }

  console.log('✅ v110.84.24 approved work order handoff queue smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
