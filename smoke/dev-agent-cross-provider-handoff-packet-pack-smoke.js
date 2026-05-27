'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0; const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/cross-provider-handoff-packet-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== cross-provider-handoff-packet-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.7.0') >= 0);
console.log('  PASS: package version 5.7.0 or later');

assert.ok(pkg.scripts['smoke:cross-provider-handoff-packet-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.7.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/cross-provider-handoff-packet.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.7.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({
  fromProvider: 'kosame', toProvider: 'claude',
  taskSummary: 'implement feature', dataLevel: 'A',
  completedSteps: ['design'], remainingSteps: ['impl']
});
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const valid = tool.validateHandoff({
  fromProvider: 'kosame', toProvider: 'claude',
  taskSummary: 'implement feature X', dataLevel: 'A',
  completedSteps: [], remainingSteps: ['impl']
});
assert.strictEqual(valid.valid, true);
console.log('  PASS: valid handoff passes');

const levelC = tool.validateHandoff({
  fromProvider: 'kosame', toProvider: 'claude',
  taskSummary: 'review feature', dataLevel: 'C',
  completedSteps: [], remainingSteps: []
});
assert.strictEqual(levelC.valid, false);
console.log('  PASS: level C to external blocked');

const secretBlocked = tool.validateHandoff({
  fromProvider: 'kosame', toProvider: 'gemini',
  taskSummary: 'read API key value', dataLevel: 'A',
  completedSteps: [], remainingSteps: []
});
assert.strictEqual(secretBlocked.valid, false);
console.log('  PASS: API key content blocked in handoff');

console.log('PASS: cross-provider-handoff-packet-pack');
