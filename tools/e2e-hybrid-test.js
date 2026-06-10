#!/usr/bin/env node
'use strict';

/**
 * KOSAME v110.45 Hybrid E2E Test
 *
 * Verifies the full WSL → auto-dev → relay → dashboard flow.
 *
 * CI-safe: skips auto-dev execution when Claude CLI or KOSAME_API_KEY not available.
 * Set CI=true or E2E_SKIP_AUTO_DEV=true to run only the API-level smoke checks.
 *
 * Usage:
 *   KOSAME_API_KEY=test-key node tools/e2e-hybrid-test.js
 *   # or via npm:
 *   npm run e2e:hybrid
 */

const http = require('node:http');
const path = require('node:path');
const fs   = require('node:fs');
const os   = require('node:os');
const { spawn } = require('node:child_process');

const ROOT     = path.resolve(__dirname, '..');
const SPEC_DIR = path.join(os.tmpdir(), 'kosame-e2e-specs');
const QUEUE_FILE = path.join(os.homedir(), '.kosame', 'activity-relay-queue.jsonl');

const CI_MODE          = !!(process.env.CI || process.env.E2E_SKIP_AUTO_DEV);
const HAS_CLAUDE_CLI   = (() => { try { return require('child_process').execSync('claude --version', { stdio: 'pipe', timeout: 5000 }).toString().includes('Claude Code'); } catch { return false; } })();

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); pass++; }
  else       { console.error(`  FAIL: ${label}`); fail++; }
}

function httpGet(port, urlPath, headers = {}) {
  return new Promise((resolve) => {
    const opts = { hostname: 'localhost', port, path: urlPath, method: 'GET', headers };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', () => resolve({ status: 0, body: '' }));
    req.end();
  });
}

