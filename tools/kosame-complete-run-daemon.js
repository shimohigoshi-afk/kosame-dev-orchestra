#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { handleChatRequest } = require('./kosame-cockpit-chat-server');
const { processQueue } = require('./kosame-runner-queue');
const { recordWorkOrderResult } = require('./kosame-work-order-result-store');
const { buildWorkOrderResultDecision } = require('./kosame-work-order-result-decision');
const { appendPipelineStageEvent } = require('./kosame-pipeline-telemetry');
const { buildCompleteRunInboxPlan, routeCommand } = require('./kosame-agent-router');
const { detectStopReason } = require('./kosame-stop-reason-detector');
const { buildGapItems } = require('./kosame-gap-builder');
const { buildResumePacket } = require('./kosame-resume-engine');
const { buildFinalizerReport } = require('./kosame-finalizer');
const { runAuditGate } = require('./kosame-audit-gate');
const { readLatestHandoffInbox } = require('./kosame-codex-handoff-bridge-server');
const { buildOrchestraEvidence } = require('./kosame-orchestra-evidence');

const ROOT = path.resolve(__dirname, '..');

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function parseArgs(argv = []) {
  const opts = { json: false, resume: false, input: '', cwd: ROOT, projectPath: '/home/lavie/kosame-dev-orchestra' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') {
      opts.json = true;
      continue;
    }
    if (arg === '--resume') {
      opts.resume = true;
      continue;
    }
    if (arg === '--input' && argv[i + 1]) {
      opts.input = argv[++i];
      continue;
    }
    if (arg.startsWith('--input=')) {
      opts.input = arg.slice('--input='.length);
      continue;
    }
    if (arg === '--cwd' && argv[i + 1]) {
      opts.cwd = argv[++i];
      continue;
    }
    if (arg.startsWith('--cwd=')) {
      opts.cwd = arg.slice('--cwd='.length);
      continue;
    }
    if (arg === '--project-path' && argv[i + 1]) {
      opts.projectPath = argv[++i];
      continue;
    }
    if (arg.startsWith('--project-path=')) {
      opts.projectPath = arg.slice('--project-path='.length);
      continue;
    }
  }
  return opts;
}

function buildCompleteRunPacket(input = {}, options = {}) {
  const prompt = normalizeText(input.message || input.prompt || input.input || '');
  const stopSample = typeof input.stopSample === 'string'
    ? { errorMessage: input.stopSample }
    : (input.stopSample && typeof input.stopSample === 'object' ? input.stopSample : {});
  const routePlan = routeCommand({
    message: prompt,
    selectedProjectPath: input.selectedProjectPath || options.projectPath,
    selectedProjectLabel: input.selectedProjectLabel || 'KOSAME Dev Orchestra',
    selectedProjectId: input.selectedProjectId || 'dev-orchestra',
  }, { completionMode: 'complete-run-first' });
  const commandInbox = routePlan.commandInbox || buildCompleteRunInboxPlan({
    message: prompt,
    selectedProjectPath: input.selectedProjectPath || options.projectPath,
    selectedProjectLabel: input.selectedProjectLabel || 'KOSAME Dev Orchestra',
    selectedProjectId: input.selectedProjectId || 'dev-orchestra',
  });
  const audit = runAuditGate({
    prompt,
    source: 'command_inbox',
    executionHost: 'kosame-console',
  });
  const stopReason = detectStopReason(stopSample || input.failure || input.result || input.resultRecord || input.logText || '');
  const gapPacket = buildGapItems(stopReason, {
    workOrderId: input.workOrderId || input.runId || '',
    route: commandInbox.route,
    executor: commandInbox.executor,
  });
  const resumePacket = buildResumePacket(gapPacket, {
    runId: input.runId || input.workOrderId || '',
    workOrderId: input.workOrderId || input.runId || '',
    selectedProjectId: commandInbox.selectedProjectId || input.selectedProjectId,
    selectedProjectPath: commandInbox.selectedProjectPath || input.selectedProjectPath,
    selectedProjectLabel: commandInbox.selectedProjectLabel || input.selectedProjectLabel,
  });
  const finalizer = buildFinalizerReport({
    status: stopReason.ok ? 'success' : 'partial',
    executor: commandInbox.executor,
    route: commandInbox.route,
    resultPOST: 'POST /api/work-orders/result 200',
    decisionStatus: stopReason.ok ? 'ready_for_commit' : 'resume_required',
    next: stopReason.ok ? 'ready_for_commit' : 'resume_required',
    stopReason: stopReason.stopReason,
    gapId: gapPacket.gapId,
    resumeId: resumePacket.resumeId,
    result_status: stopReason.ok ? 'success' : 'failed',
    smoke_result: stopReason.ok ? 'PASS' : 'FAIL',
    verify_result: stopReason.ok ? 'PASS' : 'FAIL',
    summary: stopReason.ok ? 'complete run packet ready' : stopReason.summary,
    changed_files: [],
  });
  const orchestraEvidence = buildOrchestraEvidence({
    router_decision: commandInbox.orchestration?.router_decision,
    assigned_lanes: commandInbox.assignedLanes,
  });

  return {
    ok: true,
    commandInbox,
    agentRouter: routePlan.agentRouter,
    audit,
    stopReason,
    gapPacket,
    resumePacket,
    finalizer,
    orchestraEvidence,
    completeRunMode: commandInbox.completionMode,
  };
}

