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
  console.log('=== v113.3.7 layout-collapse-auto smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.3.7'), `version must be >= 113.3.7 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-3-7'], 'smoke:v113-3-7 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-3-7'), 'verify must include smoke:v113-3-7');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // ① AGENT STREAM LOG: must be in its own section BEFORE chat-outer
  assert.ok(html.includes('id="agent-stream-log-strip"'), 'agent-stream-log-strip section must exist');
  assert.ok(html.includes('id="agent-stream-log-details"'), 'agent-stream-log-details must exist');
  assert.ok(/id="agent-stream-log-details"[^>]*\bopen\b/.test(html), 'agent-stream-log-details must be open');
  const aslStripPos  = html.indexOf('id="agent-stream-log-strip"');
  const chatOuterPos = html.indexOf('class="chat-outer"');
  assert.ok(aslStripPos > 0 && chatOuterPos > 0, 'both sections must exist');
  assert.ok(aslStripPos < chatOuterPos, 'agent-stream-log-strip must appear before chat-outer in HTML');
  // Must NOT be inside chat-outer
  const chatOuterHtml = html.slice(chatOuterPos);
  const chatOuterEnd = chatOuterHtml.indexOf('</section>');
  const chatOuterSection = chatOuterHtml.slice(0, chatOuterEnd);
  assert.ok(!chatOuterSection.includes('id="agent-stream-log-details"'), 'agent-stream-log must NOT be inside chat-outer');
  console.log('  PASS: ① AGENT STREAM LOG is standalone section above chat-outer');

  // ② ACTIVE TASK STRIP: wrapped in details, no open by default
  assert.ok(html.includes('id="active-task-strip-details"'), 'active-task-strip-details must exist');
  assert.ok(!html.includes('id="active-task-strip-details" open') && !html.includes('id="active-task-strip-details"  open'), 'active-task-strip-details must NOT have open by default');
  // details is inside active-task-board section
  const atbPos = html.indexOf('id="active-task-board"');
  const atdPos = html.indexOf('id="active-task-strip-details"');
  assert.ok(atdPos > atbPos, 'active-task-strip-details must be inside active-task-board');
  // Count card IDs still exist
  assert.ok(html.includes('id="feed-selected-count"'), 'feed-selected-count must exist');
  assert.ok(html.includes('id="feed-running-count"'), 'feed-running-count must exist');
  assert.ok(html.includes('id="feed-human-gate-count"'), 'feed-human-gate-count must exist');
  assert.ok(html.includes('id="feed-blocked-count"'), 'feed-blocked-count must exist');
  // JS auto-collapse
  assert.ok(html.includes('syncActiveTaskStrip'), 'syncActiveTaskStrip JS function must exist');
  assert.ok(html.includes('MutationObserver'), 'MutationObserver must be used for auto-collapse');
  assert.ok(html.includes('ATS_COUNT_IDS'), 'ATS_COUNT_IDS must be defined');
  console.log('  PASS: ② ACTIVE TASK STRIP is collapsible with auto-collapse');

  // ③ COLLAPSED DETAILS: wrapped in outer details, default closed
  assert.ok(html.includes('id="collapsed-details-wrapper"'), 'collapsed-details-wrapper must exist');
  // No open attribute on the outer wrapper
  assert.ok(!html.includes('id="collapsed-details-wrapper" open') && !html.includes('id="collapsed-details-wrapper"  open'), 'collapsed-details-wrapper must NOT have open by default');
  // Inner details still exist
  assert.ok(html.includes('id="autosave-support"'), 'autosave-support must still exist');
  assert.ok(html.includes('id="memory-support"'), 'memory-support must still exist');
  assert.ok(html.includes('id="idea-support"'), 'idea-support must still exist');
  assert.ok(html.includes('id="cost-support"'), 'cost-support must still exist');
  assert.ok(html.includes('id="cb-support"'), 'cb-support must still exist');
  assert.ok(html.includes('id="support-info"'), 'support-info must still exist');
  console.log('  PASS: ③ COLLAPSED DETAILS outer wrapper is closed by default');

  // Regressions
  assert.ok(html.includes('id="chat-input"'), 'chat-input must not be regressed');
  assert.ok(html.includes('id="chat-thread"'), 'chat-thread must not be regressed');
  assert.ok(html.includes('id="agent-stream-log"'), 'agent-stream-log body must still exist');
  assert.ok(html.includes('.agent-stream-log-strip { order: 4; }'), 'agent-stream-log-strip must have order:4 CSS');
  assert.ok(html.includes('.chat-outer { order: 4; }'), 'chat-outer order:4 must not be changed');
  assert.ok(html.includes('id="active-task-board"'), 'active-task-board must still exist');
  assert.ok(html.includes('id="handoff-result-strip"'), 'handoff-result-strip must still exist');
  assert.ok(html.includes('id="vault-status-chip"'), 'vault-status-chip must still exist');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.3.7 layout-collapse-auto smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
