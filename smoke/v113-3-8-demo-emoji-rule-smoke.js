#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const pkg = require('../package.json');
const ROOT = path.resolve(__dirname, '..');
const { isVersionAtLeast } = require('./version-compare');
const HTML_PATH = path.join(ROOT, 'public', 'kosame-live-cockpit.html');

async function main() {
  console.log('=== v113.3.8 demo-emoji-rule smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.8'), `version must be >= 113.3.8 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-8'], 'smoke:v113-3-8 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-8'), 'verify must include smoke:v113-3-8');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 絵文字の直前に。が残っていないことを確認
  assert.ok(!html.includes('。🔍'), 'Claude completion: 。🔍 must be removed (rule: no 。before terminal emoji)');
  assert.ok(html.includes('ありません🔍'), 'Claude completion must end with ありません🔍');
  console.log('  PASS: 。before terminal emoji removed');

  // 他の絵文字終わりメッセージに。が付いていないことを確認
  // (Gemini ❤️, KOSAME 💙 は？で終わるので対象外)
  assert.ok(!html.includes('。❤️'), 'no 。before ❤️');
  assert.ok(!html.includes('。💙'), 'no 。before 💙');
  assert.ok(!html.includes('。☂️'), 'no 。before ☂️');
  console.log('  PASS: no 。before any terminal emoji');

  // regression
  assert.ok(html.includes('id="agent-stream-log"'), 'agent-stream-log must still exist');
  assert.ok(html.includes('以上。'), 'Llama 以上。must still exist');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.8 demo-emoji-rule smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
