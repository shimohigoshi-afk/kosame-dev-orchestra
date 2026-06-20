#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const pkg = require('../package.json');
const { createAutoResponderGateway } = require('../tools/kosame-auto-responder-gateway');

console.log('=== v113.3.0 auto responder smoke ===');
assert.ok(pkg.scripts['smoke:v113-3-0:auto-responder'], 'package wiring');

const gateway = createAutoResponderGateway({ retryLimit: 2 });
const yes = gateway.buildAutoResponse({ promptType: 'yes_required', recommendedInputType: 'yes', recommendedInputValue: 'yes\n' });
assert.equal(yes.valueType, 'yes');
assert.equal(yes.value, 'yes\n');

const yesNo = gateway.handlePromptChunk('Would you like to continue?', { source: 'stdout' });
assert.equal(yesNo.ok, true);
assert.equal(yesNo.autoRespond, true);

const safety = gateway.handlePromptChunk('Secret / .env / API key', { source: 'stderr' });
assert.equal(safety.blocked, true);
assert.equal(safety.safetyStop, true);

const fakeChild = { stdin: { writes: [], write(v) { this.writes.push(v); } } };
const send = gateway.sendAutoResponse(fakeChild, { value: 'YES\n', valueType: 'yes' });
assert.equal(send.ok, true);
assert.equal(fakeChild.stdin.writes[0], 'YES\n');

console.log('✅ v113.3.0 auto responder smoke PASSED');
