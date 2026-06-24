#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');
const { processQueue } = require('../tools/kosame-runner-queue');
const { readLatestHandoffInbox } = require('../tools/kosame-codex-handoff-bridge-server');
const { recordWorkOrderResult } = require('../tools/kosame-work-order-result-store');
const { buildWorkOrderResultDecision } = require('../tools/kosame-work-order-result-decision');
const { isVersionAtLeast } = require('./version-compare');

function makeTempTextAttachment(attachmentId, name, text, mimeType = 'text/markdown') {
  return {
    attachmentId,
    originalName: name,
    displayName: name,
    name,
    mimeType,
    size: Buffer.byteLength(String(text), 'utf8'),
    kind: 'text',
    ext: path.extname(name).toLowerCase() || '.md',
    textContent: String(text),
  };
}

async function main() {
  console.log('===== v113.3.46 chat-runner autoexec smoke =====');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.46'), `version must be >= 113.3.46 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-46'], 'smoke:v113-3-46 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-46'), 'verify must include smoke:v113-3-46');
  console.log('  PASS package wiring');

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v113-3-46-'));
  const workOrderHandoffDir = path.join(tmpRoot, 'work-order-handoff');
  const pipelineHandoffDir = path.join(tmpRoot, 'pipeline-handoff');
  const runnerRunsDir = path.join(tmpRoot, 'runs');
  const shellLog = path.join(tmpRoot, 'shell-agent-activity.jsonl');
  const resultLog = path.join(tmpRoot, 'work-order-results.jsonl');
  const approvalLog = path.join(tmpRoot, 'work-order-approvals.jsonl');
  process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = shellLog;
  process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = resultLog;
  process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = approvalLog;

  const attachments = [
    makeTempTextAttachment(
      'v113-3-46-spec-1',
      'runner-mvp-spec.md',
      [
        '# KOSAME CHAT → Runner 自動実行 MVP',
        '',
        '1. KOSAME CHAT から投げた指示を Handoff Queue に保存する',
        '2. Runner が Queue を検知して自動実行する',
        '3. Codex 実行経路は非対話で進める',
        '4. AGENT STREAM LOG に状態を残す',
        '5. Result Decision に反映する',
      ].join('\n'),
    ),
    makeTempTextAttachment(
      'v113-3-46-spec-2',
      'runner-notes.txt',
      'No YES prompts. No manual paste. Official route only.',
      'text/plain',
    ),
  ];

  const workOrderChat = await handleChatRequest({
    message: 'KOSAME CHATの指示を作業票化して。Runner経由で自動実行するワークオーダーにしてください。',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    handoffDir: workOrderHandoffDir,
  });

  assert.equal(workOrderChat.ok, true, 'work order request should be accepted');
  assert.ok(workOrderChat.work_order, 'work order request should return work_order');
  assert.equal(workOrderChat.work_order.executor, 'claude-zero-confirm', 'executor must be claude-zero-confirm');
  assert.equal(workOrderChat.work_order.route, 'zero-confirm', 'route must be zero-confirm');
  assert.equal(workOrderChat.work_order.userYesRequired, false, 'userYesRequired must be false');
  assert.equal(workOrderChat.work_order.userInputRequired, false, 'userInputRequired must be false');
  assert.equal(workOrderChat.work_order.manualCodeUiAllowed, false, 'manualCodeUiAllowed must be false');
  assert.equal(workOrderChat.work_order.officialRoute, 'Console → Handoff → Runner', 'officialRoute must be fixed');
  assert.equal(workOrderChat.work_order.codexYesHellGuard, 'active', 'codexYesHellGuard must be active');
  assert.equal(workOrderChat.work_order.codexAutoApproveMode, 'active', 'codexAutoApproveMode must be active');
  assert.ok(workOrderChat.reply.includes('作業票ドラフト') || workOrderChat.reply.includes('作業票'), 'reply should mention work order draft');

  const pipelineChat = await handleChatRequest({
    message: 'KOSAME CHATから指示を投げたら、Handoff Queue / Runner / Codex実行経路へ流れて、AGENT STREAM LOGに状態が出るようにしてください。',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
    handoffDir: pipelineHandoffDir,
    attachments,
  });

  assert.equal(pipelineChat.ok, true, 'spec request should be accepted');
  assert.ok(pipelineChat.reply.includes('Runnerが自動実行します') || pipelineChat.reply.includes('Handoff Inbox'), 'reply should mention automatic handoff / runner');
  assert.ok(!pipelineChat.work_order, 'spec request should not return a direct work_order payload');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'chat.received'), 'chat.received stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'attachments.received'), 'attachments.received stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'attachments.summary.built'), 'attachments.summary.built stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'spec-to-tasks.started'), 'spec-to-tasks.started stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'handoff.save.started'), 'handoff.save.started stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'handoff.save.completed'), 'handoff.save.completed stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'runner.dispatch.started'), 'runner.dispatch.started stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'runner.dispatch.completed'), 'runner.dispatch.completed stage should exist');
  assert.ok(Array.isArray(pipelineChat.pipeline_trace) && pipelineChat.pipeline_trace.some((stage) => stage.stage === 'result.decision.updated'), 'result.decision.updated stage should exist');

  const inbox = readLatestHandoffInbox({ handoffDir: pipelineHandoffDir });
  assert.ok(inbox.count >= 1, 'handoff inbox should contain entries');
  assert.ok(inbox.latest, 'handoff inbox latest entry should exist');
  assert.ok(inbox.latest.attachment_manifest_path || inbox.latest.attachmentManifestPath, 'handoff entry should include attachment manifest path');

  const latestMd = fs.readFileSync(path.join(pipelineHandoffDir, 'latest.md'), 'utf8');
  const queueJsonl = fs.readFileSync(path.join(pipelineHandoffDir, 'queue.jsonl'), 'utf8');
  assert.ok(!/data:image\/[a-z0-9.+-]+;base64,/i.test(latestMd), 'latest.md should not contain raw base64');
  assert.ok(!/data:image\/[a-z0-9.+-]+;base64,/i.test(queueJsonl), 'queue.jsonl should not contain raw base64');
  assert.ok(queueJsonl.includes('attachment_manifest_path'), 'queue.jsonl should reference attachment manifest');
  assert.ok(queueJsonl.includes('codex_yes_hell_guard'), 'queue.jsonl should preserve codex guard evidence');

  const shellActivity = fs.readFileSync(shellLog, 'utf8');
  assert.ok(shellActivity.includes('chat.received') || shellActivity.includes('KOSAME: 受信した入力を受け付けました'), 'AGENT STREAM LOG should include chat receipt');
  assert.ok(shellActivity.includes('attachments.received') || shellActivity.includes('KOSAME: 添付ファイル'), 'AGENT STREAM LOG should include attachment receipt');
  assert.ok(shellActivity.includes('attachments.summary.built') || shellActivity.includes('添付サマリを構築しました'), 'AGENT STREAM LOG should include attachment summary');
  assert.ok(shellActivity.includes('Runner: attachment manifestを保存しました') || shellActivity.includes('Runner'), 'AGENT STREAM LOG should include runner manifest log');
  assert.ok(shellActivity.includes('Llama: base64本文混入は検出されませんでした。以上。') || shellActivity.includes('base64本文混入'), 'AGENT STREAM LOG should include base64 safety message');

  const queueResults = processQueue({
    handoffOpts: { handoffDir: pipelineHandoffDir },
    runsDir: runnerRunsDir,
    state: {},
    executor: (ticket, runDir) => {
      fs.writeFileSync(path.join(runDir, 'output.md'), `executed ${ticket.id}`);
      fs.writeFileSync(path.join(runDir, 'verify.log'), 'verify: PASS');
      return { ok: true, exitCode: 0, error: null };
    },
  });
  assert.ok(Array.isArray(queueResults) && queueResults.length >= 1, 'runner queue should detect handoff items');
  assert.ok(queueResults.every((item) => item.status === 'completed'), 'runner queue items should complete');
  for (const result of queueResults) {
    const runDir = path.join(runnerRunsDir, result.ticketId || result.runId);
    assert.ok(fs.existsSync(path.join(runDir, 'result.json')), `result.json must exist for ${result.ticketId || result.runId}`);
  }

  const latestTicket = inbox.latest;
  const approvalRef = latestTicket.work_order_id || latestTicket.approval_id || latestTicket.handoff_id || latestTicket.id;
  const resultRecord = recordWorkOrderResult({
    work_order_id: approvalRef,
    approval_id: approvalRef,
    handoff_id: approvalRef,
    work_order: latestTicket,
    title: latestTicket.title,
    target_repo: latestTicket.target_repo,
    assigned_agent: latestTicket.assigned_agent,
    agent: latestTicket.agent,
    executor: 'claude-zero-confirm',
    route: 'zero-confirm',
    result_status: 'success',
    smoke_result: 'PASS',
    verify_result: 'PASS',
    result_summary: 'KOSAME CHAT → Runner autoexec MVP completed',
    changed_files: ['tools/kosame-codex-dispatch-watcher.js'],
    notes: 'queue detected and runner executed',
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
    execution_path: 'KOSAME CHAT → Handoff Queue → Runner → Codex → resultPOST → Result Decision',
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
    assigned_lanes: ['PM Lane', 'Implementation Lane', 'Safety Lane', 'Executor Policy Lane', 'Prompt Firewall Lane', 'Auto-Responder Lane', 'Audit Lane', 'Smoke Lane', 'Verify Lane', 'UI/Console Lane', 'Result Decision Lane', 'Release Lane'],
    lane_statuses: [
      { label: 'PM Lane', status: 'active' },
      { label: 'Implementation Lane', status: 'active' },
      { label: 'Safety Lane', status: 'active' },
      { label: 'Executor Policy Lane', status: 'active' },
      { label: 'Prompt Firewall Lane', status: 'active' },
      { label: 'Auto-Responder Lane', status: 'active' },
      { label: 'Audit Lane', status: 'active' },
      { label: 'Smoke Lane', status: 'active' },
      { label: 'Verify Lane', status: 'active' },
      { label: 'UI/Console Lane', status: 'active' },
      { label: 'Result Decision Lane', status: 'active' },
      { label: 'Release Lane', status: 'active' },
    ],
  }, {
    latestHandoffWorkOrder: { ...latestTicket, approval_id: approvalRef, work_order_id: approvalRef, handoff_id: approvalRef },
    latestApprovedWorkOrder: { ...latestTicket, approval_id: approvalRef, work_order_id: approvalRef },
    workOrderResultLogPath: resultLog,
    workOrderApprovalLogPath: approvalLog,
  });

  assert.equal(resultRecord.ok, true, 'result record should be saved');
  assert.ok(resultRecord.latestWorkOrderResult, 'latestWorkOrderResult should exist');
  assert.equal(resultRecord.latestWorkOrderResult.yes_count, 0, 'yes_count must remain zero');
  assert.equal(resultRecord.latestWorkOrderResult.copy_count, 0, 'copy_count must remain zero');
  assert.equal(resultRecord.latestWorkOrderResult.human_wait, 0, 'human_wait must remain zero');

  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: resultRecord.latestWorkOrderResult,
    latestHandoffWorkOrder: latestTicket,
    latestApprovedWorkOrder: latestTicket,
  });
  assert.equal(decision.decision_status, 'ready_for_commit', 'result decision should be ready_for_commit');
  assert.equal(decision.executor, 'claude-zero-confirm', 'decision executor should remain zero-confirm');
  assert.equal(decision.route, 'zero-confirm', 'decision route should remain zero-confirm');
  assert.ok(decision.summary.includes('routerDecision=KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first'), 'decision summary should include router decision evidence');
  assert.ok(decision.summary.includes('assignedLanes=PM Lane'), 'decision summary should include lane evidence');

  const resultLogText = fs.readFileSync(resultLog, 'utf8');
  assert.ok(resultLogText.includes('ready_for_commit'), 'result log should include ready_for_commit');
  assert.ok(resultLogText.includes('claude-zero-confirm'), 'result log should preserve executor');
  assert.ok(resultLogText.includes('KOSAME Router / route=zero-confirm'), 'result log should preserve router decision');

  console.log('  PASS chat → handoff queue → runner → result store path');
  console.log('  PASS AGENT STREAM LOG records pipeline stages');
  console.log('  PASS no YES / no manual paste / official route only');
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
