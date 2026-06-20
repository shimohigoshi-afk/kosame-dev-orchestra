#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { EXECUTOR_REGISTRY, validateExecutorPlan } = require('../tools/kosame-executor-registry');
const { assertExecutorPolicy } = require('../tools/kosame-executor-policy-kernel');

console.log('=== v113.3.0 executor policy smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:policy'], 'package wiring');
assert.ok(EXECUTOR_REGISTRY['claude-zero-confirm'], 'claude-zero-confirm must be registered');

const valid = assertExecutorPolicy({
  executorId: 'claude-zero-confirm',
  route: 'zero-confirm',
  command: ['claude', '--dangerously-skip-permissions', '-p'],
  stdio: 'pipe',
  shell: false,
  interactive: false,
  tty: false,
  prompt: '通常作業',
  autoResponder: true,
  promptClassifier: true,
  promptFirewall: true,
  safetyStopDetector: true,
  resultPOST: true,
});
assert.equal(valid.ok, true);

const blocked = validateExecutorPlan({
  executorId: 'raw-claude',
  route: 'zero-confirm',
  command: ['claude'],
  stdio: 'inherit',
  shell: true,
  interactive: true,
  tty: true,
});
assert.equal(blocked.ok, false);
assert.ok(String(blocked.reason || '').length > 0);

console.log('✅ v113.3.0 executor policy smoke PASSED');
