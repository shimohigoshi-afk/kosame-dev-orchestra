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
  console.log('=== v113.3.3 layout + collapse smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.3'), `version must be >= 113.3.3 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-3'], 'smoke:v113-3-3 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-3'), 'verify must include smoke:v113-3-3');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  assert.ok(html.includes('.active-task-board { order: 3; }'), 'active-task-board must be order 3');
  assert.ok(html.includes('.chat-outer { order: 4; }'), 'chat-outer must be order 4');
  assert.ok(html.includes('.runner-stream-strip { order: 6; }'), 'runner-stream-strip must be order 6');
  assert.ok(html.includes('.agent-feed-strip { order: 7; }'), 'agent-feed-strip must be order 7');
  assert.ok(html.includes('.dev-orchestra-focus-section { order: 8; }'), 'dev-orchestra-focus-section must be order 8');
  assert.ok(html.includes('.ai-roster-shell { order: 9; }'), 'ai-roster-shell must be order 9');
  assert.ok(html.includes('.assist-menu-strip { order: 11; }'), 'assist-menu-strip must be order 11');
  console.log('  PASS: CSS order values correct');

  assert.ok(html.includes('id="runner-stream-details"'), 'runner-stream-details must exist');
  assert.ok(!html.includes('id="runner-stream-details" open'), 'runner-stream-details must not have open');
  assert.ok(html.includes('id="feed-running"'), 'feed-running must still exist');
  assert.ok(html.includes('id="feed-waiting"'), 'feed-waiting must still exist');
  assert.ok(html.includes('id="feed-human-gate"'), 'feed-human-gate must still exist');
  assert.ok(html.includes('id="feed-selected"'), 'feed-selected must still exist');
  console.log('  PASS: ACTIVE RUNNER STREAM wrapped in details (closed by default)');

  assert.ok(html.includes('id="agent-feed-details"'), 'agent-feed-details must exist');
  assert.ok(!html.includes('id="agent-feed-details" open'), 'agent-feed-details must not have open');
  assert.ok(html.includes('id="agent-event-feed"'), 'agent-event-feed must still exist');
  console.log('  PASS: AGENT SHORT CONVERSATION FEED wrapped in details (closed by default)');

  assert.ok(html.includes('id="dev-orchestra-focus-section"'), 'dev-orchestra-focus-section must exist');
  assert.ok(html.includes('id="project-focus-collapse"'), 'project-focus-collapse must still exist');
  assert.ok(html.includes('id="project-focus"'), 'project-focus must still exist');
  console.log('  PASS: dev-orchestra-focus-section exists as standalone section');

  const projectShellPos = html.indexOf('id="project-registry-shell"');
  const projectShellEnd = html.indexOf('</section>', projectShellPos);
  const projectShellHtml = html.slice(projectShellPos, projectShellEnd);
  assert.ok(!projectShellHtml.includes('id="project-focus-collapse"'), 'project-registry-shell must not contain project-focus-collapse');
  console.log('  PASS: project-registry-shell contains only the strip panel');

  assert.ok(html.includes('id="ai-roster-details"'), 'ai-roster-details must exist');
  assert.ok(!html.includes('id="ai-roster-details" open'), 'ai-roster-details must not have open attribute');
  console.log('  PASS: ai-roster-details is closed by default');

  assert.ok(html.includes('id="assist-menu-strip"'), 'assist-menu-strip must exist');
  const chatOuterPos = html.indexOf('class="chat-outer"');
  const chatOuterEnd = html.indexOf('</section>', chatOuterPos);
  const chatOuterHtml = html.slice(chatOuterPos, chatOuterEnd);
  assert.ok(!chatOuterHtml.includes('chat-assist-shell-summary'), 'chat-outer must not contain assist-menu summary');
  assert.ok(html.includes('id="chat-assist-content"'), 'chat-assist-content must still exist');
  console.log('  PASS: assist-menu-strip extracted outside chat-outer');

  assert.ok(html.includes('id="active-task-board"'), 'active-task-board must exist');
  assert.ok(html.includes('id="handoff-result-strip"'), 'handoff-result-strip must exist');
  assert.ok(html.includes('id="shell-agent-activity"'), 'shell-agent-activity must exist');
  assert.ok(html.includes('id="chat-input"'), 'chat-input must exist');
  assert.ok(html.includes('id="chat-thread"'), 'chat-thread must exist');
  assert.ok(html.includes('id="ai-roster"'), 'ai-roster must exist');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.3 layout + collapse smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