async function main() {
  const API_KEY = process.env.KOSAME_API_KEY || 'e2e-test-key';
  process.env.KOSAME_API_KEY = API_KEY;

  // ── 1. Create disposable spec ──────────────────────────────────────────
  if (!fs.existsSync(SPEC_DIR)) fs.mkdirSync(SPEC_DIR, { recursive: true });
  const specFile = path.join(SPEC_DIR, `e2e-spec-${Date.now()}.md`);
  fs.writeFileSync(specFile, `
# E2E Test Spec (disposable, dryRun)

## Task
Add a single-line comment "// KOSAME E2E test" to README.md in the kosame-dev-orchestra repo.

## Constraints
- dryRun: true (do not write files)
- difficulty: light
- No commit, no push, no deploy
`, 'utf-8');
  console.log(`  Spec: ${specFile}`);

  // ── 2. Start dashboard server ──────────────────────────────────────────
  const { startServer } = require('./kosame-dashboard-server');
  const dashboard = startServer(0, { dryRun: true });
  const PORT = dashboard.address().port;
  console.log(`  Dashboard: http://localhost:${PORT}`);

  // ── 3. Clean queue file ────────────────────────────────────────────────
  try { fs.unlinkSync(QUEUE_FILE); } catch (_) {}

  // ── 4. Start relay ─────────────────────────────────────────────────────
  process.env.KOSAME_CLOUD_RUN_URL = `http://localhost:${PORT}`;
  const relayMod = require('./kosame-activity-relay');
  const relay = relayMod.start();

  // ── 5. Start auto-dev (skip in CI if no Claude CLI) ──────────────────
  if (CI_MODE && !HAS_CLAUDE_CLI) {
    console.log('  CI mode: skipping auto-dev execution');
    // Still verify API-level smoke by running the v110.45 hybrid smoke
    require(path.resolve(ROOT, 'smoke/v110-45-hybrid-smoke.js'));
    cleanup();
    process.exit(0);
  }

  console.log('  Starting auto-dev (dryRun)...');
  const child = spawn('node', ['tools/kosame-auto-dev.js', `--file=${specFile}`, '--json', '--project=kosame-dev-orchestra'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CLAUDE_TIMEOUT_MS: '180000' },
  });

  let stdoutBuf = '';
  let stderrBuf = '';
  child.stdout.on('data', d => { stdoutBuf += d.toString(); });
  child.stderr.on('data', d => { stderrBuf += d.toString(); });

  // ── 6. Poll for events while auto-dev runs ─────────────────────────────
  async function pollForEvents(timeoutMs = 150000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const state = await httpGet(PORT, '/api/state');
      if (state.status === 200) {
        try {
          const s = JSON.parse(state.body);
          if (s.relay && s.relay.eventCount > 0) {
            console.log(`  Events received: ${s.relay.eventCount} (last: ${s.relay.lastEventType || ''})`);
            if (s.relay.eventCount >= 3) return s;
          }
        } catch (_) {}
      }
      await new Promise(r => setTimeout(r, 1500));
    }
    return null;
  }

  // ── 7. Wait for auto-dev to complete (with parallel polling) ───────────
  const [exitCode, state] = await Promise.all([
    new Promise((resolve) => child.on('exit', (code) => resolve(code))),
    pollForEvents(),
  ]);

  console.log(`  auto-dev exited with code ${exitCode}`);

  // ── 8. Give relay time to flush remaining events ───────────────────────
  await new Promise(r => setTimeout(r, 2000));

  // ── 9. Verifications ──────────────────────────────────────────────────

  ok('auto-dev exit code 0', exitCode === 0);

  const health = await httpGet(PORT, '/health');
  ok('dashboard /health 200', health.status === 200);

  const stateResp = await httpGet(PORT, '/api/state');
  let sbody = null;
  try { sbody = JSON.parse(stateResp.body); } catch (_) {}
  ok('dashboard /api/state 200', stateResp.status === 200);
  ok('dashboard /api/state has relay field', sbody && typeof sbody.relay === 'object');

  const devStatus = await httpGet(PORT, '/api/dev/status', { 'X-API-Key': API_KEY });
  let dsBody = null;
  try { dsBody = JSON.parse(devStatus.body); } catch (_) {}
  ok('dashboard /api/dev/status with auth 200', devStatus.status === 200);
  ok('dashboard /api/dev/status has relay', dsBody && typeof dsBody.relay === 'object');
  ok('dashboard /api/dev/status relay.eventCount > 0', dsBody && dsBody.relay.eventCount > 0);

  const activity = await httpGet(PORT, '/api/activity');
  let abody = null;
  try { abody = JSON.parse(activity.body); } catch (_) {}
  ok('dashboard /api/activity returns array', Array.isArray(abody));
  ok('dashboard /api/activity has events', abody && abody.length >= 1);

  const taskId = abody && abody.length > 0 ? abody[0].taskId : null;
  if (taskId) {
    console.log(`  taskId: ${taskId}`);
    const tsResp = await httpGet(PORT, `/api/dev/status/${taskId}`, { 'X-API-Key': API_KEY });
    let tsBody = null;
    try { tsBody = JSON.parse(tsResp.body); } catch (_) {}
    ok(`dashboard /api/dev/status/${taskId} 200`, tsResp.status === 200);
    ok('dashboard task status has taskId', tsBody && tsBody.taskId === taskId);
    ok('dashboard task status has state', tsBody && tsBody.state && tsBody.state.eventType);
  }

  const logFile = path.join(os.homedir(), '.kosame', 'activity-events.jsonl');
  ok('activity-events.jsonl exists', fs.existsSync(logFile));
  ok('activity-events.jsonl has content', fs.statSync(logFile).size > 0);

  const queueExists = fs.existsSync(QUEUE_FILE);
  if (queueExists) {
    const qc = fs.readFileSync(QUEUE_FILE, 'utf-8').trim();
    ok('relay queue file empty after success', qc.length === 0);
  } else {
    ok('relay queue file clean (all sent)', true);
  }

  const combined = (stdoutBuf + ' ' + stderrBuf).toLowerCase();
  ok('no API key leaked in output', !combined.includes(API_KEY.slice(0, 8)));

  cleanup();
}

function cleanup() {
  try { relay.stop(); } catch (_) {}
  try { dashboard.close(); } catch (_) {}
  try { fs.unlinkSync(specFile); } catch (_) {}
  try { fs.unlinkSync(QUEUE_FILE); } catch (_) {}
  console.log('');
  if (fail === 0) {
    console.log(`✅ E2E hybrid test PASSED (${pass} checks)`);
    process.exit(0);
  } else {
    console.error(`❌ E2E hybrid test FAILED (pass=${pass} fail=${fail})`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
});
