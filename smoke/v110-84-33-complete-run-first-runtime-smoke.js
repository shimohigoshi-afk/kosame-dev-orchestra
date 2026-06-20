#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');
const { COMPLETE_RUN_FIRST_POLICY, AUTO_YES_CONTRACT, assertNoHumanWait } = require('../tools/kosame-prompt-lint');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { handleChatRequest, detectWorkOrderIntent } = require('../tools/kosame-cockpit-chat-server');
const { safetyPreFlight } = require('../tools/kosame-codex-dispatch-watcher');

const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const WATCHER_PATH = path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js');
const LINT_PATH = path.join(ROOT, 'tools', 'kosame-prompt-lint.js');
const LIVE_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-server.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-84-33-'));
const APPROVAL_LOG_PATH = path.join(TEMP_ROOT, 'work-orders.jsonl');
const HANDOFF_LOG_PATH = path.join(TEMP_ROOT, 'work-order-handoffs.jsonl');
const RESULT_LOG_PATH = path.join(TEMP_ROOT, 'work-order-results.jsonl');
const ACTIVITY_LOG_PATH = path.join(TEMP_ROOT, 'shell-agent-activity.jsonl');

const EXACT_REQUEST = 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して';
const FORBIDDEN_PHRASES = [
  'YESと返してください',
  'reply YES',
  '続けますか',
  '承認してください',
  '手動で貼り付けてください',
  'human wait',
  'please confirm',
  'continue?',
  '貼り付けてください',
  'Codexへ貼り付け待ち',
  '確認してから Codex に貼ってください',
];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assertNoForbiddenPhrase(text, label) {
  const value = String(text || '');
  for (const phrase of FORBIDDEN_PHRASES) {
    if (value.toLowerCase().includes(phrase.toLowerCase())) {
      assert.fail(`[complete-run-first] Forbidden phrase "${phrase}" found in ${label}`);
    }
  }
}

