#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const { classifyExecutionHost } = require('../tools/kosame-execution-host-guard');
const { evaluateNoYesGate } = require('../tools/kosame-no-yes-gate');
const { handleChatRequest } = require('../tools/kosame-cockpit-chat-server');
const { buildWorkOrderResultDecision } = require('../tools/kosame-work-order-result-decision');
const { buildOperationsBoard } = require('../tools/kosame-operations-board');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.34 codex yes hell smoke =====');

async function main() {
  const claudeUi = classifyExecutionHost({ executionHost: 'claude-code-ui', interactive: true, executionSource: 'claude code ui' });
  assert.equal(claudeUi.executionHostAllowed, false);
  assert.equal(claudeUi.interactiveHostBlocked, true);
  assert.equal(claudeUi.interactivePromptBlocked, true);
  assert.equal(claudeUi.codexYesHellGuard, 'active');
  assert.equal(claudeUi.codexAutoApproveMode, 'active');
  assert.equal(claudeUi.userYesRequired, false);
  assert.equal(claudeUi.safetyStopGuard, 'active');

  const codexUi = classifyExecutionHost({ executionHost: 'codex-code-ui', interactive: true, executionSource: 'codex code ui' });
  assert.equal(codexUi.executionHostAllowed, false);
  assert.equal(codexUi.interactiveHostBlocked, true);
  assert.equal(codexUi.interactivePromptBlocked, true);

  const runnerPrompt = evaluateNoYesGate({ text: 'Type YES to continue', executionHost: 'kosame-runner', source: 'stdout' });
  assert.equal(runnerPrompt.decision, 'blocked_by_interactive_prompt');
  assert.equal(runnerPrompt.userInputRequired, false);
  assert.equal(runnerPrompt.interactivePromptBlocked, true);
  assert.equal(runnerPrompt.codexYesHellGuard, 'active');
  assert.equal(runnerPrompt.codexAutoApproveMode, 'active');
  assert.equal(runnerPrompt.userYesRequired, false);
  assert.equal(runnerPrompt.safetyStopGuard, 'active');

  const feedbackPrompt = evaluateNoYesGate({ text: 'How is Claude doing this session?', executionHost: 'kosame-runner', source: 'stderr' });
  assert.equal(feedbackPrompt.decision, 'blocked_by_interactive_prompt');
  assert.equal(feedbackPrompt.userInputRequired, false);
  assert.equal(feedbackPrompt.promptType, 'feedback_prompt');

  const chat = await handleChatRequest({
    message: 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して',
    selectedProjectId: 'dev-orchestra',
    selectedProjectPath: '/home/lavie/kosame-dev-orchestra',
    selectedProjectLabel: 'KOSAME Dev Orchestra',
  });
  assert.equal(chat.ok, true, 'chat request should be accepted');
  assert.ok(chat.work_order, 'work order should be generated');
  assert.equal(chat.work_order.executor, 'claude-zero-confirm');
  assert.equal(chat.work_order.route, 'zero-confirm');
  assert.equal(chat.work_order.officialRoute, 'Console → Handoff → Runner');
  assert.equal(chat.work_order.codexYesHellGuard, 'active');
  assert.equal(chat.work_order.codexAutoApproveMode, 'active');
  assert.equal(chat.work_order.userYesRequired, false);
  assert.equal(chat.work_order.interactivePromptBlocked, false);
  assert.equal(chat.work_order.userInputRequired, false);
  assert.match(JSON.stringify(chat.work_order.orchestra_evidence || {}), /Router/);
  assert.ok(read('KOSAME.bat').includes('Codex YES地獄対策: active'), 'KOSAME.bat should advertise the guard');
  assert.ok(!read('KOSAME.bat').includes('Claude Codeに投げてください'), 'manual Claude route should be removed');
  assert.ok(!read('KOSAME.bat').includes('Codexに投げてください'), 'manual Codex route should be removed');

  const decision = buildWorkOrderResultDecision({
    latestWorkOrderResult: {
      result_status: 'success',
      smoke_result: 'PASS',
      verify_result: 'PASS',
      executor: 'claude-zero-confirm',
      route: 'zero-confirm',
      interactivePromptBlocked: true,
      codexYesHellGuard: 'active',
      codexAutoApproveMode: 'active',
      userYesRequired: false,
      safetyStopGuard: 'active',
      router_decision: 'KOSAME Router / route=zero-confirm / executor=claude-zero-confirm / mode=complete-run-first',
      assigned_lanes: ['PM Lane', 'Implementation Lane'],
      lane_statuses: [{ label: 'PM Lane', status: 'active' }],
    },
  });
  assert.equal(decision.interactivePromptBlocked, true);
  assert.equal(decision.codexYesHellGuard, 'active');
  assert.equal(decision.codexAutoApproveMode, 'active');
  assert.equal(decision.userYesRequired, false);
  assert.equal(decision.safetyStopGuard, 'active');
  assert.ok(decision.summary.includes('interactivePromptBlocked=true'));
  assert.ok(decision.summary.includes('codexYesHellGuard=active'));

  const board = buildOperationsBoard({
    latestWorkOrderResult: decision,
    latestWorkOrderDecision: decision,
    workOrderResultHistory: [],
  });
  assert.equal(board.codexYesHellGuard, 'active');
  assert.equal(board.codexAutoApproveMode, 'active');
  assert.equal(board.userYesRequired, false);
  assert.ok(board.summary.includes('officialRoute=Console → Handoff → Runner'));
  assert.ok(board.summary.includes('codexYesHellGuard=active'));
  assert.ok(board.summary.includes('interactivePromptBlocked=true'));

  const liveServerSrc = read('tools/kosame-live-cockpit-server.js');
  assert.ok(liveServerSrc.includes('codexYesHellGuard'), 'live server should surface codexYesHellGuard');
  assert.ok(liveServerSrc.includes('interactivePromptBlocked'), 'live server should surface interactivePromptBlocked');

  console.log('  PASS: interactive UI hosts are blocked');
  console.log('  PASS: runner prompts are blocked without user wait');
  console.log('  PASS: official route stays Console → Handoff → Runner');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
