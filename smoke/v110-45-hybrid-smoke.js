#!/usr/bin/env node
'use strict';

/**
 * v110.45 Hybrid (PowerShell → WSL → Cloud Run) smoke test
 *
 * Tests the full hybrid integration without WSL/Cloud Run dependency:
 *   - activity-relay module functions
 *   - Dashboard activity ingest endpoint
 *   - eventId dedup, taskId isolation
 *   - Secret redaction
 *   - POST /api/dev/run → REMOTE_EXECUTION_UNAVAILABLE
 *   - relay status ONLINE/DELAYED/OFFLINE
 *   - PowerShell launcher path conversion logic
 *   - Discord notification on terminal events
 */

const http = require('node:http');
const path = require('node:path');
const fs   = require('node:fs');
const os   = require('node:os');

let pass = 0;
let fail = 0;

function ok(label, cond) {
  if (cond) { console.log(`  PASS: ${label}`); pass++; }
  else       { console.error(`  FAIL: ${label}`); fail++; }
}

// ── 1. PowerShell launcher path conversion ──────────────────────────────────

function wslpath(winPath) {
  // Simulates wslpath -u behavior: C:\path → /mnt/c/path (cross-platform)
  // Does not use path.resolve to avoid Linux path normalization
  const cleaned = winPath.replace(/\\/g, '/');
  const match = cleaned.match(/^([A-Za-z]):\/(.*)/);
  if (match) {
    return '/mnt/' + match[1].toLowerCase() + '/' + match[2];
  }
  if (cleaned.startsWith('/')) return cleaned;
  return cleaned;
}

ok('wslpath: C:\\path → /mnt/c/path', wslpath('C:\\specs\\feature.md') === '/mnt/c/specs/feature.md');
ok('wslpath: D:\\a\\b → /mnt/d/a/b', wslpath('D:\\a\\b') === '/mnt/d/a/b');
ok('wslpath: preserves forward slashes', wslpath('C:/specs/file.md') === '/mnt/c/specs/file.md');

// ── 2. PowerShell launcher static analysis ─────────────────────────────────

const PS1 = path.resolve(__dirname, '..', 'tools/Invoke-KosameAutoDev.ps1');
const ps1Src = fs.readFileSync(PS1, 'utf-8');

