'use strict';

// Smoke test for v113.3.23: Gemini model updated to gemini-2.5-flash.
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
  console.log('===== v113-3-23-gemini-model-update smoke =====');
  console.log('Verifies: GEMINI_MODEL updated to gemini-2.5-flash');
  console.log('');

  const geminiSrc = readFile('tools/kosame-gemini.js');
  if (!geminiSrc) { fail('kosame-gemini.js exists', 'file not found'); }
  else {
    ok('kosame-gemini.js exists');
    checkContains('gemini: model is gemini-2.5-flash', geminiSrc, 'gemini-2.5-flash');
    checkNotContains('gemini: old model gemini-2.0-flash removed', geminiSrc, 'gemini-2.0-flash');
    checkContains('gemini: GEMINI_MODEL constant used in path', geminiSrc, 'GEMINI_MODEL');
  }

  console.log('--- package.json ---');
  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    ok('package.json: parses as JSON');
  } catch (e) { fail('package.json: parses as JSON', e.message); }
  if (pkg) {
    const scripts = pkg.scripts || {};
    if (scripts['smoke:gemini-model-update-23']) ok('package.json: smoke:gemini-model-update-23 exists');
    else fail('package.json: smoke:gemini-model-update-23 exists');
    const verify = scripts['verify'] || '';
    if (verify.includes('smoke:gemini-model-update-23')) ok('verify includes smoke:gemini-model-update-23');
    else fail('verify includes smoke:gemini-model-update-23');
    if (String(pkg.version || '').includes('113.3.23')) ok('package.json version: 113.3.23');
    else fail('package.json version: 113.3.23', `got ${pkg.version}`);
  }

  console.log(`\n===== result: ${passed} passed / ${failed} failed =====`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('smoke fatal error:', e); process.exit(1); });
