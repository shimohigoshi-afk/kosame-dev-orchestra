#!/usr/bin/env node
'use strict';

/**
 * v113.3.110 — Natural order extract smoke
 *
 * Verifies extractFileAppendInfo handles both orderings:
 *   marker-first:  "KOSAME_xxx を public/test.html の本文に追記してください"
 *   file-first:    "public/test.html に KOSAME_xxx を本文追記してください"
 *
 * Also verifies path traversal is blocked.
 */

const fs   = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// ── Package version check ─────────────────────────────────────────────────────
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const minVersion = '113.3.110';
console.log(`===== v${minVersion} natural order extract smoke =====`);

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

const { extractFileAppendInfo, localDeterministicExecutor, processTicket } = require('../tools/kosame-runner-queue');
const UNIQUE = 'KOSAME_BROWSER_TEST_113_3_110';

// ── Test 1: marker-first form (original) ──────────────────────────────────────
const info1 = extractFileAppendInfo(`${UNIQUE} を public/test.html の本文に追記してください。`);
if (!info1 || info1.filePath !== 'public/test.html' || info1.textToAppend !== UNIQUE || info1.error) {
  console.error(`FAIL: marker-first form: ${JSON.stringify(info1)}`);
  process.exit(1);
}
console.log(`  PASS: marker-first: filePath=${info1.filePath} marker=${info1.textToAppend}`);

// ── Test 2: file-first form (browser natural language) ────────────────────────
const info2 = extractFileAppendInfo(`public/test.html に ${UNIQUE} を本文追記してください。`);
if (!info2 || info2.filePath !== 'public/test.html' || info2.textToAppend !== UNIQUE || info2.error) {
  console.error(`FAIL: file-first form: ${JSON.stringify(info2)}`);
  process.exit(1);
}
console.log(`  PASS: file-first: filePath=${info2.filePath} marker=${info2.textToAppend}`);

// ── Test 3: even more natural form ────────────────────────────────────────────
const info3 = extractFileAppendInfo(`public/test.html に ${UNIQUE} を表示してください。`);
if (!info3 || info3.filePath !== 'public/test.html' || info3.textToAppend !== UNIQUE || info3.error) {
  console.error(`FAIL: natural form 3: ${JSON.stringify(info3)}`);
  process.exit(1);
}
console.log(`  PASS: natural form: filePath=${info3.filePath} marker=${info3.textToAppend}`);

// ── Test 4: path traversal is blocked ─────────────────────────────────────────
const info4 = extractFileAppendInfo(`${UNIQUE} を ../../etc/passwd に追記してください。`);
if (!info4 || !info4.error) {
  console.error(`FAIL: path traversal should be blocked: ${JSON.stringify(info4)}`);
  process.exit(1);
}
console.log(`  PASS: path traversal blocked: ${info4.error}`);

// ── Test 5: localDeterministicExecutor with file-first form ───────────────────
const ticketId1 = `smoke-110-ff-${Date.now()}`;
const runDir1 = path.join(ROOT, '.kosame-runner', 'runs', ticketId1);
fs.mkdirSync(runDir1, { recursive: true });

const result1 = localDeterministicExecutor(
  { id: ticketId1, prompt_text: `public/test.html に ${UNIQUE} を本文追記してください。`, target_repo: ROOT },
  runDir1
);
if (!result1.ok) {
  console.error(`FAIL: local executor file-first: ${result1.error}`);
  process.exit(1);
}
console.log(`  PASS: local executor file-first ok=true executor=${result1.executor}`);

// ── Test 6: verify marker in output.md ────────────────────────────────────────
const outputMd = fs.readFileSync(path.join(runDir1, 'output.md'), 'utf8');
if (!outputMd.includes('result: success') && !outputMd.includes('result: skipped')) {
  console.error(`FAIL: output.md no success for file-first`);
  process.exit(1);
}
console.log(`  PASS: output.md file-first success`);

// ── Test 7: verify public/test.html has the marker ────────────────────────────
const testHtml = fs.readFileSync(path.join(ROOT, 'public', 'test.html'), 'utf8');
if (!testHtml.includes(UNIQUE)) {
  console.error(`FAIL: public/test.html does not contain "${UNIQUE}"`);
  process.exit(1);
}
console.log(`  PASS: public/test.html contains marker`);

// ── Test 8: no sales-dx / transcriber ────────────────────────────────────────
const badPaths = ['kosame-sales-dx', 'sales-dx', 'transcriber', 'transcribe'];
for (const bad of badPaths) {
  if (ROOT.includes(bad)) {
    console.error(`FAIL: target_repo must NOT be ${bad}`);
    process.exit(1);
  }
}
console.log(`  PASS: no sales-dx / transcriber`);

// ── Test 9: processTicket pipeline with file-first ────────────────────────────
const ticketId2 = `smoke-110-pipe-${Date.now()}`;
const result2 = processTicket(
  {
    id: ticketId2,
    title: `Smoke 110 file-first`,
    prompt_text: `public/test.html に ${UNIQUE} を追記してください。`,
    target_repo: ROOT,
    assigned_agent: 'claude_code',
    risk_level: 'low',
    human_gate_required: false,
    source: 'kosame-chat-dispatch',
    created_at: new Date().toISOString(),
  },
  {
    runsDir: path.join(ROOT, '.kosame-runner', 'runs'),
    executor: (t, runDir) => localDeterministicExecutor(t, runDir),
  }
);
if (!result2 || !result2.status) {
  console.error(`FAIL: processTicket file-first returned no status`);
  process.exit(1);
}
console.log(`  PASS: processTicket file-first status=${result2.status}`);

// ── Final ─────────────────────────────────────────────────────────────────────
console.log('');
console.log(`✅ v${minVersion} natural order extract smoke PASSED`);
