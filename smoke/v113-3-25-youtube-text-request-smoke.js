'use strict';

// Smoke test for v113.3.25:
//   YouTube URL request format changed from file_data to plain text.
//   Added debug logs: [Gemini] request sent / response received / response: <100 chars>
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
function checkNotContains(label, content, pattern) {
  if (content === null) { fail(label, 'file unreadable'); return; }
  const found = typeof pattern === 'string' ? content.includes(pattern) : pattern.test(content);
  if (!found) ok(label);
  else fail(label, typeof pattern === 'string' ? `"${pattern}" still present` : 'pattern still present');
}

async function main() {
  console.log('===== v113-3-25-youtube-text-request smoke =====');
  console.log('Verifies: YouTube URL as plain text prompt + debug logs');
  console.log('');

  // ─── kosame-gemini.js ────────────────────────────────────────────────────
  console.log('--- kosame-gemini.js ---');
  const geminiSrc = readFile('tools/kosame-gemini.js');
  if (!geminiSrc) { fail('kosame-gemini.js exists', 'file not found'); }
  else {
    ok('kosame-gemini.js exists');
    checkNotContains('gemini: file_data format removed', geminiSrc, 'file_data');
    checkContains('gemini: text prompt contains この動画について教えて', geminiSrc, 'この動画について教えて');
    checkContains('gemini: URL embedded in text prompt', geminiSrc, '${url}');
    checkContains('gemini: [Gemini] request sent log', geminiSrc, '[Gemini] request sent');
    checkContains('gemini: [Gemini] response received log', geminiSrc, '[Gemini] response received');
    checkContains('gemini: [Gemini] response: log', geminiSrc, '[Gemini] response:');
    checkContains('gemini: response preview 100 chars', geminiSrc, 'slice(0, 100)');
    checkContains('gemini: single parts array with text only', geminiSrc, "parts: [{ text:");
  }

  // ─── package.json ──────────────────────────────────────────────────────────
  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:youtube-text-request']) ok('package.json: smoke:youtube-text-request exists');
    else fail('package.json: smoke:youtube-text-request exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:youtube-text-request')) ok('verify includes smoke:youtube-text-request');
    else fail('verify includes smoke:youtube-text-request');
    ok('package.json version check: skipped (version advances with each release)');
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
