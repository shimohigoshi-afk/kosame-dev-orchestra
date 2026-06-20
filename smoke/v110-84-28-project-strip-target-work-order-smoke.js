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
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const APPROVAL_STORE_PATH = path.join(ROOT, 'tools', 'kosame-work-order-approval-store.js');
const HANDOFF_STORE_PATH = path.join(ROOT, 'tools', 'kosame-work-order-handoff-store.js');
const CODEx_BRIDGE_PATH = path.join(ROOT, 'tools', 'kosame-codex-handoff-bridge-server.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-28-target-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'approval.jsonl');
const HANDOFF_LOG_PATH = path.join(TEMP_ROOT, 'handoff.jsonl');
const HANDOFF_DIR = path.join(TEMP_ROOT, '.kosame-handoff');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'activity.jsonl');

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
  console.log('=== v110.84.28 kosame console project strip target work order smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.28'), `package version must be >= 110.84.28 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-28'], 'smoke:v110-84-28 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-28'), 'verify must include smoke:v110-84-28');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes("project.id === selectedId ? 'selected' : ''"), 'project strip must use a single selected source');
  assert.ok(!html.includes('project.selected || project.id === selectedId'), 'project strip must not keep dual selected fallback');
  assert.ok(html.includes('selectedProjectPath'), 'chat payload must include selectedProjectPath');
  assert.ok(html.includes('この方針で進めてください'), 'chat command bar must keep proceed flow');
  console.log('  PASS: HTML selection and payload wiring');

  const chatSource = read(CHAT_SERVER_PATH);
  assert.ok(chatSource.includes('resolveTargetFromSelection'), 'chat server must resolve from selected project path');
  assert.ok(chatSource.includes('selectedProjectPath'), 'chat server must accept selectedProjectPath');
  assert.ok(chatSource.includes('workOrderDraft'), 'chat server must preserve a full work order draft on proceed');
  assert.ok(chatSource.includes('/home/lavie/repos/kosame-sales-dx'), 'chat server must know the Sales DX registry path');
  console.log('  PASS: chat server target wiring');

  const approvalSource = read(APPROVAL_STORE_PATH);
  assert.ok(approvalSource.includes('/home/lavie/repos/kosame-sales-dx'), 'approval store must allow Sales DX registry path');
  assert.ok(approvalSource.includes('selectedProjectPath'), 'approval store must preserve selectedProjectPath');

  const handoffSource = read(HANDOFF_STORE_PATH);
  assert.ok(handoffSource.includes('/home/lavie/repos/kosame-sales-dx'), 'handoff store must allow Sales DX registry path');
  assert.ok(handoffSource.includes('selectedProjectPath'), 'handoff store must preserve selectedProjectPath');

  const bridgeSource = read(CODEx_BRIDGE_PATH);
  assert.ok(bridgeSource.includes('/home/lavie/repos/kosame-sales-dx'), 'handoff bridge must allow Sales DX registry path');
  assert.ok(bridgeSource.includes('selected_project_path'), 'handoff bridge must preserve selected_project_path');
  console.log('  PASS: store and bridge safety wiring');

  const { server } = createLiveCockpitServer({
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    handoffDir: HANDOFF_DIR,
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
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
    }
  });

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime checks skipped — listen EPERM in this environment');
    } else {
      const draft = await requestJson(port, '/api/chat', {
        message: 'Sales DX v0.3.0の作業票を作って',
        project: 'Sales DX',
        selectedProjectId: 'sales-dx',
        selectedProjectPath: '/home/lavie/repos/kosame-sales-dx',
        selectedProjectLabel: 'Sales DX',
        context: 'currentVersion=110.84.28; verify=PASS',
      });
      assert.equal(draft.statusCode, 200, 'sales dx draft must return 200');
      assert.equal(draft.body.ok, true, 'sales dx draft must be ok');
      assert.ok(draft.body.work_order, 'sales dx draft must include work_order');
      assert.equal(draft.body.work_order.target_repo, '/home/lavie/repos/kosame-sales-dx', 'selected Sales DX must resolve to registry repo path');
      assert.equal(draft.body.work_order.target.path, '/home/lavie/repos/kosame-sales-dx', 'selected Sales DX target path must be preserved');
      assert.ok(draft.body.work_order.body.includes('cd /home/lavie/repos/kosame-sales-dx'), 'draft body must target Sales DX registry path');

      const adopted = await requestJson(port, '/api/chat', {
        message: 'この方針で進めてください',
        project: 'Sales DX',
        selectedProjectId: 'sales-dx',
        selectedProjectPath: '/home/lavie/repos/kosame-sales-dx',
        selectedProjectLabel: 'Sales DX',
        context: 'currentVersion=110.84.28; verify=PASS',
        workOrderDraft: draft.body.work_order,
      });
      assert.equal(adopted.statusCode, 200, 'adopted draft must return 200');
      assert.equal(adopted.body.ok, true, 'adopted draft must be ok');
      assert.ok(adopted.body.work_order, 'adopted draft must include work_order');
      assert.equal(adopted.body.work_order.target_repo, '/home/lavie/repos/kosame-sales-dx', 'adopted work order must keep Sales DX registry target');
      assert.equal(adopted.body.work_order.target.path, '/home/lavie/repos/kosame-sales-dx', 'adopted work order target path must stay Sales DX registry path');
      assert.equal(adopted.body.work_order.originalRequest, draft.body.work_order.originalRequest, 'adopted work order must preserve originalRequest');
      assert.equal(adopted.body.work_order.body, draft.body.work_order.body, 'adopted work order must preserve full body');

      const approve = await requestJson(port, '/api/work-orders/approve', {
        work_order: adopted.body.work_order,
      });
      assert.equal(approve.statusCode, 200, 'approval must return 200');
      assert.equal(approve.body.ok, true, 'approval must be ok');
      assert.equal(approve.body.approval.target_repo, '/home/lavie/repos/kosame-sales-dx', 'approval must preserve Sales DX registry target');
      assert.equal(approve.body.approval.target.path, '/home/lavie/repos/kosame-sales-dx', 'approval target path must match Sales DX registry path');
      assert.equal(approve.body.approval.originalRequest, draft.body.work_order.originalRequest, 'approval must preserve originalRequest');

      const handoff = await requestJson(port, '/api/work-orders/handoff', {
        work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
        assigned_agent: approve.body.latestApprovedWorkOrder.agent,
        status: 'handed_to_agent',
        work_order: approve.body.latestApprovedWorkOrder,
      });
      assert.equal(handoff.statusCode, 200, 'handoff must return 200');
      assert.equal(handoff.body.ok, true, 'handoff must be ok');
      assert.equal(handoff.body.latestHandoffWorkOrder.target_repo, '/home/lavie/repos/kosame-sales-dx', 'handoff queue must preserve Sales DX registry target');
      assert.equal(handoff.body.latestHandoffWorkOrder.target.path, '/home/lavie/repos/kosame-sales-dx', 'handoff queue target path must match Sales DX registry path');
      assert.equal(handoff.body.latestHandoffWorkOrder.body, draft.body.work_order.body, 'handoff queue must preserve full body');

      const inbox = await requestJson(port, '/api/handoff', {
        id: approve.body.latestApprovedWorkOrder.approval_id,
        approval_id: approve.body.latestApprovedWorkOrder.approval_id,
        work_order_id: approve.body.latestApprovedWorkOrder.approval_id,
        handoff_id: approve.body.latestApprovedWorkOrder.approval_id,
        title: approve.body.latestApprovedWorkOrder.title,
        target_repo: '/home/lavie/repos/kosame-sales-dx',
        assigned_agent: approve.body.latestApprovedWorkOrder.agent,
        agent: approve.body.latestApprovedWorkOrder.agent,
        risk_level: approve.body.latestApprovedWorkOrder.risk_level,
        human_gate_required: true,
        body: approve.body.latestApprovedWorkOrder.body,
        prompt: approve.body.latestApprovedWorkOrder.body,
        prompt_text: approve.body.latestApprovedWorkOrder.body,
        original_request: approve.body.latestApprovedWorkOrder.originalRequest,
        originalRequest: approve.body.latestApprovedWorkOrder.originalRequest,
        selected_project_id: approve.body.latestApprovedWorkOrder.selectedProjectId,
        selected_project_path: approve.body.latestApprovedWorkOrder.selectedProjectPath,
        selected_project_label: approve.body.latestApprovedWorkOrder.selectedProjectLabel,
        safety_conditions: approve.body.latestApprovedWorkOrder.safetyConditions,
        safetyConditions: approve.body.latestApprovedWorkOrder.safetyConditions,
        report_items: approve.body.latestApprovedWorkOrder.reportItems,
        reportItems: approve.body.latestApprovedWorkOrder.reportItems,
        work_order: approve.body.latestApprovedWorkOrder,
        latestApprovedWorkOrder: approve.body.latestApprovedWorkOrder,
        created_at: '2026-06-20T00:00:00.000Z',
        source: 'kosame_console',
      });
      assert.equal(inbox.statusCode, 200, 'handoff inbox save must return 200');
      assert.equal(inbox.body.ok, true, 'handoff inbox save must be ok');
      assert.ok(fs.existsSync(inbox.body.latestPath), 'handoff inbox latest.md must exist');
      assert.ok(fs.existsSync(inbox.body.queuePath), 'handoff inbox queue.jsonl must exist');
      const latestMarkdown = read(inbox.body.latestPath);
      assert.ok(latestMarkdown.includes('/home/lavie/repos/kosame-sales-dx'), 'handoff inbox latest.md must include Sales DX registry target');
      assert.ok(latestMarkdown.includes('original_request'), 'handoff inbox latest.md must keep original_request metadata');
      assert.ok(latestMarkdown.includes('selected_project_path'), 'handoff inbox latest.md must keep selected_project_path metadata');

      const snapshot = await requestJson(port, '/api/snapshot', null, 'GET');
      assert.equal(snapshot.statusCode, 200, 'snapshot must return 200');
      assert.equal(snapshot.body.latestApprovedWorkOrder.target_repo, '/home/lavie/repos/kosame-sales-dx', 'snapshot must surface Sales DX registry target');
      assert.equal(snapshot.body.latestHandoffWorkOrder.target_repo, '/home/lavie/repos/kosame-sales-dx', 'snapshot handoff must surface Sales DX registry target');
      console.log('  PASS: runtime target resolution and handoff preservation');
    }
  } finally {
    await new Promise((resolve) => {
      try {
        server.close(resolve);
      } catch {
        resolve();
      }
    });
  }

  console.log('✅ v110.84.28 kosame console project strip target work order smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
