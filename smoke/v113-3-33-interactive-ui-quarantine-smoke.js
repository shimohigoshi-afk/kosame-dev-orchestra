#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { classifyPrompt } = require('../tools/kosame-prompt-classifier');
const { evaluateNoYesGate } = require('../tools/kosame-no-yes-gate');
const { createPipelineError } = require('../tools/kosame-pipeline-telemetry');

const ROOT = path.resolve(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

console.log('===== v113.3.33 interactive ui quarantine smoke =====');

const yesPrompt = 'Type YES to continue';
const yesHostBlocked = evaluateNoYesGate({
  text: yesPrompt,
  source: 'stdout',
  executionHost: 'claude-code-ui',
  executionSource: 'claude-code-ui',
  interactive: true,
});
assert.equal(yesHostBlocked.decision, 'blocked_interactive_host', 'claude-code-ui should be quarantined');
assert.equal(yesHostBlocked.userInputRequired, false, 'blocked interactive host must not request user input');
assert.equal(yesHostBlocked.interactiveHostBlocked, true, 'interactive host should be blocked');

const runnerPromptBlocked = evaluateNoYesGate({
  text: yesPrompt,
  source: 'stdout',
  executionHost: 'kosame-runner',
  executionSource: 'kosame-runner',
  safeSpawn: true,
});
assert.equal(runnerPromptBlocked.decision, 'blocked_by_interactive_prompt', 'runner prompt should be blocked without user wait');
assert.equal(runnerPromptBlocked.userInputRequired, false, 'runner prompt must not wait for user');
assert.equal(runnerPromptBlocked.promptType, 'yes_required', 'runner prompt should classify as yes_required');

const feedbackPrompt = classifyPrompt('How is Claude doing this session?', 'stdout');
assert.equal(feedbackPrompt.promptType, 'feedback_prompt', 'feedback prompt should be classified');

const manualHostBlocked = evaluateNoYesGate({
  text: 'Continue?',
  source: 'stderr',
  executionHost: 'manual-terminal',
  executionSource: 'manual-terminal',
  interactive: true,
});
assert.equal(manualHostBlocked.decision, 'blocked_interactive_host', 'manual terminal should be quarantined');

const error = createPipelineError({
  errorStage: 'spec-to-tasks.save',
  errorCode: 'HANDOFF_SAVE_FAILED',
  errorMessage: 'stage=spec-to-tasks.save / code=HANDOFF_SAVE_FAILED / message=blocked_interactive_host',
  workOrderId: 'wo-host-quarantine',
  attachmentCount: 4,
  attachmentIds: ['att-1', 'att-2', 'att-3', 'att-4'],
  manifestPath: '.kosame-handoff/attachments/wo-host-quarantine/manifest.json',
  route: 'zero-confirm',
  executionHost: 'claude-code-ui',
  executionHostAllowed: false,
  interactiveHostBlocked: true,
  noYesGateRuntime: false,
  safeSpawnActive: false,
  manualCodeUiAllowed: false,
  officialRoute: 'Console → Handoff → Runner',
  promptType: 'yes_required',
  promptOrigin: 'external_interactive_prompt',
  userInputRequired: false,
  blockedReason: 'blocked_interactive_host:claude-code-ui',
});
assert.equal(error.errorStage, 'spec-to-tasks.save', 'pipeline error should preserve stage');
assert.equal(error.errorCode, 'HANDOFF_SAVE_FAILED', 'pipeline error should preserve code');
assert.equal(error.userInputRequired, false, 'pipeline error must not require user input');

const html = read('public/kosame-live-cockpit.html');
assert.ok(html.includes('executionHost'), 'UI should expose execution host');
assert.ok(html.includes('interactiveHostBlocked'), 'UI should expose interactive quarantine');
assert.ok(html.includes('officialRoute'), 'UI should expose official route');

const decisionSource = read('tools/kosame-work-order-result-decision.js');
assert.ok(decisionSource.includes('blocked_interactive_host'), 'decision should support blocked interactive host');
assert.ok(decisionSource.includes('blocked_by_interactive_prompt'), 'decision should support blocked prompt');

console.log('  PASS: yes prompt → blocked without user wait');
console.log('  PASS: feedback prompt classified');
console.log('  PASS: pipeline error carries errorStage / errorCode / errorMessage');
