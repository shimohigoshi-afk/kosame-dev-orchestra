'use strict';

// Smoke test for v113.3.24:
//   ① GEMINI_TIMEOUT_MS extended to 30000
//   ② checkGeminiApiKey() added — logs [Gemini] API key valid / invalid at startup
// Does NOT make live API calls. Does NOT read secrets.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;
let failed = 0;

function ok(label) { console.log(`  PASS  ${label}`); passed++; }
function fail(label, detail) { console.error(`  FAIL  ${label}${detail ? ': ' + detail : ''}`); failed++; }
function readFile(relPath) {
  try { return fs.readFileSync(path.join(ROOT, relPath), 'utf8'); }
  catch { return null; }
}
function checkContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" not found` : 'pattern not found');
}

async function main() {
  console.log('===== v113-3-24-gemini-timeout-key-check smoke =====');
  console.log('Verifies: GEMINI_TIMEOUT_MS=30000 + checkGeminiApiKey startup log');
  console.log('');

  // ─── ① タイムアウト 30秒 ────────────────────────────────────────────────
  console.log('--- ① GEMINI_TIMEOUT_MS ---');
  const geminiSrc = readFile('tools/kosame-gemini.js');
  if (!geminiSrc) { fail('kosame-gemini.js exists', 'file not found'); }
  else {
    ok('kosame-gemini.js exists');
    checkContains('gemini: GEMINI_TIMEOUT_MS = 30000', geminiSrc, 'GEMINI_TIMEOUT_MS = 30000');
    checkContains('gemini: GEMINI_KEY_CHECK_TIMEOUT_MS defined', geminiSrc, 'GEMINI_KEY_CHECK_TIMEOUT_MS');
  }

  // ─── ② checkGeminiApiKey ─────────────────────────────────────────────────
  console.log('--- ② checkGeminiApiKey ---');
  if (geminiSrc) {
    checkContains('gemini: checkGeminiApiKey function', geminiSrc, 'async function checkGeminiApiKey(');
    checkContains('gemini: [Gemini] API key valid log', geminiSrc, '[Gemini] API key valid');
    checkContains('gemini: [Gemini] API key invalid log', geminiSrc, '[Gemini] API key invalid');
    checkContains('gemini: models endpoint used for key check', geminiSrc, '/v1beta/models?key=');
    checkContains('gemini: auto-run at module load', geminiSrc, 'checkGeminiApiKey().catch(');
    checkContains('gemini: checkGeminiApiKey exported', geminiSrc, 'checkGeminiApiKey,');
  }

  // ─── ② Server: startup require of kosame-gemini ──────────────────────────
  console.log('--- ② Server: startup init ---');
  const chatSrc = readFile('tools/kosame-cockpit-chat-server.js');
  checkContains('server: top-level require kosame-gemini for startup', chatSrc, "require('./kosame-gemini')");

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:gemini-timeout-key-check']) ok('package.json: smoke:gemini-timeout-key-check exists');
    else fail('package.json: smoke:gemini-timeout-key-check exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:gemini-timeout-key-check')) ok('verify includes smoke:gemini-timeout-key-check');
    else fail('verify includes smoke:gemini-timeout-key-check');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
