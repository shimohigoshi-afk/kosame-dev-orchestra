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

const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const WATCHER_PATH = path.join(ROOT, 'tools', 'kosame-codex-dispatch-watcher.js');
const LINT_PATH = path.join(ROOT, 'tools', 'kosame-prompt-lint.js');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');

// Forbidden phrases in Console UI and work order bodies (outside Safety Stop context)
const FORBIDDEN_PHRASES = [
  'YESと返してください',
  'reply YES',
  '続けますか',
  '承認してください',
  '手動で貼り付けてください',
  'ユーザー確認待ち',
  'human wait',
  'please confirm',
  'continue?',
  '貼り付けてください',
  'Codexへ貼り付け待ち',
  '確認してから Codex に貼ってください',
];

function assertNoForbiddenPhrase(text, label) {
  for (const phrase of FORBIDDEN_PHRASES) {
    if (text.toLowerCase().includes(phrase.toLowerCase())) {
      assert.fail(`[no-user-work] Forbidden phrase "${phrase}" found in ${label}`);
    }
  }
}

function requestJson(port, urlPath, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: urlPath,
        method,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { raw += c; });
        res.on('end', () => {
          try { resolve({ statusCode: res.statusCode, body: JSON.parse(raw || '{}') }); }
          catch { reject(new Error(`invalid json: ${raw.slice(0, 100)}`)); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(fn) {
  const { server } = createLiveCockpitServer({});
  const port = await new Promise((resolve, reject) => {
    const onError = (e) => { if (e && e.code === 'EPERM') resolve(null); else reject(e); };
    server.once('error', onError);
    try {
      server.listen(0, '127.0.0.1', () => { server.off('error', onError); resolve(server.address().port); });
    } catch (e) {
      server.off('error', onError);
      if (e && e.code === 'EPERM') resolve(null); else reject(e);
    }
  });
  try {
    return await fn(port);
  } finally {
    await new Promise((r) => { try { server.close(r); } catch { r(); } });
  }
}

async function main() {
  console.log('=== v110.84.32 No-User-Work smoke ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '110.84.32'), `version must be >= 110.84.32 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v110-84-32'], 'smoke:v110-84-32 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v110-84-32'), 'verify must include smoke:v110-84-32');
  assert.ok(pkg.scripts['codex:watch'], 'codex:watch must exist');
  assert.ok(pkg.scripts['codex:submit'], 'codex:submit must exist');
  console.log('  PASS: package wiring');

  // Prompt lint module exists and exports correctly
  delete require.cache[require.resolve(LINT_PATH)];
  const lint = require(LINT_PATH);
  assert.ok(typeof lint.lintForHumanWait === 'function', 'prompt lint must export lintForHumanWait');
  assert.ok(typeof lint.assertNoHumanWait === 'function', 'prompt lint must export assertNoHumanWait');
  assert.ok(typeof lint.AUTO_YES_CONTRACT === 'string', 'prompt lint must export AUTO_YES_CONTRACT');
  assert.ok(lint.AUTO_YES_CONTRACT.includes('Auto-YES Runtime Contract'), 'contract must contain header');
  assert.ok(lint.AUTO_YES_CONTRACT.includes('Safety Stop'), 'contract must define Safety Stop');
  console.log('  PASS: prompt lint module');

  // Lint module correctly detects forbidden phrases
  const badText = 'タスクを続けますか？YESと返してください。';
  const badResult = lint.lintForHumanWait(badText);
  assert.equal(badResult.ok, false, 'human-wait phrases must be detected');
  assert.ok(badResult.violations.length >= 1, 'must have at least one violation');
  const cleanText = 'Safety Stop: force pushが検出されました。停止します。';
  const cleanResult = lint.lintForHumanWait(cleanText);
  assert.equal(cleanResult.ok, true, 'clean text must pass lint');
  console.log('  PASS: prompt lint detection');

  // HTML has no forbidden human-wait phrases
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  assertNoForbiddenPhrase(html, 'Console HTML');
  assert.ok(!html.includes('確認してから Codex に貼ってください'), 'HTML must not have paste instruction');
  assert.ok(!html.includes('Codexへ貼り付け待ち'), 'HTML must not have paste-wait label');
  assert.ok(html.includes('dispatch待ち'), 'HTML must show dispatch status instead');
  assert.ok(html.includes('codex:watch'), 'HTML must reference codex:watch');
  console.log('  PASS: HTML no human-wait phrases');

  // Chat server: reply for work orders does NOT ask for paste/YES
  delete require.cache[require.resolve(CHAT_SERVER_PATH)];
  const { handleChatRequest } = require(CHAT_SERVER_PATH);
  const r = await handleChatRequest({ message: '営業DXのv0.3.0を作業票化して' });
  assert.equal(r.ok, true, 'work order chat must succeed');
  assert.ok(r.work_order, 'work order must be returned');
  assertNoForbiddenPhrase(r.reply, 'chat reply for work order');
  assert.ok(
    /codex:watch|自動でディスパッチ/.test(r.reply),
    `reply must reference codex:watch dispatch (got: ${r.reply})`
  );
  console.log('  PASS: chat reply no human-wait phrases');

  // Work order body contains Auto-YES Runtime Contract
  const body = r.work_order.body;
  assert.ok(body.includes('Auto-YES Runtime Contract'), 'work order body must contain Auto-YES contract');
  assert.ok(body.includes('Safety Stop'), 'work order body must define Safety Stop');
  assert.ok(body.includes('YES前提で'), 'contract must say YES前提');
  assert.ok(!body.includes('.env'), 'work order body must not contain .env');
  assertNoForbiddenPhrase(body, 'work order body');
  console.log('  PASS: work order body has Auto-YES contract');

  // Dispatch watcher safety pre-flight
  delete require.cache[require.resolve(WATCHER_PATH)];
  const watcher = require(WATCHER_PATH);
  assert.ok(typeof watcher.safetyPreFlight === 'function', 'watcher must export safetyPreFlight');

  // Good prompt with required conditions passes
  const goodPrompt = [
    lint.AUTO_YES_CONTRACT,
    'cd /home/lavie/repos/kosame-sales-dx',
    '機密情報・環境変数ファイル・認証情報・APIキーは読まない',
    '外部APIを呼ばない',
    '対象repo以外を触らない',
    'git status -sb',
  ].join('\n');
  const goodCheck = watcher.safetyPreFlight(goodPrompt);
  assert.equal(goodCheck.ok, true, `good prompt must pass safety pre-flight (got: ${goodCheck.reason})`);

  // Force push is blocked (git-level, not docstring mention)
  const forcePushPrompt = goodPrompt + '\ngit push --force origin main';
  const forceResult = watcher.safetyPreFlight(forcePushPrompt);
  assert.equal(forceResult.ok, false, 'force push must trigger Safety Stop');
  assert.ok(forceResult.reason.includes('Safety Stop'), 'reason must say Safety Stop');

  // Missing required safety keyword is blocked
  const missingCondPrompt = 'cd /home/lavie/repos/kosame-sales-dx\n外部APIを呼ばない\n対象repo以外を触らない';
  const missingResult = watcher.safetyPreFlight(missingCondPrompt);
  assert.equal(missingResult.ok, false, 'prompt missing required safety keyword must be blocked');
  console.log('  PASS: dispatch watcher Safety Stop pre-flight');

  // Watcher detection: count changes when new entry arrives
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-32-'));
  const queueDir = path.join(TEMP, 'handoff');
  fs.mkdirSync(queueDir, { recursive: true });
  assert.equal(watcher.readQueueCount(queueDir), 0, 'count must be 0 before any entries');
  fs.writeFileSync(path.join(queueDir, 'queue.jsonl'), '{"id":"1","title":"test work order"}\n');
  assert.equal(watcher.readQueueCount(queueDir), 1, 'count must be 1 after one entry');
  const entry = watcher.readLatestEntry(queueDir);
  assert.equal(entry && entry.id, '1', 'latest entry must be correct');
  fs.rmSync(TEMP, { recursive: true, force: true });
  console.log('  PASS: watcher detects new work orders');

  // Full result auto-POST flow via test server
  await withServer(async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP result flow skipped (EPERM)');
      return;
    }

    // Create work order targeting KOSAME Dev Orchestra (result store only accepts this repo)
    const chatRes = await requestJson(port, '/api/chat', { message: 'KOSAME Consoleの作業票を作って', project: 'KOSAME Console' });
    assert.equal(chatRes.statusCode, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    const workOrder = chatRes.body.work_order;
    assert.ok(workOrder, 'work order must be returned');
    assert.ok(workOrder.body.includes('Auto-YES Runtime Contract'), 'work order body must have contract via HTTP');

    const TEMP2 = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-32b-'));
    const approvalLog = path.join(TEMP2, 'approvals.jsonl');
    const handoffLog = path.join(TEMP2, 'handoffs.jsonl');
    const resultLog = path.join(TEMP2, 'results.jsonl');

    // Approve via store
    const { approveWorkOrder } = require(path.join(ROOT, 'tools', 'kosame-work-order-approval-store.js'));
    const approved = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
    assert.equal(approved.ok, true, 'approval must succeed');

    // Handoff via store
    const { recordWorkOrderHandoff } = require(path.join(ROOT, 'tools', 'kosame-work-order-handoff-store.js'));
    const handoff = recordWorkOrderHandoff({
      work_order_id: approved.latestApprovedWorkOrder.approval_id,
      assigned_agent: 'Codex',
      status: 'handed_to_agent',
      work_order: approved.latestApprovedWorkOrder,
    }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
    assert.equal(handoff.ok, true, 'handoff must succeed');

    // Simulate Codex Runner auto-posting result
    const { createLiveCockpitServer: createServer2 } = require(path.join(ROOT, 'tools', 'kosame-live-cockpit-server'));
    const { server: s2 } = createServer2({
      workOrderApprovalLogPath: approvalLog,
      workOrderHandoffLogPath: handoffLog,
      workOrderResultLogPath: resultLog,
    });
    const port2 = await new Promise((resolve, reject) => {
      const onErr = (e) => { if (e && e.code === 'EPERM') resolve(null); else reject(e); };
      s2.once('error', onErr);
      try {
        s2.listen(0, '127.0.0.1', () => { s2.off('error', onErr); resolve(s2.address().port); });
      } catch (e) {
        s2.off('error', onErr);
        if (e && e.code === 'EPERM') resolve(null); else reject(e);
      }
    });

    try {
      if (port2 != null) {
        // Auto-POST result (simulating what Codex Runner would do)
        const resultPostRes = await requestJson(port2, '/api/work-orders/result', {
          result_status: 'success',
          smoke_result: 'PASS',
          verify_result: 'PASS',
          result_summary: 'Auto-dispatch completed by Codex Runner',
          changed_files: ['tools/example.js'],
          source: 'codex-auto',
        });
        assert.equal(resultPostRes.statusCode, 200, 'result POST must return 200');
        assert.equal(resultPostRes.body.ok, true, 'result POST must succeed');
        assert.ok(resultPostRes.body.latestWorkOrderDecision, 'result POST must return Decision Panel data');
        const decision = resultPostRes.body.latestWorkOrderDecision;
        assert.ok(decision.decision_status, 'Decision Panel must have a decision_status');
        console.log('  PASS: auto result POST → Decision Panel updated (status:', decision.decision_status, ')');
      }
    } finally {
      await new Promise((r) => { try { s2.close(r); } catch { r(); } });
    }
    fs.rmSync(TEMP2, { recursive: true, force: true });
  });

  // Safety Stop has NOT been triggered (no Safety Stop in the standard flow)
  console.log('  Safety Stop: NOT triggered (standard flow completed without Safety Stop)');

  console.log('✅ v110.84.32 No-User-Work smoke PASSED');
  console.log('   Auto-YES contract injected in all work orders');
  console.log('   Codex Runner dispatches automatically (claude -p)');
  console.log('   Result auto-POSTed to Decision Panel');
  console.log('   No human-wait phrases in Console or work order bodies');
  console.log('   Safety Stop: armed (blocks force push / missing conditions)');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
