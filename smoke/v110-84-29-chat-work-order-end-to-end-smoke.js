#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');
const CHAT_SERVER_PATH = path.join(ROOT, 'tools', 'kosame-cockpit-chat-server.js');
const SNAPSHOT_PATH = path.join(ROOT, 'tools', 'kosame-live-cockpit-snapshot.js');

async function main() {
  console.log('=== v110.84.29 chat work order end-to-end smoke ===');
  assert.ok(pkg.scripts['smoke:v110-84-29'], 'smoke:v110-84-29 must exist');
  assert.ok(pkg.scripts.verify.includes('npm run smoke:v110-84-29'), 'verify must include smoke:v110-84-29');
  assert.ok(isVersionAtLeast(pkg.version, '110.84.29'), `package version must be 110.84.29-compatible (got ${pkg.version})`);
  console.log('  PASS: package wiring');

  // Source wiring checks
  const chatSource = fs.readFileSync(CHAT_SERVER_PATH, 'utf8');
  assert.ok(chatSource.includes('作業票化'), 'chat server must detect 作業票化 intent');
  assert.ok(chatSource.includes('WORK_ORDER_TARGETS'), 'chat server must use WORK_ORDER_TARGETS for message-based resolution');
  assert.ok(chatSource.match(/for.*WORK_ORDER_TARGETS.*hints\.test/s), 'resolveWorkOrderTarget must iterate WORK_ORDER_TARGETS');
  assert.ok(!chatSource.match(/for.*LEGACY_WORK_ORDER_TARGETS.*hints\.test/s), 'resolveWorkOrderTarget must not fall back to LEGACY_WORK_ORDER_TARGETS');
  assert.ok(!chatSource.includes('truncate(input.message, 80)'), 'chat server must not truncate before work order intent detection');
  assert.ok(chatSource.includes('機密情報・環境変数ファイル・認証情報・APIキーは読まない'), 'safety condition must use Japanese-only terms');
  assert.ok(!chatSource.includes("'- Secret/.env"), 'safety condition must not use English .env literal');
  console.log('  PASS: chat server source wiring');

  const snapshotSource = fs.readFileSync(SNAPSHOT_PATH, 'utf8');
  assert.ok(snapshotSource.includes("ai: 'connected'"), 'snapshot must mark local chat AI as connected');
  assert.ok(!snapshotSource.includes('OPENAI_API_KEY ? \'connected\''), 'snapshot must not gate ai status on OPENAI_API_KEY');
  console.log('  PASS: snapshot AI status wiring');

  // Runtime checks
  delete require.cache[require.resolve(CHAT_SERVER_PATH)];
  const { handleChatRequest, detectWorkOrderIntent, resolveWorkOrderTarget } = require(CHAT_SERVER_PATH);

  // 作業票化 intent detection
  assert.equal(detectWorkOrderIntent('営業DXのv0.3.0を作業票化して'), true, '作業票化 must be detected as work order intent');
  assert.equal(detectWorkOrderIntent('作業票化してください'), true, '作業票化して must be detected');
  assert.equal(detectWorkOrderIntent('営業DXの作業票を作って'), true, 'traditional pattern must still work');
  const exactRequest = 'Codex結果を貼り戻した時に、通常チャット応答ではなく、Result Decision Panelの判定ステータスが実際に更新されるようにする作業票を作業票化して';
  assert.equal(detectWorkOrderIntent(exactRequest), true, 'exact result-paste request must be detected as work order intent');

  // Target resolution uses new repo (not transcriber)
  const salesTarget = resolveWorkOrderTarget({ message: '営業DXのv0.3.0を作業票化して' });
  assert.ok(salesTarget, 'Sales DX target must be resolved');
  assert.equal(salesTarget.repo, '/home/lavie/repos/kosame-sales-dx', 'Sales DX must resolve to kosame-sales-dx, not transcriber');
  assert.notEqual(salesTarget.repo, '/home/lavie/repos/transcriber', 'must NOT route to transcriber');

  // End-to-end: chat message → work_order
  const r = await handleChatRequest({ message: '営業DXのv0.3.0を作業票化して' });
  assert.equal(r.ok, true, 'chat must respond ok');
  assert.ok(r.work_order, 'work_order must be included in response');
  assert.equal(r.work_order.target_repo, '/home/lavie/repos/kosame-sales-dx', 'work order must target kosame-sales-dx');
  assert.ok(r.work_order.body.includes('cd /home/lavie/repos/kosame-sales-dx'), 'work order body must cd to kosame-sales-dx');
  assert.ok(r.work_order.body.includes('機密情報・環境変数ファイル・認証情報・APIキーは読まない'), 'work order body must include Japanese safety condition');
  assert.ok(!r.work_order.body.includes('.env'), 'work order body must not contain .env literal');
  assert.ok(!r.work_order.body.match(/\bsecret\b/i), 'work order body must not contain English secret');
  assert.ok(!r.work_order.body.match(/\bcredentials?\b/i), 'work order body must not contain English credentials');
  assert.equal(r.human_gate_required, true, 'human gate must be required');
  console.log('  PASS: chat → work order end-to-end (target:', r.work_order.target_repo, ')');

  const exactReply = await handleChatRequest({
    message: exactRequest,
    project: 'KOSAME Console',
  });
  assert.equal(exactReply.ok, true, 'exact request chat must respond ok');
  assert.ok(exactReply.work_order, 'exact request must create a work order draft');
  assert.equal(exactReply.work_order.agent, 'Codex', 'exact request work order agent must be Codex');
  assert.equal(exactReply.work_order.target_repo, '/home/lavie/kosame-dev-orchestra', 'exact request work order must target KOSAME Dev Orchestra');
  assert.ok(exactReply.work_order.originalRequest.includes('作業票化して'), 'originalRequest must preserve the request text');
  assert.ok(exactReply.work_order.body.includes('作業票化して'), 'body must preserve the request text');
  assert.ok(!/短く整理して返しますね/.test(exactReply.reply), 'exact request must not fall back to general chat');
  console.log('  PASS: exact work order request generates KOSAME Dev Orchestra draft');

  // Title is clean (no trailing particles or doubled version)
  assert.ok(r.work_order.title === 'v0.3.0' || /v0\.3\.0/.test(r.work_order.title), `title must contain version (got: ${r.work_order.title})`);
  assert.ok(!r.work_order.title.includes('作業票化して'), 'title must not include trailing 作業票化して');
  console.log('  PASS: work order title clean (got:', r.work_order.title, ')');

  // Approval: work order must pass approval without secret errors
  const { approveWorkOrder } = require(path.join(ROOT, 'tools', 'kosame-work-order-approval-store.js'));
  const TEMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-e2e-'));
  const approvalLog = path.join(TEMP_ROOT, 'approvals.jsonl');
  const approved = approveWorkOrder({ work_order: r.work_order }, { workOrderApprovalLogPath: approvalLog });
  assert.equal(approved.ok, true, 'work order approval must succeed');
  assert.equal(approved.approval.target_repo, '/home/lavie/repos/kosame-sales-dx', 'approved target must be kosame-sales-dx');
  console.log('  PASS: work order approval');

  // Handoff: approved work order → handoff queue, no .env in log
  const { recordWorkOrderHandoff } = require(path.join(ROOT, 'tools', 'kosame-work-order-handoff-store.js'));
  const handoffLog = path.join(TEMP_ROOT, 'handoffs.jsonl');
  const handoff = recordWorkOrderHandoff({
    work_order_id: approved.latestApprovedWorkOrder.approval_id,
    assigned_agent: 'Codex',
    status: 'handed_to_agent',
    work_order: approved.latestApprovedWorkOrder,
  }, { workOrderHandoffLogPath: handoffLog, workOrderApprovalLogPath: approvalLog });
  assert.equal(handoff.ok, true, 'handoff must succeed');
  const handoffLogText = fs.readFileSync(handoffLog, 'utf8');
  assert.ok(!handoffLogText.includes('.env'), 'handoff log must not contain .env literal');
  assert.ok(!handoffLogText.match(/\bsecret\b/i), 'handoff log must not contain English secret');
  console.log('  PASS: handoff → activity log safety');

  // Snapshot: ai status is 'connected' without OPENAI_API_KEY
  const savedKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete require.cache[require.resolve(SNAPSHOT_PATH)];
  const snap = require(SNAPSHOT_PATH).collectLiveCockpitSnapshot({ taskVaultDir: TEMP_ROOT, workOrderApprovalLogPath: approvalLog });
  assert.equal(snap.chatStatus.ai, 'connected', 'chat AI badge must show connected without OPENAI_API_KEY');
  if (typeof savedKey === 'string') process.env.OPENAI_API_KEY = savedKey;
  console.log('  PASS: snapshot chatStatus.ai = connected');

  console.log('✅ v110.84.29 chat work order end-to-end smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
