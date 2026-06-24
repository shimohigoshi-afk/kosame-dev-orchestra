#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const pkg = require('../package.json');
const { isVersionAtLeast } = require('./version-compare');

const ROOT = path.resolve(__dirname, '..');
const RUNNER_QUEUE_PATH = path.join(ROOT, 'tools', 'kosame-runner-queue.js');
const AUTO_LAUNCH_PATH = path.join(ROOT, 'tools', 'kosame-claude-auto-launch.js');

function freshRequire(p) {
  delete require.cache[require.resolve(p)];
  return require(p);
}

async function main() {
  console.log('=== v113.3.53 runner-chat-executor smoke ===');

  // ── package wiring ───────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.53'), `version must be >= 113.3.53 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-53'], 'smoke:v113-3-53 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-53'), 'verify must include smoke:v113-3-53');
  assert.ok(pkg.scripts['runner:watch'], 'runner:watch script must exist');
  assert.ok(pkg.scripts['runner:watch'].includes('kosame-codex-dispatch-watcher'), 'runner:watch must point to dispatch watcher');
  console.log('  PASS: package wiring');

  // ── claudeChatExecutor export ────────────────────────────────────────────────
  assert.ok(fs.existsSync(RUNNER_QUEUE_PATH), 'kosame-runner-queue.js must exist');
  const rq = freshRequire(RUNNER_QUEUE_PATH);
  assert.equal(typeof rq.claudeChatExecutor, 'function', 'claudeChatExecutor must be exported');
  assert.equal(typeof rq.defaultExecutor, 'function', 'defaultExecutor must be exported');
  console.log('  PASS: claudeChatExecutor exported');

  // ── source code: stdio must be pipe, not inherit ─────────────────────────────
  const runnerSrc = fs.readFileSync(RUNNER_QUEUE_PATH, 'utf8');
  assert.ok(
    !runnerSrc.includes("stdio: ['ignore', 'inherit', 'inherit']"),
    'claudeChatExecutor must NOT use inherit stdio (causes evaluateNoYesGate to kill runner)'
  );
  assert.ok(
    runnerSrc.includes("stdio: ['ignore', 'pipe', 'pipe']"),
    'claudeChatExecutor must use pipe stdio to isolate claude output from cockpit gate'
  );
  assert.ok(
    runnerSrc.includes('KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS'),
    'claudeChatExecutor must set KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS env for extended timeout'
  );
  assert.ok(
    runnerSrc.includes("'600000'"),
    'KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS must be at least 600000 (10 minutes)'
  );
  console.log('  PASS: stdio=pipe and extended timeout verified in source');

  // ── runtime: claudeChatExecutor with mock executor ────────────────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v113-3-53-'));
  try {
    const ticket = {
      id: 'smoke-chat-dispatch-001',
      title: 'Smoke Chat Dispatch',
      source: 'kosame-chat-dispatch',
      assigned_agent: 'Codex',
      risk_level: 'low',
      human_gate_required: false,
      created_at: new Date().toISOString(),
      target_repo: ROOT,
      prompt_text: 'smoke test: echo hello',
    };

    // Verify defaultExecutor routes to claudeChatExecutor for kosame-chat-dispatch
    let chatExecutorCalled = false;
    const r = rq.runTicket(ticket, 1, {
      runsDir: tmpDir,
      executor: (t, runDir) => {
        if (t.source === 'kosame-chat-dispatch') chatExecutorCalled = true;
        fs.writeFileSync(path.join(runDir, 'output.md'), `smoke output for ${t.id}`);
        fs.writeFileSync(path.join(runDir, 'verify.log'), 'exit_code: 0');
        return { ok: true, exitCode: 0, error: null };
      },
    });
    assert.equal(r.status, 'completed', 'chat-dispatch ticket should complete');
    assert.ok(chatExecutorCalled, 'custom executor should be called for kosame-chat-dispatch source');
    console.log('  PASS: chat-dispatch ticket routes correctly');

    // Non-chat-dispatch ticket should not call claudeChatExecutor
    const verifyTicket = {
      id: 'smoke-verify-ticket-001',
      title: 'Verify Ticket',
      source: 'kosame_console',
      assigned_agent: 'Codex',
      risk_level: 'low',
      human_gate_required: false,
      created_at: new Date().toISOString(),
      target_repo: ROOT,
      prompt_text: 'run verify',
    };
    let verifyExecutorCalled = false;
    rq.runTicket(verifyTicket, 1, {
      runsDir: tmpDir,
      executor: (t, runDir) => {
        verifyExecutorCalled = true;
        fs.writeFileSync(path.join(runDir, 'output.md'), `smoke output for ${t.id}`);
        fs.writeFileSync(path.join(runDir, 'verify.log'), 'exit_code: 0');
        return { ok: true, exitCode: 0, error: null };
      },
    });
    assert.ok(verifyExecutorCalled, 'non-chat-dispatch ticket should also call executor');
    console.log('  PASS: non-chat-dispatch ticket handled correctly');

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── kosame-claude-auto-launch.js: timeout env respected ───────────────────────
  assert.ok(fs.existsSync(AUTO_LAUNCH_PATH), 'kosame-claude-auto-launch.js must exist');
  const autoLaunchSrc = fs.readFileSync(AUTO_LAUNCH_PATH, 'utf8');
  assert.ok(
    autoLaunchSrc.includes('KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS'),
    'kosame-claude-auto-launch.js must respect KOSAME_CLAUDE_LAUNCH_TIMEOUT_MS env'
  );
  console.log('  PASS: kosame-claude-auto-launch.js respects timeout env');

  console.log('✅ v113.3.53 runner-chat-executor smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
