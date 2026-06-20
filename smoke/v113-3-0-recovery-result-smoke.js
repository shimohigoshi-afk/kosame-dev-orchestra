#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const pkg = require('../package.json');
const { createRecoveryPlan, buildBlockedResult } = require('../tools/kosame-recovery-manager');
const { collectLiveCockpitSnapshot } = require('../tools/kosame-live-cockpit-snapshot');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');
const { recordWorkOrderResult } = require('../tools/kosame-work-order-result-store');

console.log('=== v113.3.0 recovery/result smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:recovery'], 'package wiring');

async function main() {
  const recovery = createRecoveryPlan({ failures: [{ reason: 'runner timeout' }, { reason: 'resultPOST failure' }], retryCount: 2 });
  assert.equal(recovery.shouldRetry, true);
  assert.equal(recovery.recovered, true);
  assert.equal(recovery.retryableCount, 2);

  const blocked = buildBlockedResult({ reason: 'Safety Stop', recovered: false });
  assert.equal(blocked.blocked, true);
  assert.equal(blocked.result_status, 'failed');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-recovery-'));
  const approvalLog = path.join(temp, 'approvals.jsonl');
  const handoffLog = path.join(temp, 'handoffs.jsonl');
  const resultLog = path.join(temp, 'results.jsonl');
  const workOrder = {
    id: 'wo-recovery-001',
    title: 'recovery smoke',
    body: 'KOSAME Consoleで作業票を作って',
    prompt: 'KOSAME Consoleで作業票を作って',
    target_repo: '/home/lavie/kosame-dev-orchestra',
    agent: 'Codex',
    risk_level: 'low',
  };
  const approved = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
  const handoff = recordWorkOrderHandoff({ work_order_id: approved.latestApprovedWorkOrder.approval_id, assigned_agent: 'Codex', status: 'handed_to_agent', work_order: approved.latestApprovedWorkOrder }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
  const result = recordWorkOrderResult({
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
    result_summary: 'recovery smoke',
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    auto_approved_count: 1,
    auto_blocked_count: 0,
    retry_count: 1,
    recovered: true,
    source: 'kosame-console',
  }, {
    workOrderApprovalLogPath: approvalLog,
    workOrderHandoffLogPath: handoffLog,
    workOrderResultLogPath: resultLog,
    latestApprovedWorkOrder: approved.latestApprovedWorkOrder,
    latestHandoffWorkOrder: handoff.latestHandoffWorkOrder,
  });
  assert.equal(result.ok, true);
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
  assert.equal(snap.latestWorkOrderDecision.decision_status, 'ready_for_commit');
  assert.equal(snap.latestWorkOrderDecision.recovered, true);

  fs.rmSync(temp, { recursive: true, force: true });
  console.log('✅ v113.3.0 recovery/result smoke PASSED');
}

main().catch((error) => { console.error(error); process.exit(1); });
