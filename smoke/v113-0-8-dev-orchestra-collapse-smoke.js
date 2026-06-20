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
  console.log('=== v113.0.8 DEV ORCHESTRA STATUS collapsible smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.8'), `version must be >= 113.0.8 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-8'], 'smoke:v113-0-8 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-8'), 'verify must include smoke:v113-0-8');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // project-focus-collapse details element exists and is default-closed (no open attribute)
  assert.ok(html.includes('id="project-focus-collapse"'), 'HTML must have project-focus-collapse details');
  assert.ok(html.includes('class="project-focus-collapse"'), 'HTML must have project-focus-collapse class');
  assert.ok(!html.includes('id="project-focus-collapse" open'), 'project-focus-collapse must be default-closed');
  assert.ok(!html.includes('class="project-focus-collapse" open'), 'project-focus-collapse must be default-closed');
  console.log('  PASS: project-focus-collapse exists and is default-closed');

  // summary toggle exists
  assert.ok(html.includes('project-focus-collapse-toggle'), 'HTML must have project-focus-collapse-toggle');
  console.log('  PASS: collapse toggle present');

  // IDs inside the details are preserved (JS still works)
  assert.ok(html.includes('id="project-focus-title"'), 'project-focus-title ID must be preserved');
  assert.ok(html.includes('id="project-focus-subtitle"'), 'project-focus-subtitle ID must be preserved');
  assert.ok(html.includes('id="project-focus"'), 'project-focus ID must be preserved');
  console.log('  PASS: inner IDs preserved for JS');

  // CSS for collapse exists
  assert.ok(html.includes('.project-focus-collapse-toggle'), 'HTML must have CSS for collapse toggle');
  console.log('  PASS: CSS defined');

  // AI Roster still present (regression check from v113.0.7)
  assert.ok(html.includes('id="ai-roster"'), 'HTML must still have ai-roster panel');
  assert.ok(html.includes('AI ROSTER'), 'HTML must still have AI ROSTER heading');
  console.log('  PASS: AI Roster panel not regressed');

  console.log('✅ v113.0.8 DEV ORCHESTRA STATUS collapsible smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