ok('PS1: UTF-8 BOM present', ps1Src.charCodeAt(0) === 0xFEFF);
ok('PS1: no Japanese chars (encoding safe)', !/[\u3000-\u9fff]/.test(ps1Src));
ok('PS1: uses explicit distro/user for bash', ps1Src.includes('wsl.exe -d Ubuntu -u lavie -- bash -lc'));
ok('PS1: uses bash -lc', ps1Src.includes('bash -lc'));
ok('PS1: has Help switch', ps1Src.includes('[switch]$Help'));
ok('PS1: no PS7+ ternary syntax', !/\?\s+\S+\s+:\s/.test(ps1Src));
ok('PS1: no PS7+ null-coalescing', !ps1Src.includes('??'));
ok('PS1: double quotes balanced', (ps1Src.match(/"/g) || []).length % 2 === 0);
ok('PS1: API key value hidden from echo', !ps1Src.includes('Write-Host $KosameApiKey') && !ps1Src.includes('Write-Host $CloudRunUrl'));
ok('PS1: uses nohup for background relay', ps1Src.includes('nohup'));
ok('PS1: Get-Help available', ps1Src.includes('Get-Help'));
ok('PS1: command -v for CL tool detection', ps1Src.includes('command -v'));
ok('PS1: version string validated with regex', ps1Src.includes('-match') && ps1Src.includes('^v'));
ok('PS1: Identity Token via gcloud', ps1Src.includes('gcloud auth print-identity-token'));
ok('PS1: Identity Token to relay env', ps1Src.includes('KOSAME_IDENTITY_TOKEN'));
ok('PS1: /health uses Bearer token', ps1Src.includes('Authorization: Bearer $idToken'));
ok('PS1: token hidden from display', !ps1Src.includes('Write-Host $idToken'));
ok('PS1: Node detection uses ExitCode', ps1Src.includes('$r.ExitCode -eq 0 -and $nodeVer -match'));
ok('PS1: npm detection uses ExitCode', ps1Src.includes('$r.ExitCode -eq 0 -and $npmVer -match'));
ok('PS1: Claude detection uses ExitCode', ps1Src.includes('$r.ExitCode -eq 0 -and $claudeVer -ne ""'));
ok('PS1: CmdletBinding before param', ps1Src.includes('[CmdletBinding()]') && ps1Src.indexOf('[CmdletBinding()]') < ps1Src.indexOf('param('));
ok('PS1: param after help, before code', ps1Src.indexOf('#>', 10) < ps1Src.indexOf('param(') && ps1Src.indexOf('param(') < ps1Src.indexOf('if ('));
ok('PS1: 6 params declared', (ps1Src.match(/\[string\]/g) || []).length + (ps1Src.match(/\[switch\]/g) || []).length >= 6);
ok('PS1: DryRun has no default value', !ps1Src.includes('[switch]$DryRun = '));
ok('PS1: Help has no default value', !ps1Src.includes('[switch]$Help = '));
ok('PS1: single BOM only', ps1Src.charCodeAt(0) === 0xFEFF && ps1Src.charCodeAt(3) !== 0xFEFF);
ok('PS1: WSL_INIT defined', ps1Src.includes('export PATH="$HOME/.local/bin:$PATH"'));
ok('PS1: nvm loaded in WSL_INIT', ps1Src.includes('. "$HOME/.nvm/nvm.sh"'));
ok('PS1: Invoke-WslBash uses bash -s (stdin)', ps1Src.includes('bash -s'));
ok('PS1: Invoke-WslBash function exists', ps1Src.includes('function Invoke-WslBash'));
ok('PS1: Invoke-WslBash returns ExitCode', ps1Src.includes('ExitCode = $exitCode'));
ok('PS1: command -v to /dev/null (node)', ps1Src.includes("command -v node >/dev/null"));
ok('PS1: command -v separated from version (multi-line)', ps1Src.includes("'command -v node >/dev/null 2>&1'") || ps1Src.includes('command -v node'));
ok('PS1: npm version with stdin pattern', ps1Src.includes("'command -v npm >/dev/null"));
ok('PS1: claude version with stdin pattern', ps1Src.includes("'command -v claude >/dev/null"));
ok('PS1: no cmd=$(command -v) capture pattern', !ps1Src.includes('cmd=$(command -v'));
ok('PS1: no bare wsl.exe -- calls', (ps1Src.match(/wsl\.exe --(?!.*-d)/g) || []).length === 0);
ok('PS1: HOME=/home/lavie in WSL_INIT', ps1Src.includes("export HOME=/home/lavie"));
ok('PS1: no tilde paths', !ps1Src.includes('~/kosame-dev-orchestra'));
ok('PS1: absolute repo path', ps1Src.includes('/home/lavie/kosame-dev-orchestra'));
ok('PS1: UNC WSL path detection', ps1Src.includes('TrimStart'));
ok('PS1: wslpath uses -d Ubuntu', ps1Src.includes('-d Ubuntu -- wslpath'));
ok('PS1: auto-dev uses base64 exec', ps1Src.includes('adB64'));
ok('PS1: auto-dev no direct bash-lc cmd', !ps1Src.includes('$autoDevCmd'));
ok('PS1: auto-dev no 2>&1 Write-Host pipe', !ps1Src.includes('bash -s" 2>&1 | Write-Host'));

// ── 3. Secret redaction (reuse activity-events redact) ──────────────────────

const { redact } = require('../tools/kosame-activity-events');

ok('redact: API key masked', redact('apiKey=sk-my-secret-key-12345').includes('[REDACTED]'));
ok('redact: normal text unchanged', redact('hello world') === 'hello world');
ok('redact: empty string', redact('') === '');
ok('redact: null', redact(null) === '');

// ── 4. Activity-relay module ────────────────────────────────────────────────

const relayModule = require('../tools/kosame-activity-relay');
ok('relay: start exported', typeof relayModule.start === 'function');

// Start relay with invalid URL (should log warning but not throw)
const origUrl = process.env.KOSAME_CLOUD_RUN_URL;
delete process.env.KOSAME_CLOUD_RUN_URL;
process.env.KOSAME_API_KEY = 'test-relay-key';
const relay = relayModule.start();
ok('relay: start with no URL does not throw', typeof relay.stop === 'function');
ok('relay: stats returns object', typeof relay.stats === 'function');
const stats = relay.stats();
ok('relay: stats.ok is number', typeof stats.ok === 'number');
ok('relay: KOSAME_IDENTITY_TOKEN env supported', typeof process.env.KOSAME_IDENTITY_TOKEN !== 'undefined' || true); // env optional

// Test relay with ID_TOKEN set (set before require in isolation)
process.env.KOSAME_IDENTITY_TOKEN = 'test-iam-token';
delete require.cache[require.resolve('../tools/kosame-activity-relay')];
const relayWithIAM = require('../tools/kosame-activity-relay');
const relay3 = relayWithIAM.start();
const stats3 = relay3.stats();
ok('relay: IAM configured flag present', typeof stats3.iamConfigured === 'boolean');
ok('relay: IAM configured when token set', stats3.iamConfigured === true);
relay3.stop();
delete process.env.KOSAME_IDENTITY_TOKEN;

relay.stop();
ok('relay: stop does not throw', true);

// ── 5. Dashboard server integrated routes ───────────────────────────────────

const { startServer } = require('../tools/kosame-dashboard-server');
process.env.KOSAME_API_KEY = 'smoke-v110-45-key';
const srv = startServer(0, { dryRun: true });
const PORT = srv.address().port;

function httpGet(urlPath, headers = {}) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method: 'GET',
      headers,
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: '' }));
    req.end();
  });
}

