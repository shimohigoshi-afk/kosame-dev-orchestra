#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');
const { buildCompleteRunInboxPlan } = require('../tools/kosame-agent-router');
const { detectStopReason } = require('../tools/kosame-stop-reason-detector');
const { buildGapItems } = require('../tools/kosame-gap-builder');
const { buildResumePacket } = require('../tools/kosame-resume-engine');
const { buildFinalizerReport } = require('../tools/kosame-finalizer');
const { runAuditGate } = require('../tools/kosame-audit-gate');
const { runCompleteRunDaemon, buildCompleteRunPacket } = require('../tools/kosame-complete-run-daemon');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');
const { processQueue } = require('../tools/kosame-runner-queue');
const { recordWorkOrderResult } = require('../tools/kosame-work-order-result-store');
const { buildWorkOrderResultDecision } = require('../tools/kosame-work-order-result-decision');

async function main() {
  console.log('===== v113.3.52 complete run os smoke =====');
  assert.ok(isVersionAtLeast(pkg.version, '113.3.51'), `version must be >= 113.3.51 (got ${pkg.version})`);
  assert.ok(pkg.scripts['complete:daemon'], 'complete:daemon must exist');
  assert.ok(pkg.scripts['smoke:v113-3-52'], 'smoke:v113-3-52 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-52'), 'verify must include smoke:v113-3-52');
  const workOrderMessage = 'KOSAME Console の作業票を作ってください。Command Inbox と Daemon と Finalizer を実装してください。';

  const routerPlan = buildCompleteRunInboxPlan({
    message: workOrderMessage,
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
  });
  assert.equal(routerPlan.executionMode, 'complete-run');
  assert.equal(routerPlan.humanApprovalRequired, false);
  assert.equal(routerPlan.commitTagPushRequiresYes, false);
  assert.equal(routerPlan.route, 'zero-confirm');
  assert.equal(routerPlan.executor, 'claude-zero-confirm');
  assert.ok(Array.isArray(routerPlan.assignedLanes) && routerPlan.assignedLanes.includes('Result Decision Lane'));

  const audit = runAuditGate({ prompt: 'KOSAME Dev Orchestra の実行情報を記録する。' });
  assert.equal(audit.pass, true, 'audit gate must pass');
  assert.equal(audit.noYes.userInputRequired, false, 'audit gate must stay non-interactive');

  const stopReason = detectStopReason({
    errorStage: 'runner.dispatch',
    errorCode: 'RUNNER_DISPATCH_FAILED',
    errorMessage: 'runner timeout after 30000ms',
    executionHost: 'kosame-runner',
    interactive: false,
    safeSpawn: true,
  });
  assert.equal(stopReason.ok, false);
  assert.equal(stopReason.category, 'runner_timeout');
  assert.equal(stopReason.missingCapability, 'runner_timeout_guard');

  const gap = buildGapItems(stopReason, { workOrderId: 'wo-123', route: 'zero-confirm', executor: 'claude-zero-confirm' });
  assert.ok(Array.isArray(gap.tasks) && gap.tasks.length >= 2, 'gap tasks must be present');
  assert.ok(gap.resumeHint.includes('Runner') || gap.resumeHint.includes('再実行') || gap.resumeHint.includes('復帰'), 'gap resume hint must point to recovery');

  const resume = buildResumePacket(gap, {
    runId: 'run-123',
    workOrderId: 'wo-123',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
  });
  assert.equal(resume.originalRunId, 'run-123');
  assert.equal(resume.route, 'zero-confirm');
  assert.equal(resume.executor, 'claude-zero-confirm');

  const finalizer = buildFinalizerReport({
    status: 'success',
    executor: 'claude-zero-confirm',
    route: 'zero-confirm',
    resultPOST: 'POST /api/work-orders/result 200',
    decisionStatus: 'ready_for_commit',
    next: 'ready_for_commit',
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    summary: 'complete run finished',
    changed_files: ['tools/kosame-complete-run-daemon.js'],
  });
  assert.equal(finalizer.status, 'success');
  assert.ok(finalizer.finalReport.includes('KOSAME_RESULT_BEGIN'), 'final report must include result block');

  const packet = buildCompleteRunPacket({
    message: workOrderMessage,
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    stopSample: {
      errorStage: 'runner.dispatch',
      errorCode: 'RUNNER_DISPATCH_FAILED',
      errorMessage: 'runner timeout after 30000ms',
      executionHost: 'kosame-runner',
      interactive: false,
      safeSpawn: true,
    },
  });
  assert.equal(packet.commandInbox.executionMode, 'complete-run');
  assert.equal(packet.stopReason.category, 'runner_timeout');
  assert.ok(packet.gapPacket.tasks.length > 0, 'packet gap must contain tasks');
  assert.ok(packet.resumePacket.resumeCommand.includes('complete-run-daemon'), 'resume command must reference daemon');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-complete-run-'));
  const handoffDir = path.join(tmpRoot, '.kosame-handoff');
  const runsDir = path.join(tmpRoot, '.runs');
  const shellLogPath = path.join(tmpRoot, 'shell-agent-activity.jsonl');
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = shellLogPath;

  const chat = await handleChatRequest({
    message: workOrderMessage,
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    handoffDir,
  });
  assert.equal(chat.ok, true);
  assert.ok(chat.work_order, 'work order must be created');
  assert.equal(chat.work_order.executor, 'claude-zero-confirm');
  assert.equal(chat.work_order.route, 'zero-confirm');
  assert.equal(chat.work_order.executionMode, 'complete-run');
  assert.ok(chat.work_order.agentRouter, 'agentRouter must be attached');
  assert.ok(Array.isArray(chat.work_order.assignedLanes) && chat.work_order.assignedLanes.includes('Complete Run Lane') === false, 'existing lane list remains stable');

  const daemonResult = await runCompleteRunDaemon({
    message: workOrderMessage,
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    stopSample: {
      errorStage: 'runner.dispatch',
      errorCode: 'RUNNER_DISPATCH_FAILED',
      errorMessage: 'runner timeout after 30000ms',
      executionHost: 'kosame-runner',
      interactive: false,
      safeSpawn: true,
    },
  }, {
    simulateQueue: true,
    handoffDir,
    runsDir,
    executor: (ticket, runDir) => {
      fs.writeFileSync(path.join(runDir, 'output.md'), `executed ${ticket.id}`);
      fs.writeFileSync(path.join(runDir, 'verify.log'), 'verify: PASS');
      return { ok: true, exitCode: 0, error: null };
    },
  });
  const queueResults = daemonResult.queueResults || [];
  assert.ok(Array.isArray(queueResults) && queueResults.length >= 1, 'queue should execute at least one item');
  assert.ok(queueResults.every((item) => item.status === 'completed'), 'queue items should complete');

  const workOrderId = chat.work_order.id || chat.work_order.work_order_id || chat.work_order.approval_id;
  const resultRecord = recordWorkOrderResult({
    work_order_id: workOrderId,
    approval_id: workOrderId,
    handoff_id: workOrderId,
    work_order: chat.work_order,
    title: chat.work_order.title,
    target_repo: chat.work_order.target_repo,
    assigned_agent: chat.work_order.agent,
    executor: 'claude-zero-confirm',
    route: 'zero-confirm',
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    result_summary: 'complete run os finished',
    changed_files: ['tools/kosame-complete-run-daemon.js'],
    notes: 'complete run path verified',
    yes_count: 0,
    copy_count: 0,
    human_wait: 0,
    approval_request_count: 0,
    manual_paste_count: 0,
    wait_request_count: 0,
    auto_approved_count: 1,
    auto_blocked_count: 0,
    retry_count: 0,
    recovered: false,
    result_post_retry_count: 0,
    result_post: 'POST /api/work-orders/result 200',
    execution_path: 'Console → Handoff → Runner → Result Decision',
    execution_host: 'kosame-runner',
    execution_host_allowed: true,
    interactive_host_blocked: false,
    interactive_prompt_blocked: false,
    no_yes_gate_runtime: true,
    safe_spawn_active: true,
    manual_code_ui_allowed: false,
    official_route: 'Console → Handoff → Runner',
    codex_yes_hell_guard: 'active',
    codex_auto_approve_mode: 'active',
    user_yes_required: false,
    safety_stop_guard: 'active',
    router_decision: 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
    assigned_lanes: routerPlan.assignedLanes,
    lane_statuses: routerPlan.orchestration.lane_statuses,
    orchestration: routerPlan.orchestration,
  }, {
    latestApprovedWorkOrder: chat.work_order,
  });
  assert.equal(resultRecord.ok, true);
  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: resultRecord.latestWorkOrderResult,
    latestApprovedWorkOrder: chat.work_order,
  });
  assert.equal(decision.decision_status, 'ready_for_commit');
  assert.equal(decision.route, 'zero-confirm');
  assert.equal(decision.executor, 'claude-zero-confirm');
  assert.ok(decision.summary.includes('routerDecision=KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first'));

  const shellLogText = fs.existsSync(shellLogPath) ? fs.readFileSync(shellLogPath, 'utf8') : '';
  assert.ok(shellLogText.includes('command.inbox.received') || shellLogText.includes('complete.run.detected'), 'shell log must include complete run stages');

  console.log('  PASS complete run routing / gap / resume / finalizer');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
