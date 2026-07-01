#!/usr/bin/env node
'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const cp   = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CANONICAL_HTML = '<!DOCTYPE html>\n<html lang="ja">\n<head>\n  <meta charset="UTF-8">\n  <title>Test</title>\n</head>\n<body>\n  <h1>Hello World</h1>\n</body>\n</html>\n';

const BAD_MARKERS = [
  'KOSAME_UNIQUE_TEST', 'KOSAME_BROWSER_TEST', 'KOSAME_APPEND', 'KOSAME_HEADING',
  'KOSAME_SMOKE', 'KOSAME_TEST', 'KOSAME_CREATE', 'KOSAME_CHAOS',
  'HELLO WORLD KOSAME WORKS', 'KOSAME RC', 'v113 smoke marker', 'append marker', 'browser marker',
];

const testHtmlPath = path.join(ROOT, 'public', 'test.html');

let ok = true;

// Restore canonical
fs.writeFileSync(testHtmlPath, CANONICAL_HTML);
const content = fs.readFileSync(testHtmlPath, 'utf8');
if (content !== CANONICAL_HTML) {
  console.error('❌ FAIL: test.html write did not restore canonical');
  ok = false;
} else {
  console.log('✅ test.html restored to canonical');
}

// Check for markers
for (const m of BAD_MARKERS) {
  if (content.includes(m)) {
    console.error('❌ FAIL: test.html contains marker: ' + m);
    ok = false;
  }
}
if (ok) console.log('✅ No smoke markers found');

// Check git diff
try {
  const diff = cp.spawnSync('git', ['diff', '--', 'public/test.html'], { cwd: ROOT, encoding: 'utf8', timeout: 5000 });
  const d = (diff.stdout || '').trim();
  if (d) {
    console.error('❌ FAIL: git diff public/test.html is not empty: ' + d.slice(0, 100));
    ok = false;
  } else {
    console.log('✅ git diff public/test.html is empty');
  }
} catch (e) {
  console.error('⚠️ git diff check failed: ' + e.message);
}

console.log(ok ? '✅ smoke cleanup PASSED' : '❌ smoke cleanup FAILED');
process.exit(ok ? 0 : 1);