function requestJson(port, pathname, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
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
      },
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(fn) {
  const { server } = createLiveCockpitServer({
    workOrderApprovalLogPath: APPROVAL_LOG_PATH,
    workOrderHandoffLogPath: HANDOFF_LOG_PATH,
    workOrderResultLogPath: RESULT_LOG_PATH,
    shellAgentActivityLogPath: ACTIVITY_LOG_PATH,
  });
  const port = await new Promise((resolve, reject) => {
    const onError = (error) => {
      if (error && error.code === 'EPERM') resolve(null);
      else reject(error);
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
    return await fn(port);
  } finally {
    await new Promise((resolve) => { try { server.close(resolve); } catch { resolve(); } });
  }
}

async function main() {
  console.log('=== v110.84.33 complete-run first runtime smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '110.84.33'), `version must be >= 110.84.33 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-33'], 'smoke:v110-84-33 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v110-84-33'), 'verify must include smoke:v110-84-33');
  console.log('  PASS: package wiring');

  delete require.cache[require.resolve(LINT_PATH)];
  const lint = require(LINT_PATH);
  assert.equal(typeof lint.COMPLETE_RUN_FIRST_POLICY, 'string', 'prompt lint must export COMPLETE_RUN_FIRST_POLICY');
  assert.ok(lint.COMPLETE_RUN_FIRST_POLICY.includes('work order採用'), 'policy must start with work order adoption');
  assert.ok(lint.COMPLETE_RUN_FIRST_POLICY.includes('resultPOST'), 'policy must include resultPOST');
  assert.ok(lint.COMPLETE_RUN_FIRST_POLICY.includes('Safety Stop'), 'policy must keep Safety Stop only for stopping');
  console.log('  PASS: prompt lint policy wiring');

  const html = read(HTML_PATH);
  assertNoForbiddenPhrase(html, 'Console HTML');
  assert.ok(html.includes('dispatch待ち'), 'HTML must surface dispatch wording');
  assert.ok(!html.includes('Codexへ貼り付け待ち'), 'HTML must not mention paste-wait');
  assert.ok(!html.includes('確認してから Codex に貼ってください'), 'HTML must not ask for manual paste');
  assert.ok(html.includes('Result Decision Panel'), 'HTML must keep result decision panel');
  console.log('  PASS: HTML no human-wait / no paste wiring');

  const chatSource = read(CHAT_SERVER_PATH);
  assert.ok(chatSource.includes('COMPLETE_RUN_FIRST_POLICY'), 'chat server must inject complete-run policy into work orders');
  assert.ok(chatSource.includes('KOSAME Runner / dispatch watcher'), 'chat server reply must name KOSAME Runner / dispatch watcher');
  assert.ok(chatSource.includes('KOSAME_RESULT_BEGIN'), 'chat server must embed result marker');
  assert.ok(chatSource.includes('KOSAME_RESULT_END'), 'chat server must embed result marker end');
  console.log('  PASS: chat server runner naming');

  const watcherSource = read(WATCHER_PATH);
  assert.ok(watcherSource.includes('KOSAME Runner起動'), 'watcher must call itself KOSAME Runner');
  assert.ok(watcherSource.includes('dispatch watcher'), 'watcher must mention dispatch watcher');
  assert.ok(watcherSource.includes('Safety Stop'), 'watcher must retain Safety Stop');
  console.log('  PASS: watcher runner naming');

  const liveServerSource = read(LIVE_SERVER_PATH);
  assert.ok(liveServerSource.includes('dispatch待ちです'), 'live server must use dispatch wording');
  assert.ok(liveServerSource.includes('runner実行中です'), 'live server must use runner wording');
  assert.ok(liveServerSource.includes('resultPOST待ちです'), 'live server must use resultPOST wording');
  assert.ok(!liveServerSource.includes('Codexへ貼り付け待ち'), 'live server must not mention paste-wait');
  console.log('  PASS: live server naming cleanup');

  assert.equal(detectWorkOrderIntent(EXACT_REQUEST), true, 'exact request must be detected as work order intent');
  const directReply = await handleChatRequest({ message: EXACT_REQUEST, project: 'KOSAME Console' });
  assert.equal(directReply.ok, true, 'direct chat request must succeed');
  assert.ok(directReply.work_order, 'direct chat request must create work order');
  assertNoForbiddenPhrase(directReply.reply, 'direct chat reply');
  assertNoHumanWait(directReply.reply, 'direct chat reply');
  assert.ok(directReply.reply.includes('KOSAME Runner / dispatch watcher'), 'direct reply must reference standard runner path');
  assert.ok(directReply.work_order.body.includes('work order採用'), 'work order body must carry complete-run policy text');
  assert.ok(directReply.work_order.body.includes('resultPOST'), 'work order body must carry resultPOST policy text');
  assert.ok(directReply.work_order.body.includes('node ~/kosame-dev-orchestra/tools/kosame-codex-result-poster.js'), 'work order body must include result poster');
  assert.ok(directReply.work_order.body.includes('KOSAME_RESULT_BEGIN'), 'work order body must include result marker');
  assert.ok(directReply.work_order.body.includes('KOSAME_RESULT_END'), 'work order body must include result marker end');
  assertNoForbiddenPhrase(directReply.work_order.body, 'direct work order body');
  console.log('  PASS: exact work order request becomes complete-run draft');

  const goodPrompt = [
    lint.COMPLETE_RUN_FIRST_POLICY,
    lint.AUTO_YES_CONTRACT,
    'cd /home/lavie/kosame-dev-orchestra',
    '機密情報・環境変数ファイル・認証情報・APIキーは読まない',
    '外部APIを呼ばない',
    '対象repo以外を触らない',
    'git status -sb',
  ].join('\n');
  assert.equal(safetyPreFlight(goodPrompt).ok, true, 'good prompt must pass safety preflight');
  const forcePushPrompt = `${goodPrompt}\ngit push --force origin main`;
  const forceResult = safetyPreFlight(forcePushPrompt);
  assert.equal(forceResult.ok, false, 'force push must trigger Safety Stop');
  assert.ok(forceResult.reason.includes('Safety Stop'), 'force push result must say Safety Stop');
  console.log('  PASS: safety preflight stays on Safety Stop only');

  await withServer(async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP runtime skipped — listen EPERM in this environment');
      return;
    }

    const chatRes = await requestJson(port, '/api/chat', {
      message: EXACT_REQUEST,
      project: 'KOSAME Console',
    });
    assert.equal(chatRes.statusCode, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    assert.ok(chatRes.body.work_order, 'chat must return a work order');
    assertNoForbiddenPhrase(chatRes.body.reply, 'HTTP chat reply');
    assertNoHumanWait(chatRes.body.reply, 'HTTP chat reply');
    assert.ok(chatRes.body.reply.includes('KOSAME Runner / dispatch watcher'), 'HTTP reply must reference standard runner path');

    const approveRes = await requestJson(port, '/api/work-orders/approve', {
      work_order: chatRes.body.work_order,
    });
    assert.equal(approveRes.statusCode, 200, 'approve must return 200');
    assert.equal(approveRes.body.ok, true, 'approve must succeed');

    const handoffRes = await requestJson(port, '/api/work-orders/handoff', {
      work_order_id: approveRes.body.latestApprovedWorkOrder.approval_id,
      assigned_agent: approveRes.body.latestApprovedWorkOrder.agent,
      status: 'handed_to_agent',
      work_order: approveRes.body.latestApprovedWorkOrder,
    });
    assert.equal(handoffRes.statusCode, 200, 'handoff must return 200');
    assert.equal(handoffRes.body.ok, true, 'handoff must succeed');

    const resultRes = await requestJson(port, '/api/work-orders/result', {
      work_order_id: approveRes.body.latestApprovedWorkOrder.approval_id,
      result_status: 'success',
      smoke_result: 'PASS',
      verify_result: 'PASS',
      result_summary: 'Complete-run first runtime finished',
      changed_files: ['public/kosame-live-cockpit.html', 'tools/kosame-codex-dispatch-watcher.js'],
      notes: 'runner standard complete',
    });
    assert.equal(resultRes.statusCode, 200, 'result POST must return 200');
    assert.equal(resultRes.body.ok, true, 'result POST must succeed');
    assert.equal(resultRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'result POST must update Decision Panel to ready_for_commit');
    assert.equal(resultRes.body.latestWorkOrderDecision.commit_tag_push_allowed, true, 'result POST must enable commit candidate');

    const snapshotRes = await requestJson(port, '/api/snapshot', null, 'GET');
    assert.equal(snapshotRes.statusCode, 200, 'snapshot must return 200');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.decision_status, 'ready_for_commit', 'snapshot must surface ready_for_commit');
    assert.equal(snapshotRes.body.latestWorkOrderDecision.commit_tag_push_allowed, true, 'snapshot must keep commit candidate');

    const nextRes = await requestJson(port, '/api/chat', {
      message: '次なにする？',
      project: 'KOSAME Console',
      contextSummary: snapshotRes.body.consoleContextSummary,
    });
    assert.equal(nextRes.statusCode, 200, 'next-action chat must return 200');
    assert.equal(nextRes.body.ok, true, 'next-action chat must succeed');
    assertNoForbiddenPhrase(nextRes.body.reply, 'ready_for_commit reply');
    assertNoHumanWait(nextRes.body.reply, 'ready_for_commit reply');
    assert.ok(/ready_for_commit|commit候補|commit準備/.test(nextRes.body.reply), 'next-action reply must reflect ready_for_commit');
    assert.ok(/自動commitはしません|commit前review/.test(nextRes.body.reply), 'next-action reply must preserve review guidance without human wait prompts');
    console.log('  PASS: runtime resultPOST updates Decision Panel and next-action reply');

    const activityLog = fs.existsSync(ACTIVITY_LOG_PATH) ? read(ACTIVITY_LOG_PATH) : '';
    assert.ok(activityLog.includes('dispatch待ち') || activityLog.includes('runner実行中'), 'activity log must mention runner/dispatch states');
  });

  console.log('✅ v110.84.33 complete-run first runtime smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
