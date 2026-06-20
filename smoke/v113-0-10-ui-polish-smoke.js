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
  console.log('=== v113.0.10 UI polish smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.10'), `version must be >= 113.0.10 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-10'], 'smoke:v113-0-10 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-10'), 'verify must include smoke:v113-0-10');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. RESULT DECISION PANEL下の余白を詰める
  assert.ok(
    html.includes('#result-decision-details .chat-section-body { padding-bottom: 2px; }'),
    'result-decision-details chat-section-body must have reduced padding-bottom'
  );
  console.log('  PASS: result-decision-details padding reduced');

  // 2. SHELL AGENT ACTIVITY最新3件、古いのは薄く
  assert.ok(html.includes('items.slice(0, 3)'), 'shell agent activity must limit to 3 items');
  assert.ok(html.includes("index === 1 ? '0.6' : '0.3'"), 'shell agent activity must fade older items');
  assert.ok(!html.includes('items.slice(0, 5).entries()'), 'shell agent activity must not iterate 5 items');
  console.log('  PASS: shell agent activity limited to 3 with opacity fade');

  // 3. ACTIVE RUNNER STREAMをシンプルに — 2-column grid, reduced min-height
  assert.ok(html.includes('grid-template-columns: 1fr 1fr'), 'task-motion-grid must be 2-column');
  assert.ok(html.includes('min-height: 60px'), 'task-motion-panel min-height must be reduced');
  assert.ok(!html.includes('minmax(280px, 1.4fr)'), 'old 4-column grid must be removed');
  assert.ok(!html.includes('min-height: 152px'), 'old 152px min-height must be removed');
  console.log('  PASS: active runner stream simplified to 2-column compact grid');

  // 4. チャット欄との距離感を調整 — chat-outer margin-top reduced
  assert.ok(html.includes('"chat-outer" style="margin-top:10px"'), 'chat-outer margin-top must be 10px');
  assert.ok(!html.includes('"chat-outer" style="margin-top:14px"'), 'old chat-outer margin-top:14px must be removed');
  console.log('  PASS: chat-outer margin-top adjusted to 10px');

  // Regression checks
  assert.ok(html.includes('id="result-decision-details"'), 'result-decision-details must still exist');
  assert.ok(html.includes('id="shell-agent-activity"'), 'shell-agent-activity must still exist');
  assert.ok(html.includes('id="feed-running"'), 'feed-running must still exist for JS');
  assert.ok(html.includes('id="feed-waiting"'), 'feed-waiting must still exist for JS');
  assert.ok(html.includes('id="feed-human-gate"'), 'feed-human-gate must still exist for JS');
  assert.ok(html.includes('id="feed-selected"'), 'feed-selected must still exist for JS');
  assert.ok(html.includes('id="ai-roster"'), 'ai-roster panel must not be regressed');
  assert.ok(html.includes('id="project-focus-collapse"'), 'project-focus-collapse must not be regressed');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.0.10 UI polish smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
