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
const { recordWorkOrderResult } = require('../tools/kosame-work-order-result-store');
const { buildWorkOrderResultDecision, summarizeDecision } = require('../tools/kosame-work-order-result-decision');
const { buildConsoleContextSummary } = require('../tools/kosame-cockpit-context');
const { buildLocalReply } = require('../tools/kosame-cockpit-chat-server');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');
const CONTEXT_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-context.js');
const ACTIVITY_PATH = path.join(ROOT, 'tools', 'kosame-shell-agent-activity.js');
const DECISION_PATH = path.join(ROOT, 'tools', 'kosame-work-order-result-decision.js');
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-26-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');
const HANDOFF_LOG_PATH = path.join(TEMP_ROOT, 'work-order-handoffs.jsonl');
const RESULT_LOG_PATH = path.join(TEMP_ROOT, 'work-order-results.jsonl');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');
const SECRET_SENTINEL = 'sk-DECISION-LEAK-1234567890';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function countLines(filePath) {
  if (!fs.existsSync(filePath)) return 0;
  return read(filePath).split(/\r?\n/).filter(Boolean).length;
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

function makeWorkOrder(title, agent = 'Codex', targetRepo = '/home/lavie/kosame-dev-orchestra') {
  return {
    title,
    agent,
    target_repo: targetRepo,
    risk_level: 'medium',
    requires_human_confirmation: true,
    prompt: [
      `cd ${targetRepo}`,
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

function assertDecision(status, decision, extra = {}) {
  assert.ok(decision, `${status} decision must exist`);
  assert.equal(decision.decision_status, status, `${status} decision_status must match`);
  assert.equal(decision.nextRecommendedAction, status, `${status} nextRecommendedAction must match`);
  assert.ok(summarizeDecision(decision).includes(`status=${status}`), `${status} summarizeDecision must include status`);
  if (Object.prototype.hasOwnProperty.call(extra, 'humanGate')) {
    assert.equal(decision.human_gate_required, extra.humanGate, `${status} human_gate_required must match`);
  }
  if (Object.prototype.hasOwnProperty.call(extra, 'commitAllowed')) {
    assert.equal(decision.commit_tag_push_allowed, extra.commitAllowed, `${status} commit_tag_push_allowed must match`);
  }
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
  assert.ok(isVersionAtLeast(pkg.version, '110.84.26'), `package version must be >= 110.84.26 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-26'], 'smoke:v110-84-26 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-26'), 'verify must include smoke:v110-84-26');
  console.log('  PASS: package wiring');

  const html = read(HTML_PATH);
  assert.ok(html.includes('work-order-result-decision-panel'), 'HTML must include decision panel area');
  assert.ok(html.includes('work-order-result-decision-status'), 'HTML must include decision status area');
  assert.ok(html.includes('chat-work-order-decision-line'), 'HTML must include decision line wiring');
  assert.ok(html.includes('work-order-result-panel'), 'HTML must keep result intake panel');
  assert.ok(html.includes('notificationSoundEnabled'), 'HTML must keep notification wiring');
  assert.ok(html.includes('chat-llama-audit-badge'), 'HTML must keep llama audit badge');
  assert.ok(!html.includes('sound-hint-legacy'), 'HTML must not keep legacy sound hint');
  console.log('  PASS: HTML decision wiring');

  const serverSource = read(SERVER_PATH);
  assert.ok(serverSource.includes('/api/work-orders/result'), 'server must expose result API');
  assert.ok(serverSource.includes('buildWorkOrderResultDecision'), 'server must build decision state');
  assert.ok(serverSource.includes('buildResultActivityMessage'), 'server must build a safe result activity message');
  assert.ok(serverSource.includes('appendShellAgentActivityEvent'), 'server must append activity events for result intake');
  assert.ok(!serverSource.includes('git commit'), 'server must not auto-run commit');
  assert.ok(!serverSource.includes('git push'), 'server must not auto-run push');
  assert.ok(!serverSource.includes('gcloud deploy'), 'server must not auto-run deploy');
  console.log('  PASS: server decision wiring');

  const snapshotSource = read(SNAPSHOT_PATH);
  assert.ok(snapshotSource.includes('latestWorkOrderDecision'), 'snapshot must expose latestWorkOrderDecision');
  assert.ok(snapshotSource.includes('workOrderDecisionQueue'), 'snapshot must expose workOrderDecisionQueue');
  console.log('  PASS: snapshot decision wiring');

  const contextSource = read(CONTEXT_PATH);
  assert.ok(contextSource.includes('workOrderDecision='), 'console context must include work order decision summary');
  console.log('  PASS: console context decision wiring');

  const activitySource = read(ACTIVITY_PATH);
  assert.ok(activitySource.includes('ready_for_commit') || activitySource.includes('review_ready'), 'activity must support decision-friendly statuses');
  assert.ok(activitySource.includes('waiting_result'), 'activity must recognize waiting_result');
  console.log('  PASS: shell activity wiring');

  const decisionSource = read(DECISION_PATH);
  assert.ok(decisionSource.includes('ready_for_review'), 'decision helper must include ready_for_review');
  assert.ok(decisionSource.includes('wait_for_result'), 'decision helper must include wait_for_result');
  console.log('  PASS: decision helper wiring');

  const chatSource = read(CHAT_SERVER_PATH);
  assert.ok(chatSource.includes('resultDecision'), 'chat server must parse result decision signals');
  assert.ok(chatSource.includes('commit前review'), 'chat server must mention commit-prep guidance');
  console.log('  PASS: chat decision wiring');
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

async function runDirectCycle() {
  const approve = approveWorkOrder({
    work_order: makeWorkOrder('v110.84.26 result decision direct cycle'),
  }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
  });
  const handoff = recordWorkOrderHandoff({
    status: 'handed_to_agent',
    work_order_id: approve.latestApprovedWorkOrder.approval_id,
    assigned_agent: approve.latestApprovedWorkOrder.agent,
    work_order: approve.latestApprovedWorkOrder,
  }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    latestApprovedWorkOrder: approve.latestApprovedWorkOrder,
  });
  assert.equal(handoff.latestHandoffWorkOrder.status, 'handed_to_agent', 'direct handoff must start handed_to_agent');

  const result = recordWorkOrderResult({
    work_order_id: approve.latestApprovedWorkOrder.approval_id,
    result_status: 'success',
    result_summary: '実装は完了しました。',
    changed_files: ['public/kosame-live-cockpit.html', 'tools/kosame-work-order-result-decision.js'],
    smoke_result: 'PASS',
    verify_result: 'PASS',
    notes: 'safe note',
    work_order: handoff.latestHandoffWorkOrder,
  }, {
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    latestApprovedWorkOrder: approve.latestApprovedWorkOrder,
    latestHandoffWorkOrder: handoff.latestHandoffWorkOrder,
  });
  assert.equal(result.latestWorkOrderResult.decision_status, 'ready_for_commit', 'direct result decision must be ready_for_commit');
  assert.equal(result.latestWorkOrderResult.nextRecommendedAction, 'ready_for_commit', 'direct nextRecommendedAction must be ready_for_commit');

  const latest = collectLiveCockpitSnapshot({
    activeRepoPath: '/home/lavie/kosame-dev-orchestra',
    devRepoPath: '/home/lavie/kosame-dev-orchestra',
    salesRepoPath: '/home/lavie/repos/transcriber',
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  assert.equal(latest.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot decision must be ready_for_commit');
  assert.equal(latest.latestWorkOrderDecision.commit_tag_push_allowed, true, 'snapshot decision must permit commit candidate');
  assert.ok(Array.isArray(latest.workOrderDecisionQueue), 'snapshot must expose workOrderDecisionQueue');
  assert.equal(latest.workOrderDecisionQueue[0].decision_status, 'ready_for_commit', 'decision queue must surface ready_for_commit');

  const contextSummary = buildConsoleContextSummary(latest).summary;
  assert.ok(contextSummary.includes('workOrderDecision='), 'context summary must include workOrderDecision');
  const reply = buildLocalReply({
    message: '次なにする？',
    contextSummary,
  }, contextSummary);
  assert.ok(reply.reply.includes('commit前review') || reply.reply.includes('commit準備'), 'chat reply must reference commit review guidance');

  const activityBefore = countLines(ACTIVITY_LOG_PATH);
  collectLiveCockpitSnapshot({
    activeRepoPath: '/home/lavie/kosame-dev-orchestra',
    devRepoPath: '/home/lavie/kosame-dev-orchestra',
    salesRepoPath: '/home/lavie/repos/transcriber',
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  collectLiveCockpitSnapshot({
    activeRepoPath: '/home/lavie/kosame-dev-orchestra',
    devRepoPath: '/home/lavie/kosame-dev-orchestra',
    salesRepoPath: '/home/lavie/repos/transcriber',
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  const activityAfter = countLines(ACTIVITY_LOG_PATH);
  assert.equal(activityAfter, activityBefore, 'snapshot refresh must not append duplicate activity');

  assertNoLeak(RESULT_LOG_PATH, SECRET_SENTINEL);
  assertNoLeak(ACTIVITY_LOG_PATH, SECRET_SENTINEL);
  console.log('  PASS: direct decision cycle and safety checks');
}

async function runHttpCycle(port) {
  const salesWorkOrder = makeWorkOrder('v110.84.26 Sales DX approval regression', 'Codex', '/home/lavie/repos/transcriber');
  const salesApprove = await requestJson(port, '/api/work-orders/approve', { work_order: salesWorkOrder });
  assert.equal(salesApprove.statusCode, 200, 'sales approval must return 200');
  assert.equal(salesApprove.body.ok, true, 'sales approval must be ok');

  const salesSnapshot = await requestJson(port, '/api/snapshot', null, 'GET');
  assert.equal(salesSnapshot.statusCode, 200, 'sales snapshot must return 200');
  const salesApprovedTargetRepo = salesSnapshot.body.latestApprovedWorkOrder?.target_repo || salesApprove.body.latestApprovedWorkOrder?.target_repo || null;
  assert.equal(salesApprovedTargetRepo, '/home/lavie/repos/transcriber', 'shared snapshot or approval response must keep Sales DX approval');
  assert.notEqual(salesSnapshot.body.latestHandoffWorkOrder?.target_repo || '', '/home/lavie/repos/transcriber', 'handoff queue must stay Dev Orchestra only');

  const devApprove = await requestJson(port, '/api/work-orders/approve', {
    work_order: makeWorkOrder('v110.84.26 success result decision', 'Codex'),
  });
  assert.equal(devApprove.statusCode, 200, 'dev approval must return 200');
  assert.equal(devApprove.body.ok, true, 'dev approval must be ok');

  const devHandoff = await requestJson(port, '/api/work-orders/handoff', {
    work_order_id: devApprove.body.latestApprovedWorkOrder.approval_id,
    assigned_agent: devApprove.body.latestApprovedWorkOrder.agent,
    status: 'handed_to_agent',
    work_order: devApprove.body.latestApprovedWorkOrder,
  });
  assert.equal(devHandoff.statusCode, 200, 'handoff must return 200');
  assert.equal(devHandoff.body.ok, true, 'handoff must be ok');

  const result = await requestJson(port, '/api/work-orders/result', {
    work_order_id: devApprove.body.latestApprovedWorkOrder.approval_id,
    result_status: 'success',
    result_summary: '実装は完了しました。',
    changed_files: ['public/kosame-live-cockpit.html', 'tools/kosame-work-order-result-decision.js'],
    smoke_result: 'PASS',
    verify_result: 'PASS',
    notes: 'safe note',
  });
  assert.equal(result.statusCode, 200, 'result POST must return 200');
  assert.equal(result.body.ok, true, 'result POST must be ok');
  assert.equal(result.body.nextRecommendedAction, 'ready_for_commit', 'result POST must surface ready_for_commit');
  assert.equal(result.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'result POST must surface decision');
  assert.equal(result.body.activityLogged, true, 'result POST must log activity');

  const resultGet = await requestJson(port, '/api/work-orders/result', null, 'GET');
  assert.equal(resultGet.statusCode, 200, 'result GET must return 200');
  assert.equal(resultGet.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'result GET must surface decision');

  const snapshot = await requestJson(port, '/api/snapshot', null, 'GET');
  assert.equal(snapshot.statusCode, 200, 'snapshot must return 200');
  assert.equal(snapshot.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot must surface decision');
  assert.ok(Array.isArray(snapshot.body.workOrderDecisionQueue), 'snapshot must expose workOrderDecisionQueue');

  const chatReply = await requestJson(port, '/api/chat', {
    message: '次なにする？',
    project: 'KOSAME Console',
    contextSummary: snapshot.body.consoleContextSummary,
  });
  assert.equal(chatReply.statusCode, 200, 'chat reply must return 200');
  assert.equal(chatReply.body.ok, true, 'chat reply must be ok');
  assert.ok(chatReply.body.reply.includes('commit前review') || chatReply.body.reply.includes('commit準備'), 'chat reply must mention commit review guidance');

  const secretGate = await requestJson(port, '/api/work-orders/result', {
    work_order_id: devApprove.body.latestApprovedWorkOrder.approval_id,
    result_status: 'success',
    result_summary: '安全確認',
    changed_files: ['public/kosame-live-cockpit.html'],
    smoke_result: 'PASS',
    verify_result: 'PASS',
    notes: SECRET_SENTINEL,
  });
  assert.equal(secretGate.statusCode, 400, 'secret-like result payload must be rejected');
  assert.equal(secretGate.body.ok, false, 'secret-like result payload must fail');

  const activityLog = fs.existsSync(ACTIVITY_LOG_PATH) ? read(ACTIVITY_LOG_PATH) : '';
  assert.ok(activityLog.includes('result decision'), 'activity log must include result decision task');
  assert.ok(activityLog.includes('ready_for_commit') || activityLog.includes('commit候補'), 'activity log must mention decision guidance');

  const snapshotBefore = countLines(ACTIVITY_LOG_PATH);
  await requestJson(port, '/api/snapshot', null, 'GET');
  await requestJson(port, '/api/snapshot', null, 'GET');
  const snapshotAfter = countLines(ACTIVITY_LOG_PATH);
  assert.equal(snapshotAfter, snapshotBefore, 'snapshot refresh must not duplicate activity');

  assertNoLeak(RESULT_LOG_PATH, SECRET_SENTINEL);
  assertNoLeak(ACTIVITY_LOG_PATH, SECRET_SENTINEL);
  console.log('  PASS: HTTP decision cycle and safety checks');
}

async function main() {
  console.log('=== v110.84.26 result decision panel smoke ===');

  assertStaticWiring();

  assertDecision('ready_for_commit', buildWorkOrderResultDecision({
    latestWorkOrderResult: { result_status: 'success', smoke_result: 'PASS', verify_result: 'PASS' },
  }), { humanGate: true, commitAllowed: true });
  assertDecision('ready_for_review', buildWorkOrderResultDecision({
    latestWorkOrderResult: { result_status: 'success', smoke_result: 'unknown', verify_result: 'unknown' },
  }), { humanGate: true, commitAllowed: false });
  assertDecision('request_fix', buildWorkOrderResultDecision({
    latestWorkOrderResult: { result_status: 'needs_fix', smoke_result: 'PASS', verify_result: 'FAIL' },
  }), { humanGate: true, commitAllowed: false });
  assertDecision('stop_and_investigate', buildWorkOrderResultDecision({
    latestWorkOrderResult: { result_status: 'failed', smoke_result: 'FAIL', verify_result: 'FAIL' },
  }), { humanGate: true, commitAllowed: false });
  assertDecision('wait_for_result', buildWorkOrderResultDecision({}), { humanGate: false, commitAllowed: false });
  console.log('  PASS: decision helper states');

  const previousApproval = process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
  const previousHandoff = process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
  const previousResult = process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
  const previousActivity = process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;

  const runtime = await startServerIfPossible();
  const { server, port, restoreEnv } = runtime;

  try {
    if (port == null) {
      console.log('  PASS: HTTP runtime unavailable in this environment; running direct store/snapshot verification');
      await runDirectCycle();
    } else {
      await runHttpCycle(port);
    }
  } finally {
    if (server) {
      await new Promise((resolve) => {
        try { server.close(resolve); } catch { resolve(); }
      });
    }
    restoreEnv();
    if (typeof previousApproval === 'string') process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH = previousApproval;
    else delete process.env.KOSAME_WORK_ORDER_APPROVAL_LOG_PATH;
    if (typeof previousHandoff === 'string') process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH = previousHandoff;
    else delete process.env.KOSAME_WORK_ORDER_HANDOFF_LOG_PATH;
    if (typeof previousResult === 'string') process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH = previousResult;
    else delete process.env.KOSAME_WORK_ORDER_RESULT_LOG_PATH;
    if (typeof previousActivity === 'string') process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH = previousActivity;
    else delete process.env.KOSAME_SHELL_AGENT_ACTIVITY_LOG_PATH;
  }

  console.log('✅ v110.84.26 result decision panel smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
