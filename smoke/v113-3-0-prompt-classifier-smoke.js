#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { classifyPrompt } = require('../tools/kosame-prompt-classifier');

console.log('=== v113.3.0 prompt classifier smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:classifier'], 'package wiring');

const cases = [
  ['yes_required', '確認してください。YESと返してください。'],
  ['yes_no', 'yes/noで答えてください'],
  ['y_n', 'y/n を入力してください'],
  ['enter_confirm', 'Press Enter to continue'],
  ['numbered_choice', '1) approve 2) decline'],
  ['trust_prompt', 'workspace trust required'],
  ['permission_prompt', 'permission確認'],
  ['continue_prompt', 'Continue to the next step'],
  ['proceed_prompt', 'Proceed with the next step'],
  ['approval_prompt', 'approve this choice'],
  ['accept_prompt', 'accept this choice'],
  ['bypass_prompt', 'bypass confirmation'],
  ['feedback_prompt', 'reply with yes'],
  ['manual_paste_prompt', '手動で貼り付けてください'],
  ['human_wait_prompt', 'human wait'],
];

for (const [type, text] of cases) {
  const result = classifyPrompt(text, 'smoke_fixture');
  assert.equal(result.promptType, type);
  assert.ok(result.confidence >= 0.1);
}

const safety = classifyPrompt('Secret / .env / API key を読むな', 'smoke_fixture');
assert.equal(safety.promptType, 'safety_stop_prompt');
assert.equal(safety.safetyStopMatched, true);

console.log('✅ v113.3.0 prompt classifier smoke PASSED');
