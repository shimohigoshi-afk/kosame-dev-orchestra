#!/usr/bin/env node
'use strict';

const assert = require('node:assert');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');

const pkg = require('../package.json');
const cli = require('../tools/kosame-operation-board-cli');

function pass(message) {
  console.log(`  PASS: ${message}`);
}

console.log('=== v110.5 operation board executable CLI smoke ===');

assert.ok(pkg.scripts.opboard, 'opboard script missing');
pass('opboard script exists');

assert.ok(pkg.scripts['kosame:board'], 'kosame:board script missing');
pass('kosame:board script exists');

assert.ok(fs.existsSync('tools/kosame-operation-board-cli.js'));
pass('CLI file exists');

assert.equal(cli.approvalLabel('none'), 'auto_proceed');
pass('gate=none is auto_proceed');

assert.equal(cli.approvalLabel('commit_wait'), 'human_approval_required');
assert.equal(cli.approvalLabel('push_wait'), 'human_approval_required');
assert.equal(cli.approvalLabel('tag_wait'), 'human_approval_required');
assert.equal(cli.approvalLabel('deploy_blocked'), 'human_approval_required');
assert.equal(cli.approvalLabel('secret_blocked'), 'human_approval_required');
assert.equal(cli.approvalLabel('budget_gate'), 'human_approval_required');
pass('danger gates require human approval');

const defaultBoard = cli.renderBoard({
  ...cli.DEFAULTS,
});

assert.ok(defaultBoard.includes('===== KOSAME Operation Board ====='));
assert.ok(defaultBoard.includes('TARGET  : ANESTY Board v87.0.11'));
assert.ok(defaultBoard.includes('STAGE   : implementing'));
assert.ok(defaultBoard.includes('GPT         : execution_assistant_only'));
assert.ok(defaultBoard.includes('DeepSeek    : HOLD sanitized_only'));
assert.ok(defaultBoard.includes('Kimi        : HOLD sanitized_only'));
assert.ok(defaultBoard.includes('Grok        : breakthrough_standby'));
assert.ok(defaultBoard.includes('DRY RUN : true'));
assert.ok(defaultBoard.includes('REAL PRODUCT ACTIONS EXECUTED : false'));
assert.ok(defaultBoard.includes('DANGEROUS ACTIONS DENIED      : true'));
pass('default board renders required safety/status fields');

const output = execFileSync(
  process.execPath,
  [
    'tools/kosame-operation-board-cli.js',
    '--target=KOSAME v110.5',
    '--stage=verify',
    '--gate=commit_wait',
    '--budget-used=1.25',
    '--budget-limit=10.00',
    '--next=verify → commit candidate',
    '--burden=WATCH',
  ],
  { encoding: 'utf8' }
);

assert.ok(output.includes('TARGET  : KOSAME v110.5'));
assert.ok(output.includes('STAGE   : verify'));
assert.ok(output.includes('GATE    : commit_wait (human_approval_required)'));
assert.ok(output.includes('BUDGET  : $1.25 / $10.00'));
assert.ok(output.includes('NEXT    : verify → commit candidate'));
assert.ok(output.includes('BURDEN  : WATCH'));
pass('CLI args are reflected in rendered board');

console.log('PASS: v110.5 operation board executable CLI');
