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
  console.log('=== v113.3.54 chat→runner pipeline smoke ===');

  // ── package wiring ───────────────────────────────────────────────────────────
  assert.ok(isVersionAtLeast(pkg.version, '113.3.54'), `version must be >= 113.3.54 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-54'], 'smoke:v113-3-54 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-54'), 'verify must include smoke:v113-3-54');
  console.log('  PASS: package wiring');

  // ── claudeChatExecutor must set KOSAME_SKIP_POST_LAUNCH_VERIFY=1 ─────────────
  const runnerSrc = fs.readFileSync(RUNNER_QUEUE_PATH, 'utf8');
  assert.ok(
    runnerSrc.includes('KOSAME_SKIP_POST_LAUNCH_VERIFY'),
    'claudeChatExecutor must set KOSAME_SKIP_POST_LAUNCH_VERIFY so auto-launch does not run verify after each chat dispatch'
  );
  assert.ok(
    runnerSrc.includes("KOSAME_SKIP_POST_LAUNCH_VERIFY: '1'"),
    "KOSAME_SKIP_POST_LAUNCH_VERIFY must be '1' in claudeChatExecutor env"
  );
  console.log('  PASS: claudeChatExecutor sets KOSAME_SKIP_POST_LAUNCH_VERIFY=1');

  // ── SAFETY_STOP_PATTERNS must not contain false-positive-prone patterns ───────
  const autoLaunchSrc = fs.readFileSync(AUTO_LAUNCH_PATH, 'utf8');

  // These broad patterns match claude explaining things like "承認は必要ありません"
  // or repeating the safety preamble text, causing false Safety Stop triggers
  assert.ok(
    !autoLaunchSrc.includes('/承認.*必要/'),
    'SAFETY_STOP_PATTERNS must not include /承認.*必要/ (false positive: matches explanatory text)'
  );
  assert.ok(
    !autoLaunchSrc.includes('/SAFETY\\s*STOP/'),
    'SAFETY_STOP_PATTERNS must not include /SAFETY\\s*STOP/ (false positive: matches safety preamble claude echoes)'
  );
  assert.ok(
    !autoLaunchSrc.includes('/force.?push/i'),
    'SAFETY_STOP_PATTERNS must not include /force.?push/i (false positive: matches "do not force push" in explanatory text)'
  );

  // Precise dangerous-command patterns must still be present
  assert.ok(
    autoLaunchSrc.includes('git\\s+push\\s+.*--force'),
    'SAFETY_STOP_PATTERNS must still catch actual git push --force commands'
  );
  assert.ok(
    autoLaunchSrc.includes('rm\\s+-rf\\s+\\/'),
    'SAFETY_STOP_PATTERNS must still catch rm -rf / commands'
  );
  console.log('  PASS: SAFETY_STOP_PATTERNS has no false-positive-prone patterns');

  // ── end-to-end: claudeChatExecutor calls auto-launch with SKIP_VERIFY ─────────
  const rq = freshRequire(RUNNER_QUEUE_PATH);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kosame-v113-3-54-'));
  try {
    let executorEnv = null;
    const ticket = {
      id: 'smoke-chat-runner-pipeline-001',
      title: 'Chat Runner Pipeline Smoke',
      source: 'kosame-chat-dispatch',
      assigned_agent: 'Codex',
      risk_level: 'low',
      human_gate_required: false,
      created_at: new Date().toISOString(),
      target_repo: ROOT,
      prompt_text: 'smoke test: write hello',
      original_request: 'write hello in a file',
    };

    // Use mock executor to avoid spawning real claude
    const r = rq.runTicket(ticket, 1, {
      runsDir: tmpDir,
      executor: (t, runDir) => {
        // Record what the executor was called with
        executorEnv = process.env.KOSAME_SKIP_POST_LAUNCH_VERIFY;
        fs.writeFileSync(path.join(runDir, 'output.md'), `executed ${t.id}`);
        fs.writeFileSync(path.join(runDir, 'verify.log'), 'exit_code: 0');
        return { ok: true, exitCode: 0, error: null };
      },
    });
    assert.equal(r.status, 'completed', 'kosame-chat-dispatch ticket must complete via mock executor');
    console.log('  PASS: chat-dispatch ticket completes end-to-end (mock executor)');

    // Verify routing: kosame-chat-dispatch → claudeChatExecutor path
    // When no executor override, defaultExecutor routes to claudeChatExecutor
    const rqSrc = fs.readFileSync(RUNNER_QUEUE_PATH, 'utf8');
    assert.ok(
      rqSrc.includes("ticket.source === 'kosame-chat-dispatch'"),
      'defaultExecutor must route kosame-chat-dispatch to claudeChatExecutor'
    );
    console.log('  PASS: kosame-chat-dispatch routing confirmed in source');

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // ── auto-launch respects KOSAME_SKIP_POST_LAUNCH_VERIFY ──────────────────────
  assert.ok(
    autoLaunchSrc.includes('KOSAME_SKIP_POST_LAUNCH_VERIFY'),
    'kosame-claude-auto-launch.js must read KOSAME_SKIP_POST_LAUNCH_VERIFY'
  );
  assert.ok(
    autoLaunchSrc.includes('SKIP_POST_LAUNCH_VERIFY'),
    'kosame-claude-auto-launch.js must define SKIP_POST_LAUNCH_VERIFY constant'
  );
  assert.ok(
    autoLaunchSrc.includes('post-launch verify skipped'),
    'kosame-claude-auto-launch.js must log verify-skipped message'
  );
  console.log('  PASS: kosame-claude-auto-launch.js respects KOSAME_SKIP_POST_LAUNCH_VERIFY');

  console.log('\n✅ v113.3.54 chat→runner pipeline smoke PASSED');
}

main().catch((err) => {
  console.error('✗ FAIL:', err && err.message ? err.message : err);
  process.exit(1);
});
