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
  console.log('=== v113.0.11 collapse layout smoke ===');

  assert.ok(isVersionAtLeast(pkg.version, '113.0.11'), `version must be >= 113.0.11 (got ${pkg.version})`);
  assert.ok(pkg.scripts['smoke:v113-0-11'], 'smoke:v113-0-11 must exist');
  assert.ok(pkg.scripts.verify.includes('smoke:v113-0-11'), 'verify must include smoke:v113-0-11');
  console.log('  PASS: package wiring');

  const html = fs.readFileSync(HTML_PATH, 'utf8');

  // 1. SHELL AGENT ACTIVITYがdetailsで包まれている（デフォルト閉じ）
  assert.ok(
    html.includes('id="shell-agent-activity-details"'),
    'shell-agent-activity must be wrapped in a details element'
  );
  // detailsのopen属性なしで存在すること
  assert.ok(
    !html.includes('<details class="chat-section-details" id="shell-agent-activity-details" open'),
    'shell-agent-activity-details must not have open attribute'
  );
  // id="shell-agent-activity" フィードは内部に残っている
  assert.ok(html.includes('id="shell-agent-activity"'), 'shell-agent-activity feed must still exist');
  console.log('  PASS: shell-agent-activity wrapped in details (closed by default)');

  // 2. HANDOFF & RESULTセクションがactive-task-boardの近くに存在する
  assert.ok(html.includes('id="handoff-result-strip"'), 'handoff-result-strip section must exist');
  assert.ok(html.includes('class="handoff-result-strip"'), 'handoff-result-strip class must exist');

  // HANDOFFとRESULTパネルのIDがhandoff-result-strip内に存在
  const handoffResultPos = html.indexOf('id="handoff-result-strip"');
  const projectRegistryPos = html.indexOf('id="project-registry-shell"');
  assert.ok(handoffResultPos > 0, 'handoff-result-strip must be found');
  assert.ok(projectRegistryPos > handoffResultPos, 'handoff-result-strip must appear before project-registry-shell');

  // active-task-boardとhandoff-result-stripの順序
  const activeTaskPos = html.indexOf('id="active-task-board"');
  assert.ok(activeTaskPos < handoffResultPos, 'active-task-board must appear before handoff-result-strip');
  console.log('  PASS: handoff-result-strip placed between active-task-board and project-registry-shell');

  // 3. 4つのパネルがhandoff-result-strip内にある（chat-outerには存在しない）
  const chatOuterPos = html.indexOf('class="chat-outer"');
  const handoffInboxPos = html.indexOf('id="handoff-inbox-details"');
  const handoffQueuePos = html.indexOf('id="handoff-queue-details"');
  const workOrderResultPos = html.indexOf('id="work-order-result-details"');
  const resultDecisionPos = html.indexOf('id="result-decision-details"');

  assert.ok(handoffInboxPos > 0, 'handoff-inbox-details must exist');
  assert.ok(handoffQueuePos > 0, 'handoff-queue-details must exist');
  assert.ok(workOrderResultPos > 0, 'work-order-result-details must exist');
  assert.ok(resultDecisionPos > 0, 'result-decision-details must exist');

  // 全てchat-outerより前（handoff-result-strip内）にある
  assert.ok(handoffInboxPos < chatOuterPos, 'handoff-inbox-details must be before chat-outer');
  assert.ok(handoffQueuePos < chatOuterPos, 'handoff-queue-details must be before chat-outer');
  assert.ok(workOrderResultPos < chatOuterPos, 'work-order-result-details must be before chat-outer');
  assert.ok(resultDecisionPos < chatOuterPos, 'result-decision-details must be before chat-outer');
  console.log('  PASS: handoff/result panels are in handoff-result-strip, not inside chat-outer');

  // 4. chat-outerにはhandoff/resultパネルが含まれていない
  const chatOuterEnd = html.indexOf('</section>', chatOuterPos + 1);
  const chatOuterHtml = chatOuterEnd > 0 ? html.slice(chatOuterPos, chatOuterEnd) : '';
  assert.ok(!chatOuterHtml.includes('id="handoff-inbox-details"'), 'chat-outer must not contain handoff-inbox-details');
  assert.ok(!chatOuterHtml.includes('id="handoff-queue-details"'), 'chat-outer must not contain handoff-queue-details');
  assert.ok(!chatOuterHtml.includes('id="work-order-result-details"'), 'chat-outer must not contain work-order-result-details');
  assert.ok(!chatOuterHtml.includes('id="result-decision-details"'), 'chat-outer must not contain result-decision-details');
  console.log('  PASS: chat-outer contains only chat UI (no handoff/result panels)');

  // 5. 全パネルがデフォルト閉じ（open属性なし）
  const panelIds = ['handoff-inbox-details', 'handoff-queue-details', 'work-order-result-details', 'result-decision-details'];
  for (const id of panelIds) {
    assert.ok(!html.includes(`id="${id}" open`) && !html.includes(`open id="${id}"`), `${id} must not have open attribute`);
  }
  console.log('  PASS: all handoff/result panels closed by default');

  // 6. work-order-approval-statusがhandoff-result-strip内にある
  const approvalStatusPos = html.indexOf('id="work-order-approval-status"');
  assert.ok(approvalStatusPos > 0, 'work-order-approval-status must exist');
  assert.ok(approvalStatusPos > handoffResultPos && approvalStatusPos < projectRegistryPos,
    'work-order-approval-status must be inside handoff-result-strip');
  console.log('  PASS: work-order-approval-status moved to handoff-result-strip');

  // Regression checks
  assert.ok(html.includes('id="result-decision-details"'), 'result-decision-details must still exist');
  assert.ok(html.includes('id="shell-agent-activity"'), 'shell-agent-activity must still exist');
  assert.ok(html.includes('id="feed-running"'), 'feed-running must still exist for JS');
  assert.ok(html.includes('id="feed-waiting"'), 'feed-waiting must still exist for JS');
  assert.ok(html.includes('id="feed-human-gate"'), 'feed-human-gate must still exist for JS');
  assert.ok(html.includes('id="feed-selected"'), 'feed-selected must still exist for JS');
  assert.ok(html.includes('id="ai-roster"'), 'ai-roster panel must not be regressed');
  assert.ok(html.includes('id="project-focus-collapse"'), 'project-focus-collapse must not be regressed');
  assert.ok(html.includes('id="chat-input"'), 'chat-input must not be regressed');
  assert.ok(html.includes('id="chat-thread"'), 'chat-thread must not be regressed');
  console.log('  PASS: regressions clear');

  console.log('✅ v113.0.11 collapse layout smoke PASSED');
}

main().catch((error) => {
  console.error('✗ FAIL:', error && error.message ? error.message : error);
  process.exit(1);
});
