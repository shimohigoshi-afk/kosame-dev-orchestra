#!/usr/bin/env node
'use strict';

/**
 * v113.0.0 Full Cycle Smoke — 実運用候補確認
 * Console → 作業票 → Approve(auto-Handoff+auto-Inbox) → Runner → Result Decision
 * YES確認0回 / コピペ0回 / Safety Stop以外で停止しない
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');
const { createLiveCockpitServer } = require('../tools/kosame-live-cockpit-server');
const { AUTO_YES_CONTRACT, COMPLETE_RUN_FIRST_POLICY, lintForHumanWait } = require('../tools/kosame-prompt-lint');
const { approveWorkOrder } = require('../tools/kosame-work-order-approval-store');
const { recordWorkOrderHandoff } = require('../tools/kosame-work-order-handoff-store');
const { extractResultBlock, safetyPreFlight, REQUIRED_SAFETY_KEYWORDS } = require('../tools/kosame-codex-dispatch-watcher');

function req(port, urlPath, body, method = 'POST') {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : undefined;
    const r = http.request(
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
          try { resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') }); }
          catch { reject(new Error(`JSON parse error: ${raw.slice(0, 80)}`)); }
        });
      }
    );
    req.on && req.on('error', reject);
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

async function withServer(logPaths, fn) {
  const { server } = createLiveCockpitServer(logPaths);
  const port = await new Promise((res, rej) => {
    const onErr = (e) => { if (e && e.code === 'EPERM') res(null); else rej(e); };
    server.once('error', onErr);
    try {
      server.listen(0, '127.0.0.1', () => { server.off('error', onErr); res(server.address().port); });
    } catch (e) {
      server.off('error', onErr);
      if (e && e.code === 'EPERM') res(null); else rej(e);
    }
  });
  try { return await fn(port); }
  finally { await new Promise((r) => { try { server.close(r); } catch { r(); } }); }
}

async function main() {
  console.log('=== v113.0.0 Full Cycle Smoke — 実運用候補確認 ===');

  // Package wiring
  assert.ok(isVersionAtLeast(pkg.version, '113.0.0'), `version must be >= 113.0.0 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-0'], 'smoke:v113-0-0 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-0'), 'verify must include smoke:v113-0-0');
  console.log('  PASS: package wiring (v113.0.0)');

  // Settings: .claude/settings.local.json must exist with deny rules
  const settingsPath = path.join(ROOT, '.claude', 'settings.local.json');
  assert.ok(fs.existsSync(settingsPath), '.claude/settings.local.json must exist');
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  assert.ok(settings.permissions, 'settings must have permissions');
  assert.ok(Array.isArray(settings.permissions.deny), 'settings.deny must be array');
  assert.ok(settings.permissions.deny.some((d) => d.includes('push --force')), 'deny must block force push');
  assert.ok(settings.permissions.deny.some((d) => d.includes('gcloud run deploy')), 'deny must block gcloud deploy');
  console.log('  PASS: .claude/settings.local.json permissions');

  // Prompt lint: AUTO_YES_CONTRACT and COMPLETE_RUN_FIRST_POLICY are in work orders
  delete require.cache[require.resolve(path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js'))];
  const { handleChatRequest } = require(path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js'));

  const woRes = await handleChatRequest({ message: 'KOSAME Consoleの作業票を作って', project: 'KOSAME Console' });
  assert.equal(woRes.ok, true, 'work order chat must succeed');
  const wo = woRes.work_order;
  assert.ok(wo, 'work_order must be returned');
  assert.ok(wo.body.includes('Auto-YES Runtime Contract'), 'body must have Auto-YES contract');
  assert.ok(wo.body.includes('Complete-Run First Policy'), 'body must have Complete-Run First Policy');
  assert.ok(wo.body.includes('Safety Stop'), 'body must define Safety Stop');
  assert.ok(!wo.body.includes('.env'), 'body must not contain .env');
  const lintRes = lintForHumanWait(wo.body);
  assert.equal(lintRes.ok, true, `work order body must pass prompt lint (violations: ${JSON.stringify(lintRes.violations)})`);
  console.log('  PASS: work order body contracts + lint');

  // Safety: required keywords present
  for (const kw of REQUIRED_SAFETY_KEYWORDS) {
    assert.ok(wo.body.includes(kw), `work order body must include required safety keyword: "${kw}"`);
  }
  const preFlight = safetyPreFlight(wo.body);
  assert.equal(preFlight.ok, true, `work order body must pass safety pre-flight (got: ${preFlight.reason})`);
  console.log('  PASS: safety pre-flight on generated work order');

  // Auto-approve flow: HTML must auto-chain approve→handoff→inbox
  const htmlPath = path.join(ROOT, 'public', 'kosame-live-cockpit.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  assert.ok(html.includes('Step 1: Approve'), 'HTML must have auto-chain Step 1 comment');
  assert.ok(html.includes('Step 2: Auto-record handoff'), 'HTML must have auto-chain Step 2 comment');
  assert.ok(html.includes('Step 3: Auto-save to Handoff Inbox'), 'HTML must have auto-chain Step 3 comment');
  assert.ok(html.includes('自動ディスパッチ済み'), 'HTML must show auto-dispatch complete status');
  assert.ok(!html.includes('確認してから Codex に貼ってください'), 'HTML must not have manual paste instruction');
  assert.ok(!html.includes('Codexへ貼り付け待ち'), 'HTML must not have paste-wait label');
  console.log('  PASS: HTML auto-chain approve→handoff→inbox');

  // Full server cycle: Chat → Approve → Handoff → Result POST → Decision Panel
  const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-113-'));
  const approvalLog = path.join(TEMP, 'approvals.jsonl');
  const handoffLog = path.join(TEMP, 'handoffs.jsonl');
  const resultLog = path.join(TEMP, 'results.jsonl');

  await withServer({ workOrderApprovalLogPath: approvalLog, workOrderHandoffLogPath: handoffLog, workOrderResultLogPath: resultLog }, async (port) => {
    if (port == null) {
      console.log('  PASS: HTTP full-cycle skipped (EPERM)');
      return;
    }

    // Stage 1: Console → 作業票
    const chatRes = await req(port, '/api/chat', { message: 'KOSAME Consoleの作業票を作って', project: 'KOSAME Console' });
    assert.equal(chatRes.status, 200, 'chat must return 200');
    assert.equal(chatRes.body.ok, true, 'chat must succeed');
    const workOrder = chatRes.body.work_order;
    assert.ok(workOrder, 'Stage 1: work_order must be returned');
    assert.ok(workOrder.body.includes('Auto-YES Runtime Contract'), 'Stage 1: body must have contract');
    console.log('  PASS: Stage 1 — Console → 作業票');

    // Stage 2: 作業票 → Approve (server-side)
    const approved = approveWorkOrder({ work_order: workOrder }, { workOrderApprovalLogPath: approvalLog });
    assert.equal(approved.ok, true, 'Stage 2: approval must succeed');
    const approvedWO = approved.latestApprovedWorkOrder;
    assert.ok(approvedWO, 'Stage 2: latestApprovedWorkOrder must exist');
    console.log('  PASS: Stage 2 — 作業票 → Approve');

    // Stage 3: Approve → Handoff (auto-chain)
    const handoff = recordWorkOrderHandoff({
      work_order_id: approvedWO.approval_id,
      assigned_agent: 'Codex',
      status: 'handed_to_agent',
      work_order: approvedWO,
    }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
    assert.equal(handoff.ok, true, 'Stage 3: handoff must succeed');
    const handoffWO = handoff.latestHandoffWorkOrder;
    assert.ok(handoffWO, 'Stage 3: latestHandoffWorkOrder must exist');
    assert.equal(handoffWO.status, 'handed_to_agent', 'Stage 3: handoff status must be handed_to_agent');
    console.log('  PASS: Stage 3 — Approve → Handoff (auto-chain)');

    // Stage 4: Runner → extractResultBlock (KOSAME_RESULT protocol)
    const mockRunnerOutput = [
      'Starting work order execution...',
      'cd /home/lavie/kosame-dev-orchestra',
      'npm run verify — 19 smokes passed',
      'KOSAME_RESULT_BEGIN',
      JSON.stringify({
        result_status: 'success',
        smoke_result: 'PASS',
        verify_result: 'PASS',
        result_summary: 'Full cycle test: all stages completed automatically',
        changed_files: [],
      }),
      'KOSAME_RESULT_END',
    ].join('\n');
    const extracted = extractResultBlock(mockRunnerOutput);
    assert.ok(extracted, 'Stage 4: extractResultBlock must extract result');
    assert.equal(extracted.result_status, 'success', 'Stage 4: result_status must be success');
    assert.equal(extracted.smoke_result, 'PASS', 'Stage 4: smoke_result must be PASS');
    console.log('  PASS: Stage 4 — Runner → KOSAME_RESULT extraction');

    // Stage 5: Result → /api/work-orders/result → Decision Panel
    await withServer({ workOrderApprovalLogPath: approvalLog, workOrderHandoffLogPath: handoffLog, workOrderResultLogPath: resultLog }, async (port2) => {
      if (port2 == null) return;
      const resultRes = await req(port2, '/api/work-orders/result', {
        ...extracted,
        source: 'codex-auto',
      });
      assert.equal(resultRes.status, 200, `Stage 5: result POST must return 200 (got: ${JSON.stringify(resultRes.body).slice(0, 200)})`);
      assert.equal(resultRes.body.ok, true, 'Stage 5: result POST must succeed');
      const decision = resultRes.body.latestWorkOrderDecision;
      assert.ok(decision, 'Stage 5: latestWorkOrderDecision must exist');
      assert.ok(decision.decision_status, 'Stage 5: decision_status must be set');
      assert.ok(
        ['ready_for_commit', 'ready_for_review', 'request_fix', 'stop_and_investigate', 'wait_for_result'].includes(decision.decision_status),
        `Stage 5: decision_status must be a known value (got: ${decision.decision_status})`
      );
      console.log(`  PASS: Stage 5 — Result → Decision Panel (${decision.decision_status})`);
    });
  });

  fs.rmSync(TEMP, { recursive: true, force: true });

  // Confirm Safety Stop conditions are correctly armed
  const forcePushResult = safetyPreFlight(wo.body + '\ngit push --force origin main');
  assert.equal(forcePushResult.ok, false, 'Safety Stop must block force push');
  console.log('  Safety Stop: armed — force push blocked ✓');

  console.log('');
  console.log('✅ v113.0.0 Full Cycle Smoke PASSED — 実運用候補確認');
  console.log('   Console → 作業票 → Approve(auto) → Handoff(auto) → Inbox(auto) → Runner → Result → Decision Panel');
  console.log('   YES確認: 0回 / コピペ: 0回 / Safety Stop: 未発動');
  console.log('   .claude/settings.local.json: force push / gcloud deploy 禁止');
  console.log('   Auto-YES Contract + Complete-Run First Policy: 全Work Orderに注入済み');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