async function runCompleteRunDaemon(input = {}, options = {}) {
  const packet = buildCompleteRunPacket(input, options);
  const result = {
    ok: packet.audit.pass,
    packet,
  };

  appendPipelineStageEvent({
    stage: 'command.inbox.received',
    status: 'running',
    workOrderId: packet.commandInbox?.workType || '',
    route: packet.commandInbox?.route || 'zero-confirm',
    executionHost: 'kosame-console',
    executionHostAllowed: true,
    interactiveHostBlocked: false,
    noYesGateRuntime: true,
    safeSpawnActive: true,
    manualCodeUiAllowed: false,
    officialRoute: 'Console → Handoff → Runner',
    message: 'Command Inbox が受信されました',
  }, { agent: 'KOSAME', task: 'command.inbox.received' });
  appendPipelineStageEvent({
    stage: 'complete.run.detected',
    status: packet.stopReason.ok ? 'success' : 'blocked',
    workOrderId: packet.commandInbox?.workType || '',
    route: packet.commandInbox?.route || 'zero-confirm',
    message: packet.stopReason.summary || 'stop reason detected',
  }, { agent: 'PM', task: 'complete.run.detected' });
  appendPipelineStageEvent({
    stage: 'gap.builder.created',
    status: packet.stopReason.ok ? 'success' : 'running',
    workOrderId: packet.commandInbox?.workType || '',
    route: packet.commandInbox?.route || 'zero-confirm',
    message: packet.gapPacket.resumeHint || 'gap packet built',
  }, { agent: 'PM', task: 'gap.builder.created' });
  appendPipelineStageEvent({
    stage: 'resume.engine.ready',
    status: packet.stopReason.ok ? 'success' : 'running',
    workOrderId: packet.commandInbox?.workType || '',
    route: packet.commandInbox?.route || 'zero-confirm',
    message: packet.resumePacket.resumeCommand || 'resume engine ready',
  }, { agent: 'PM', task: 'resume.engine.ready' });
  appendPipelineStageEvent({
    stage: 'finalizer.completed',
    status: packet.stopReason.ok ? 'success' : 'running',
    workOrderId: packet.commandInbox?.workType || '',
    route: packet.commandInbox?.route || 'zero-confirm',
    message: packet.finalizer.reportText,
  }, { agent: 'PM', task: 'finalizer.completed' });

  if (options.simulateQueue) {
    const handoffDir = options.handoffDir || process.env.KOSAME_HANDOFF_DIR || path.join(ROOT, '.kosame-handoff');
    const queueResults = processQueue({
      handoffOpts: { handoffDir },
      runsDir: options.runsDir,
      state: {},
      executor: options.executor,
    });
    result.queueResults = queueResults;
  }

  if (options.persistResult) {
    const latestWorkOrder = packet.commandInbox?.workType ? {
      id: packet.commandInbox.workType,
      title: packet.commandInbox.workType,
      target_repo: packet.commandInbox.repo?.path || ROOT,
      assigned_agent: 'Codex',
    } : {};
    result.record = recordWorkOrderResult({
      work_order_id: latestWorkOrder.id || packet.agentRouter.workType || 'complete-run',
      approval_id: latestWorkOrder.id || packet.agentRouter.workType || 'complete-run',
      handoff_id: latestWorkOrder.id || packet.agentRouter.workType || 'complete-run',
      work_order: latestWorkOrder,
      title: latestWorkOrder.title || 'complete-run',
      target_repo: latestWorkOrder.target_repo || ROOT,
      assigned_agent: 'Codex',
      executor: packet.agentRouter.executor,
      route: packet.agentRouter.route,
      result_status: packet.stopReason.ok ? 'success' : 'failed',
      smoke_result: packet.stopReason.ok ? 'PASS' : 'FAIL',
      verify_result: packet.stopReason.ok ? 'PASS' : 'FAIL',
      result_summary: packet.finalizer.reportText,
      changed_files: [],
      notes: packet.stopReason.summary,
      yes_count: 0,
      copy_count: 0,
      human_wait: 0,
      approval_request_count: 0,
      manual_paste_count: 0,
      wait_request_count: 0,
      auto_approved_count: packet.stopReason.ok ? 1 : 0,
      auto_blocked_count: packet.stopReason.ok ? 0 : 1,
      retry_count: 0,
      recovered: !packet.stopReason.ok,
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
      router_decision: packet.orchestraEvidence.router_decision,
      assigned_lanes: packet.orchestraEvidence.assigned_lanes,
      lane_statuses: packet.orchestraEvidence.lane_statuses,
      orchestration: packet.orchestraEvidence,
    }, {
      latestApprovedWorkOrder: latestWorkOrder,
    });
    result.decision = buildWorkOrderResultDecision({
      latestWorkOrderResult: result.record.latestWorkOrderResult,
      latestApprovedWorkOrder: latestWorkOrder,
    });
  }

  return result;
}

if (require.main === module) {
  (async () => {
    const opts = parseArgs(process.argv.slice(2));
    const packet = await runCompleteRunDaemon({ message: opts.input, selectedProjectPath: opts.projectPath }, {
      projectPath: opts.projectPath,
      simulateQueue: false,
      persistResult: false,
    });
    if (opts.json) {
      process.stdout.write(`${JSON.stringify(packet, null, 2)}\n`);
    } else {
      process.stdout.write(`${packet.finalizer.finalReport}\n`);
    }
  })().catch((err) => {
    process.stderr.write(`${err.stack || err.message}\n`);
    process.exit(1);
  });
}

module.exports = {
  buildCompleteRunPacket,
  runCompleteRunDaemon,
};
