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
  console.log('=== v113.1.1 layout order smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.1.1'), `version must be >= 113.1.1 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-1-1'], 'smoke:v113-1-1 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-1-1'), 'verify must include smoke:v113-1-1');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. CSS order 値が正しい
  assert.ok(html.includes('.ai-roster-shell { order: 3; }'), 'ai-roster-shell must be order 3');
  assert.ok(html.includes('.active-task-board { order: 4; }'), 'active-task-board must be order 4');
  assert.ok(html.includes('.handoff-result-strip { order: 5; }'), 'handoff-result-strip must be order 5');
  assert.ok(html.includes('.shell-activity-strip { order: 6; }'), 'shell-activity-strip must be order 6');
  assert.ok(html.includes('.runner-stream-strip { order: 7; }'), 'runner-stream-strip must be order 7');
  assert.ok(html.includes('.agent-feed-strip { order: 8; }'), 'agent-feed-strip must be order 8');
  assert.ok(html.includes('.chat-outer { order: 9; }'), 'chat-outer must be order 9');
  assert.ok(html.includes('.support-details-outer { order: 10; }'), 'support-details-outer must be order 10');
  console.log('  PASS: CSS order values correct (project:2, ai-roster:3, active-task:4, handoff:5, shell-activity:6, runner:7, agent-feed:8, chat:9, support:10)');

  // 2. 新セクションが存在する
  assert.ok(html.includes('id="shell-activity-strip"'), 'shell-activity-strip section must exist');
  assert.ok(html.includes('id="runner-stream-strip"'), 'runner-stream-strip section must exist');
  assert.ok(html.includes('id="agent-feed-strip"'), 'agent-feed-strip section must exist');
  console.log('  PASS: new top-level sections exist');

  // 3. AI ROSTERが <details open> で包まれている
  assert.ok(html.includes('id="ai-roster-details" open'), 'ai-roster-details must have open attribute');
  assert.ok(html.includes('id="ai-roster"'), 'ai-roster div must still exist inside details');
  console.log('  PASS: ai-roster-details is collapsible and open by default');

  // 4. active-task-board が ACTIVE RUNNER STREAM を直接含まない
  const activeBoardStart = html.indexOf('id="active-task-board"');
  const activeBoardEnd = html.indexOf('</section>', activeBoardStart + 1);
  const activeBoardHtml = html.slice(activeBoardStart, activeBoardEnd);
  assert.ok(!activeBoardHtml.includes('id="feed-running"'), 'active-task-board must not contain feed-running directly');
  assert.ok(!activeBoardHtml.includes('id="agent-event-feed"'), 'active-task-board must not contain agent-event-feed directly');
  assert.ok(!activeBoardHtml.includes('id="shell-agent-activity"'), 'active-task-board must not contain shell-agent-activity directly');
  console.log('  PASS: active-task-board contains only header and counts (sub-sections extracted)');

  // 5. セクションの位置順序（HTML source order）
  const pos = (id) => html.indexOf(id);
  const commandPos    = pos('class="command-stage"');
  const projectPos    = pos('id="project-registry-shell"');
  const aiRosterPos   = pos('id="ai-roster-details"');
  const activeTaskPos = pos('id="active-task-board"');
  const handoffPos    = pos('id="handoff-result-strip"');
  const shellActPos   = pos('id="shell-activity-strip"');
  const runnerPos     = pos('id="runner-stream-strip"');
  const agentFeedPos  = pos('id="agent-feed-strip"');
  const chatPos       = pos('class="chat-outer"');
  const supportPos    = pos('class="support-details-outer"');

  assert.ok(commandPos < projectPos, 'command-stage before project-registry-shell');
  assert.ok(projectPos < aiRosterPos, 'project-registry-shell before ai-roster');
  assert.ok(aiRosterPos < activeTaskPos, 'ai-roster before active-task-board');
  assert.ok(activeTaskPos < handoffPos, 'active-task-board before handoff-result-strip');
  assert.ok(handoffPos < shellActPos, 'handoff-result-strip before shell-activity-strip');
  assert.ok(shellActPos < runnerPos, 'shell-activity-strip before runner-stream-strip');
  assert.ok(runnerPos < agentFeedPos, 'runner-stream-strip before agent-feed-strip');
  assert.ok(agentFeedPos < chatPos, 'agent-feed-strip before chat-outer');
  assert.ok(chatPos < supportPos, 'chat-outer before support-details-outer');
  console.log('  PASS: HTML source order matches target layout (1→2→3→4→5→6→7→8→9→10→11)');

  // 6. SHELL AGENT ACTIVITY は shell-activity-strip 内の <details> に残る
  assert.ok(html.includes('id="shell-agent-activity-details"'), 'shell-agent-activity-details must exist');
  assert.ok(html.includes('id="shell-agent-activity"'), 'shell-agent-activity feed must exist');
  const shellActSection = html.indexOf('id="shell-activity-strip"');
  const shellActivityFeedPos = html.indexOf('id="shell-agent-activity"');
  assert.ok(shellActivityFeedPos > shellActSection, 'shell-agent-activity must be inside shell-activity-strip');
  console.log('  PASS: shell-agent-activity is inside shell-activity-strip section');

  // 7. Regression checks — 全 ID 維持
  assert.ok(html.includes('id="result-decision-details"'), 'result-decision-details must still exist');
  assert.ok(html.includes('id="handoff-result-strip"'), 'handoff-result-strip must still exist');
  assert.ok(html.includes('id="feed-running"'), 'feed-running must still exist for JS');
  assert.ok(html.includes('id="feed-waiting"'), 'feed-waiting must still exist for JS');
  assert.ok(html.includes('id="feed-human-gate"'), 'feed-human-gate must still exist for JS');
  assert.ok(html.includes('id="feed-selected"'), 'feed-selected must still exist for JS');
  assert.ok(html.includes('id="agent-event-feed"'), 'agent-event-feed must still exist for JS');
  assert.ok(html.includes('id="ai-roster"'), 'ai-roster must still exist for JS');
  assert.ok(html.includes('id="project-focus-collapse"'), 'project-focus-collapse must not be regressed');
  assert.ok(html.includes('id="chat-input"'), 'chat-input must not be regressed');
  assert.ok(html.includes('id="chat-thread"'), 'chat-thread must not be regressed');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.1.1 layout order smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
