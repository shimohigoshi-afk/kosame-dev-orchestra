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

// Real product/preview pages that live under public/ but are NOT smoke-test litter.
// This script must never touch, reset, or delete them — only public/test.html is
// the canonical smoke-test scratch file. Add new pages here as they're created.
const PROTECTED_FILES = [
  'kosame-welcome.html',
  'kosame-logo-test.html',
];

const testHtmlPath = path.join(ROOT, 'public', 'test.html');
const protectedSnapshots = PROTECTED_FILES.map((name) => {
  const filePath = path.join(ROOT, 'public', name);
  const existedBefore = fs.existsSync(filePath);
  return {
    name,
    filePath,
    existedBefore,
    contentBefore: existedBefore ? fs.readFileSync(filePath, 'utf8') : null,
  };
});

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

// Protected product/preview pages exclusion check
for (const snap of protectedSnapshots) {
  if (!snap.existedBefore) {
    console.log('ℹ️ public/' + snap.name + ' not present — nothing to preserve');
    continue;
  }
  const contentAfter = fs.existsSync(snap.filePath) ? fs.readFileSync(snap.filePath, 'utf8') : null;
  if (contentAfter === null) {
    console.error('❌ FAIL: public/' + snap.name + ' was removed — smoke:cleanup must not touch it');
    ok = false;
  } else if (contentAfter !== snap.contentBefore) {
    console.error('❌ FAIL: public/' + snap.name + ' was modified — smoke:cleanup must not touch it');
    ok = false;
  } else {
    console.log('✅ public/' + snap.name + ' preserved (excluded from smoke cleanup)');
  }
}

console.log(ok ? '✅ smoke cleanup PASSED' : '❌ smoke cleanup FAILED');
process.exit(ok ? 0 : 1);
