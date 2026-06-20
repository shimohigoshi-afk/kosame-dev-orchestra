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
  console.log('=== v113.3.1 handoff-result outer collapse smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.1'), `version must be >= 113.3.1 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-1'], 'smoke:v113-3-1 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-1'), 'verify must include smoke:v113-3-1');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // HANDOFF & RESULT セクション全体が <details> で包まれている
  assert.ok(html.includes('id="handoff-result-outer-details"'), 'handoff-result-outer-details must exist');

  // デフォルト閉じ（open属性なし）
  assert.ok(
    !html.includes('id="handoff-result-outer-details" open') &&
    !html.includes('open id="handoff-result-outer-details"'),
    'handoff-result-outer-details must not have open attribute'
  );
  console.log('  PASS: handoff-result-outer-details exists and is closed by default');

  // 内部パネルの ID が全て維持されている
  assert.ok(html.includes('id="handoff-inbox-details"'), 'handoff-inbox-details must still exist');
  assert.ok(html.includes('id="handoff-queue-details"'), 'handoff-queue-details must still exist');
  assert.ok(html.includes('id="work-order-result-details"'), 'work-order-result-details must still exist');
  assert.ok(html.includes('id="result-decision-details"'), 'result-decision-details must still exist');
  assert.ok(html.includes('id="work-order-approval-status"'), 'work-order-approval-status must still exist');
  console.log('  PASS: all inner panel IDs preserved');

  // handoff-result-outer-details が handoff-result-strip 内にある
  const stripPos = html.indexOf('id="handoff-result-strip"');
  const outerPos = html.indexOf('id="handoff-result-outer-details"');
  assert.ok(stripPos > 0 && outerPos > stripPos, 'handoff-result-outer-details must be inside handoff-result-strip');
  console.log('  PASS: handoff-result-outer-details is inside handoff-result-strip');

  console.log('✅ v113.3.1 handoff-result outer collapse smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