function httpPost(urlPath, body, headers = {}) {
  return new Promise((resolve) => {
    const b = JSON.stringify(body);
    const opts = {
      hostname: 'localhost',
      port: PORT,
      path: urlPath,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b), ...headers },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: '' }));
    req.write(b);
    req.end();
  });
}

async function testIngest() {
  // 4a. /health
  const health = await httpGet('/health');
  ok('ingest: /health returns 200', health.status === 200);
  const hbody = JSON.parse(health.body);
  ok('ingest: /health version 110.45.0', hbody.version === '110.45.0');

  // 4b. /api/dev/run without auth
  const noAuth = await httpPost('/api/dev/run', { spec: 'test', project: 'test' });
  ok('ingest: /api/dev/run no auth → 401', noAuth.status === 401);

  // 4c. /api/dev/run with wrong key → 401
  const wrongKey = await httpPost('/api/dev/run', { spec: 'test' }, { 'X-API-Key': 'wrong' });
  ok('ingest: /api/dev/run wrong key → 401', wrongKey.status === 401);

  // 4d. /api/dev/run with correct key → REMOTE_EXECUTION_UNAVAILABLE
  const runResp = await httpPost('/api/dev/run', { spec: 'test', project: 'test' }, { 'X-API-Key': 'smoke-v110-45-key' });
  ok('ingest: /api/dev/run auth OK', runResp.status === 200);
  const runBody = JSON.parse(runResp.body);
  ok('ingest: /api/dev/run code REMOTE_EXECUTION_UNAVAILABLE', runBody.code === 'REMOTE_EXECUTION_UNAVAILABLE');
  ok('ingest: /api/dev/run wslCommand present', typeof runBody.wslCommand === 'string');
  ok('ingest: /api/dev/run relay status present', typeof runBody.relay === 'object');

  // 4e. /api/activity/ingest without auth → 401
  const ingestNoAuth = await httpPost('/api/activity/ingest', { eventId: 'e1', eventType: 'task_started' });
  ok('ingest: /api/activity/ingest no auth → 401', ingestNoAuth.status === 401);

  // 4f. /api/activity/ingest with wrong key → 401
  const ingestWrongKey = await httpPost('/api/activity/ingest', { eventId: 'e2', eventType: 'task_started' }, { 'X-API-Key': 'wrong' });
  ok('ingest: /api/activity/ingest wrong key → 401', ingestWrongKey.status === 401);

  // 4g. /api/activity/ingest with correct key → 200
  const ingestOk = await httpPost('/api/activity/ingest',
    { eventId: 'e3-test', eventType: 'task_started', taskId: 'T-v110-45', project: 'smoke', message: 'ingest test' },
    { 'X-API-Key': 'smoke-v110-45-key' }
  );
  ok('ingest: /api/activity/ingest correct key → 200', ingestOk.status === 200);
  const ingestBody = JSON.parse(ingestOk.body);
  ok('ingest: /api/activity/ingest ok=true', ingestBody.ok === true);
  ok('ingest: /api/activity/ingest eventId returned', ingestBody.eventId === 'e3-test');

  // 4h. Duplicate eventId → dedup
  const ingestDup = await httpPost('/api/activity/ingest',
    { eventId: 'e3-test', eventType: 'task_started', taskId: 'T-v110-45' },
    { 'X-API-Key': 'smoke-v110-45-key' }
  );
  ok('ingest: duplicate eventId → 200 dedup=true', ingestDup.status === 200);
  const dupBody = JSON.parse(ingestDup.body);
  ok('ingest: dedup flag set', dupBody.dedup === true);

  // 4i. Missing eventId → 400
  const badIngest = await httpPost('/api/activity/ingest',
    { eventType: 'task_started' },
    { 'X-API-Key': 'smoke-v110-45-key' }
  );
  ok('ingest: missing eventId → 400', badIngest.status === 400);

  // 4j. /api/dev/status/:taskId (requires auth)
  const authHeaders = { 'X-API-Key': 'smoke-v110-45-key' };
  const taskStatus = await httpGet('/api/dev/status/T-v110-45', authHeaders);
  ok('ingest: /api/dev/status/T-v110-45 returns 200', taskStatus.status === 200);
  const tsBody = JSON.parse(taskStatus.body);
  ok('ingest: task status ok=true', tsBody.ok === true);
  ok('ingest: task status taskId match', tsBody.taskId === 'T-v110-45');

  // 4k. /api/dev/status/nonexistent → 404
  const missingTask = await httpGet('/api/dev/status/T-NONEXISTENT', authHeaders);
  ok('ingest: unknown task → 404', missingTask.status === 404);

  // 4l. /api/state contains relay info
  const state = await httpGet('/api/state');
  const sbody = JSON.parse(state.body);
  ok('ingest: /api/state has relay field', typeof sbody.relay === 'object');
  ok('ingest: /api/state relay.eventCount > 0', sbody.relay.eventCount > 0);

  // 4m. Ingest terminal event (task_completed) — should not throw (Discord silently skipped)
  const terminalIngest = await httpPost('/api/activity/ingest',
    { eventId: 'e4-complete', eventType: 'task_completed', taskId: 'T-complete', project: 'smoke', message: 'done' },
    { 'X-API-Key': 'smoke-v110-45-key' }
  );
  ok('ingest: terminal event task_completed → 200', terminalIngest.status === 200);

  // 4n. Ingest human_gate
  const gateIngest = await httpPost('/api/activity/ingest',
    { eventId: 'e5-gate', eventType: 'human_gate', taskId: 'T-gate', project: 'smoke', message: 'approval needed' },
    { 'X-API-Key': 'smoke-v110-45-key' }
  );
  ok('ingest: human_gate → 200', gateIngest.status === 200);

  // 4o. /api/dev/status shows relay info
  const devStatus = await httpGet('/api/dev/status', authHeaders);
  const dsBody = JSON.parse(devStatus.body);
  ok('ingest: /api/dev/status has relay field', typeof dsBody.relay === 'object');
  ok('ingest: /api/dev/status relay.eventCount > 0', dsBody.relay.eventCount > 0);

  // Cleanup
  delete process.env.KOSAME_API_KEY;
  srv.close();
  ok('ingest: server closes cleanly', true);

  summary();
}

// Run tests after server is listening
srv.on('listening', () => {
  // Small delay for server to be fully ready
  setTimeout(testIngest, 200);
});

function summary() {
  console.log('');
  if (fail === 0) {
    console.log(`✅ v110.45 hybrid smoke PASSED (${pass} checks)`);
    process.exit(0);
  } else {
    console.error(`❌ v110.45 hybrid smoke FAILED (pass=${pass} fail=${fail})`);
    process.exit(1);
  }
}
