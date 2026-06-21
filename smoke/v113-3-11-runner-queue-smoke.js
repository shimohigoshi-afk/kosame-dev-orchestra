#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const os     = require('node:os');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const RUNNER_QUEUE_PATH = path.join(__dirname, '..', 'tools', 'kosame-runner-queue.js');

function freshRequire(p) {
  delete require.cache[require.resolve(p)];
  return require(p);
}

async function main() {
  console.log('=== v113.3.11 runner-queue smoke ===');

  // ── package wiring ──────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.11'), `version must be >= 113.3.11 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-11'], 'smoke:v113-3-11 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-11'), 'verify must include smoke:v113-3-11');
  console.log('  PASS: package wiring');

  // ── module exports ──────────────────────────────────────────────────────────
  assert.ok(fs.existsSync(RUNNER_QUEUE_PATH), 'tools/kosame-runner-queue.js must exist');
  const rq = freshRequire(RUNNER_QUEUE_PATH);
  assert.equal(typeof rq.processQueue,   'function', 'processQueue must be exported');
  assert.equal(typeof rq.processTicket,  'function', 'processTicket must be exported');
  assert.equal(typeof rq.runTicket,      'function', 'runTicket must be exported');
  assert.equal(typeof rq.formatInput,    'function', 'formatInput must be exported');
  assert.equal(typeof rq.defaultExecutor,'function', 'defaultExecutor must be exported');
  assert.equal(rq.MAX_ATTEMPTS, 3,  'MAX_ATTEMPTS must be 3');
  assert.ok(rq.RUNS_DIR,   'RUNS_DIR must be exported');
  assert.ok(rq.RUNNER_DIR, 'RUNNER_DIR must be exported');
  assert.ok(rq.STATE_FILE, 'STATE_FILE must be exported');
  assert.ok(rq.RUNS_DIR.endsWith(path.join('.kosame-runner', 'runs')), 'RUNS_DIR path must include .kosame-runner/runs');
  assert.ok(rq.STATE_FILE.endsWith('queue-state.json'), 'STATE_FILE must end with queue-state.json');
  console.log('  PASS: module exports');

  // ── formatInput ─────────────────────────────────────────────────────────────
  const ticket1 = {
    id: 'smoke-ticket-001', title: 'Smoke Work Order',
    assigned_agent: 'Codex', risk_level: 'low', human_gate_required: false,
    created_at: '2026-06-21T00:00:00.000Z', target_repo: '/tmp/test-repo',
    prompt_text: 'echo hello smoke test',
  };
  const inputMd = rq.formatInput(ticket1);
  assert.ok(inputMd.includes('smoke-ticket-001'),    'formatInput must include id');
  assert.ok(inputMd.includes('Smoke Work Order'),    'formatInput must include title');
  assert.ok(inputMd.includes('echo hello smoke test'),'formatInput must include prompt_text');
  assert.ok(inputMd.includes('## prompt_text'),       'formatInput must have prompt_text section');
  console.log('  PASS: formatInput shape');

  // ── runTicket success ── 4ファイル作成・result.json 構造 ──────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-runner-smoke-'));
  try {
    const successExec = (ticket, runDir) => {
      fs.writeFileSync(path.join(runDir, 'output.md'),  `output for ${ticket.id}`);
      fs.writeFileSync(path.join(runDir, 'verify.log'), 'verify: PASS');
      return { ok: true, exitCode: 0, error: null };
    };
    const r1 = rq.runTicket(ticket1, 1, { executor: successExec, runsDir: tmpDir });
    assert.equal(r1.status,    'completed',       'success executor → completed');
    assert.equal(r1.runId,     'smoke-ticket-001','runId must equal ticket.id');
    assert.equal(r1.ticketId,  'smoke-ticket-001','ticketId must be set');
    assert.ok(r1.startedAt,   'startedAt must be set');
    assert.ok(r1.completedAt, 'completedAt must be set');
    // 4ファイル確認
    const runDir1 = path.join(tmpDir, 'smoke-ticket-001');
    assert.ok(fs.existsSync(path.join(runDir1, 'input.md')),   'input.md must exist');
    assert.ok(fs.existsSync(path.join(runDir1, 'output.md')),  'output.md must exist');
    assert.ok(fs.existsSync(path.join(runDir1, 'verify.log')), 'verify.log must exist');
    assert.ok(fs.existsSync(path.join(runDir1, 'result.json')),'result.json must exist');
    // result.json 構造
    const rj = JSON.parse(fs.readFileSync(path.join(runDir1, 'result.json'), 'utf8'));
    assert.equal(rj.status,    'completed');
    assert.equal(rj.ticketId,  'smoke-ticket-001');
    assert.ok(rj.startedAt);
    assert.ok(rj.completedAt);
    assert.equal(typeof rj.attempts, 'number', 'attempts must be a number');
    console.log('  PASS: runTicket success — 4 log files created, result.json correct');

    // ── retry: 3回失敗 → blocked_by_test_failure ──────────────────────────
    const ticket2 = {
      id: 'smoke-ticket-002', title: 'Always Failing',
      assigned_agent: 'Codex', risk_level: 'low', human_gate_required: false,
      created_at: '2026-06-21T00:00:00.000Z', target_repo: '/tmp/test-repo',
      prompt_text: 'a task that always fails verify',
    };
    let execCallCount = 0;
    const failExec = (ticket, runDir) => {
      execCallCount++;
      fs.writeFileSync(path.join(runDir, 'output.md'),  `attempt ${execCallCount} FAIL`);
      fs.writeFileSync(path.join(runDir, 'verify.log'), `FAIL attempt=${execCallCount}`);
      return { ok: false, exitCode: 1, error: null };
    };
    const stateStore = {};
    const r2 = rq.processTicket(ticket2, { executor: failExec, runsDir: tmpDir, state: stateStore });
    assert.equal(r2.status,   'blocked_by_test_failure', '3 failures must yield blocked_by_test_failure');
    assert.equal(r2.attempts, 3,                         'attempts must be 3');
    assert.equal(execCallCount, 3,                       'executor called exactly 3 times');
    assert.equal(stateStore['smoke-ticket-002'].status, 'blocked_by_test_failure');
    assert.equal(stateStore['smoke-ticket-002'].attempts, 3);
    console.log('  PASS: retry logic — 3 failures → blocked_by_test_failure');

    // ── 既処理チケットはスキップ ─────────────────────────────────────────────
    execCallCount = 0;
    const completedState = { 'smoke-ticket-002': { status: 'completed', completedAt: '2026-06-21T00:00:00.000Z' } };
    const r3 = rq.processTicket(ticket2, { executor: failExec, runsDir: tmpDir, state: completedState });
    assert.equal(r3.status, 'completed', 'already-completed ticket must be returned as-is');
    assert.equal(execCallCount, 0, 'executor must not be called for already-completed ticket');
    console.log('  PASS: already-completed ticket skipped (no re-execution)');

    // blocked 済みもスキップ
    execCallCount = 0;
    const blockedState = { 'smoke-ticket-002': { status: 'blocked_by_test_failure', attempts: 3 } };
    const r4 = rq.processTicket(ticket2, { executor: failExec, runsDir: tmpDir, state: blockedState });
    assert.equal(r4.status, 'blocked_by_test_failure');
    assert.equal(execCallCount, 0, 'executor must not be called for already-blocked ticket');
    console.log('  PASS: already-blocked ticket skipped');

    // ── Safety Stop — 実行されず即停止 ─────────────────────────────────────
    const safetyTicket = {
      id: 'smoke-ticket-003', title: 'Dangerous Deploy',
      assigned_agent: 'Codex', risk_level: 'high', human_gate_required: false,
      created_at: '2026-06-21T00:00:00.000Z', target_repo: '/tmp/test-repo',
      prompt_text: 'gcloud run deploy my-service --set-secrets=API_KEY=projects/123/secrets/key:latest',
    };
    let safetyExecCalled = false;
    const safetyExec = () => { safetyExecCalled = true; return { ok: true }; };
    const r5 = rq.runTicket(safetyTicket, 1, { executor: safetyExec, runsDir: tmpDir });
    assert.equal(r5.status, 'safety_stop', 'production_deploy + secret must trigger safety_stop');
    assert.ok(!safetyExecCalled,           'executor must NOT be called on Safety Stop');
    assert.ok(r5.error,                    'safety_stop result must have error message');
    // ファイル確認
    const sRunDir = path.join(tmpDir, 'smoke-ticket-003');
    assert.ok(fs.existsSync(path.join(sRunDir, 'result.json')), 'result.json must exist for safety_stop');
    const srj = JSON.parse(fs.readFileSync(path.join(sRunDir, 'result.json'), 'utf8'));
    assert.equal(srj.status, 'safety_stop');
    console.log('  PASS: Safety Stop — executor not called, files written, status=safety_stop');

    // ── Safety Stop の processTicket は再試行なし ──────────────────────────
    safetyExecCalled = false;
    const sState = {};
    const r6 = rq.processTicket(safetyTicket, { executor: safetyExec, runsDir: tmpDir, state: sState });
    assert.equal(r6.status,  'safety_stop', 'processTicket Safety Stop must not retry');
    assert.ok(!safetyExecCalled,            'executor must remain uncalled');
    assert.equal(sState['smoke-ticket-003'].status, 'safety_stop');
    console.log('  PASS: Safety Stop — no retry in processTicket');

    // ── .gitignore に .kosame-runner/ があること ────────────────────────────
    const gitignore = fs.readFileSync(path.join(__dirname, '..', '.gitignore'), 'utf8');
    assert.ok(
      gitignore.split('\n').some(l => l.trim() === '.kosame-runner/'),
      '.kosame-runner/ must be in .gitignore'
    );
    console.log('  PASS: .kosame-runner/ in .gitignore');

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── regression ─────────────────────────────────────────────────────────────
  const { checkRuntimeContract } = require('../tools/kosame-runtime-contract');
  const { readHandoffQueue }     = require('../tools/kosame-codex-handoff-bridge-server');
  assert.equal(typeof checkRuntimeContract, 'function', 'checkRuntimeContract must still export');
  assert.equal(typeof readHandoffQueue,     'function', 'readHandoffQueue must still export');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.11 runner-queue smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && (error.message || error));
  process.exit(1);
});
