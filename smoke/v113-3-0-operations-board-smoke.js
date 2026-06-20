#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pkg = require('../package.json');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');

console.log('=== v113.3.0 operations board smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:ops'], 'package wiring');

async function main() {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-ops-'));
  const approvalLog = path.join(temp, 'approvals.jsonl');
  const handoffLog = path.join(temp, 'handoffs.jsonl');
  const resultLog = path.join(temp, 'results.jsonl');
  const chat = {
    body: {
      work_order: {
        id: 'wo-ops-001',
        title: 'operations board smoke',
        body: 'KOSAME Consoleで作業票を作って',
        prompt: 'KOSAME Consoleで作業票を作って',
        target: '/home/lavie/kosame-dev-orchestra',
        target_repo: '/home/lavie/kosame-dev-orchestra',
        agent: 'Codex',
        risk_level: 'low',
      },
    },
  };
  const approved = approveWorkOrder({ work_order: chat.body.work_order }, { workOrderApprovalLogPath: approvalLog });
  const handoff = recordWorkOrderHandoff({ work_order_id: approved.latestApprovedWorkOrder.approval_id, assigned_agent: 'Codex', status: 'handed_to_agent', work_order: approved.latestApprovedWorkOrder }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
  fs.writeFileSync(resultLog, `${JSON.stringify({
    work_order_id: approved.latestApprovedWorkOrder.approval_id,
    approval_id: approved.latestApprovedWorkOrder.approval_id,
    handoff_id: approved.latestApprovedWorkOrder.approval_id,
    work_order: handoff.latestHandoffWorkOrder,
    executor: 'claude-zero-confirm',
    route: 'zero-confirm',
    result_post: 'POST /api/work-orders/result 200',
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    result_summary: 'operations board smoke',
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    auto_approved_count: 1,
    auto_blocked_count: 0,
    retry_count: 0,
    source: 'kosame-console',
  })}\n`, 'utf8');
  const snap = collectLiveCockpitSnapshot({
    workOrderApprovalLogPath: approvalLog,
    workOrderHandoffLogPath: handoffLog,
    workOrderResultLogPath: resultLog,
    workOrderApprovalLimit: 10,
    workOrderHandoffLimit: 10,
    workOrderResultHistoryLimit: 10,
    activeRepoPath: '/home/lavie/kosame-dev-orchestra',
    devRepoPath: '/home/lavie/kosame-dev-orchestra',
  });
  assert.ok(snap.operationsBoard, 'operations board must exist');
  assert.ok(String(snap.operationsBoard.summary || '').includes('zero-confirm=zero-confirm'));
  assert.ok(String(snap.operationsBoard.summary || '').includes('directSpawnAudit=PASS'));
  assert.ok(String(snap.operationsBoard.summary || '').includes('startupAudit=PASS'));

  fs.rmSync(temp, { recursive: true, force: true });
  console.log('✅ v113.3.0 operations board smoke PASSED');
}

main().catch((error) => { console.error(error); process.exit(1); });
