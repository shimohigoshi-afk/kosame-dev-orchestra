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
const tool = require('../tools/provider-pool-policy-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-pool-policy-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.1.0') >= 0);
console.log('  PASS: package version 5.1.0 or later');

assert.ok(pkg.scripts['smoke:provider-pool-policy-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.1.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-pool-policy.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.1.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ providers: ['kosame', 'claude', 'gemini'] });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

assert.deepStrictEqual(tool.getPool('primary'), ['kosame', 'claude', 'gemini']);
console.log('  PASS: primary pool correct');

const result = tool.evaluatePool(['kosame', 'claude', 'gemini']);
assert.strictEqual(result.compliant, true);
console.log('  PASS: compliant pool passes');

const exceeded = tool.evaluatePool(['claude', 'gemini', 'grok']);
assert.strictEqual(exceeded.exceedsLimit, true);
console.log('  PASS: exceeding limit detected');

console.log('PASS: provider-pool-policy-pack');
