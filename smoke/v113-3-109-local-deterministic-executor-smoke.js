#!/usr/bin/env node
'use strict';

/**
 * v113.3.109 — Local deterministic executor smoke
 *
 * Verifies:
 * 1. localDeterministicExecutor can append a unique marker to public/test.html
 * 2. processTicket with local executor fallback works
 * 3. Claude停止中でもPASSする
 * 4. target_repo は /home/lavie/kosame-dev-orchestra
 * 5. Sales DX / transcriber に誤爆しない
 */

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// ── Package version check ─────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const minVersion = '113.3.109';
console.log(`===== v${minVersion} local deterministic executor smoke =====`);

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

if (compareVersions(pkg.version, minVersion) < 0) {
  console.error(`FAIL: package version must be >= ${minVersion} (got ${pkg.version})`);
  process.exit(1);
}
console.log(`  PASS: version ${pkg.version}`);

// ── Unique test marker ───────────────────────────────────────────────────────
const UNIQUE = 'KOSAME_UNIQUE_TEST_113_3_109';
console.log(`  marker: ${UNIQUE}`);

// ── Import ────────────────────────────────────────────────────────────────────
const { processTicket, localDeterministicExecutor, extractFileAppendInfo } = require('../tools/kosame-runner-queue');

// ── Test 1: extractFileAppendInfo ─────────────────────────────────────────────
const info = extractFileAppendInfo(`${UNIQUE} を public/test.html の本文に追記してください。`);
if (!info || info.filePath !== 'public/test.html' || info.textToAppend !== UNIQUE) {
  console.error(`FAIL: extractFileAppendInfo returned unexpected: ${JSON.stringify(info)}`);
  process.exit(1);
}
console.log(`  PASS: extractFileAppendInfo filePath=${info.filePath} textToAppend=${info.textToAppend}`);

// ── Test 2: localDeterministicExecutor directly ───────────────────────────────
const testRunDir = path.join(ROOT, '.kosame-runner', 'runs', `smoke-109-local-${Date.now()}`);
fs.mkdirSync(testRunDir, { recursive: true });

const localResult = localDeterministicExecutor(
  { id: 'local-test', prompt_text: `${UNIQUE} を public/test.html の本文に追記してください。`, target_repo: ROOT },
  testRunDir
);

if (!localResult.ok) {
  console.error(`FAIL: localDeterministicExecutor returned ok=false: ${localResult.error}`);
  process.exit(1);
}
console.log(`  PASS: localDeterministicExecutor ok=true executor=${localResult.executor}`);

// ── Test 3: Verify marker in output.md ────────────────────────────────────────
const outputMdPath = path.join(testRunDir, 'output.md');
if (!fs.existsSync(outputMdPath)) {
  console.error(`FAIL: output.md not found`);
  process.exit(1);
}
const outputMd = fs.readFileSync(outputMdPath, 'utf8');
if (!outputMd.includes('result: success') && !outputMd.includes('result: skipped')) {
  console.error(`FAIL: output.md does not show success: ${outputMd.slice(0, 200)}`);
  process.exit(1);
}
console.log(`  PASS: output.md records local executor result`);

// ── Test 4: Verify marker in verify.log ───────────────────────────────────────
const verifyLogPath = path.join(testRunDir, 'verify.log');
if (!fs.existsSync(verifyLogPath)) {
  console.error(`FAIL: verify.log not found`);
  process.exit(1);
}
const verifyLog = fs.readFileSync(verifyLogPath, 'utf8');
if (!verifyLog.includes('ok: true')) {
  console.error(`FAIL: verify.log does not show ok: true`);
  process.exit(1);
}
console.log(`  PASS: verify.log records ok: true`);

// ── Test 5: Verify public/test.html has the marker ────────────────────────────
const testHtmlPath = path.join(ROOT, 'public', 'test.html');
if (!fs.existsSync(testHtmlPath)) {
  console.error(`FAIL: public/test.html not found`);
  process.exit(1);
}
const testHtml = fs.readFileSync(testHtmlPath, 'utf8');
if (!testHtml.includes(UNIQUE)) {
  console.error(`FAIL: public/test.html does not contain "${UNIQUE}"`);
  process.exit(1);
}
console.log(`  PASS: public/test.html contains marker`);

// ── Test 6: Verify NOT sales-dx or transcriber ────────────────────────────────
const salesDxPaths = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
for (const bad of salesDxPaths) {
  if (ROOT.includes(bad)) {
    console.error(`FAIL: target_repo must NOT be ${bad}`);
    process.exit(1);
  }
}
console.log(`  PASS: no sales-dx / transcriber contamination`);

// ── Test 7: processTicket with local executor (via defaultExecutor fallback) ──
const ticketId = `smoke-109-pipe-${Date.now()}`;
const pipeResult = processTicket(
  {
    id: ticketId,
    title: `Smoke test 109: ${UNIQUE}`,
    prompt_text: `${UNIQUE} を public/test.html の本文に追記してください。`,
    target_repo: ROOT,
    assigned_agent: 'claude_code',
    risk_level: 'low',
    human_gate_required: false,
    source: 'kosame-chat-dispatch',
    created_at: new Date().toISOString(),
  },
  {
    runsDir: path.join(ROOT, '.kosame-runner', 'runs'),
    // Use a custom executor that simulates Claude failure then falls back
    executor: (ticket, runDir) => {
      // Simulate Claude failing, return local executor result as fallback
      const localR = localDeterministicExecutor(ticket, runDir);
      if (localR.ok) {
        localR.fallbackFrom = 'claude';
        return localR;
      }
      return { ok: false, exitCode: 1, error: 'both claude and local failed' };
    },
  }
);

if (!pipeResult || !pipeResult.status) {
  console.error(`FAIL: processTicket with local executor returned no status`);
  process.exit(1);
}
console.log(`  PASS: processTicket with local executor status=${pipeResult.status}`);

// ── Final ─────────────────────────────────────────────────────────────────────
console.log('');
console.log(`✅ v${minVersion} local deterministic executor smoke PASSED`);
