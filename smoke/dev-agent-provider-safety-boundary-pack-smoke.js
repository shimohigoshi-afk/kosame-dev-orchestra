'use strict';

function compareVersion(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const tool = require('../tools/provider-safety-boundary-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-safety-boundary-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.2.0') >= 0);
console.log('  PASS: package version 5.2.0 or later');

assert.ok(pkg.scripts['smoke:provider-safety-boundary-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.2.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-safety-boundary.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.2.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ provider: 'gemini', dataLevel: 'A' });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const safe = tool.checkSafety('gemini', 'A', 'generic code review');
assert.strictEqual(safe.safe, true);
console.log('  PASS: safe input passes gemini');

const unsafe = tool.checkSafety('gemini', 'C', 'customer data review');
assert.strictEqual(unsafe.safe, false);
console.log('  PASS: level C blocked for gemini');

const secretBlocked = tool.checkSafety('claude', 'A', 'check API key value');
assert.strictEqual(secretBlocked.safe, false);
console.log('  PASS: API key blocked');

assert.ok(tool.BLOCKED_INPUTS.includes('API key'));
console.log('  PASS: API key in blocked list');

console.log('PASS: provider-safety-boundary-pack');
