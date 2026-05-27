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
const tool = require('../tools/kosame-vp-work-assignment-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== kosame-vp-work-assignment-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.0.0') >= 0);
console.log('  PASS: package version 5.0.0 or later');

assert.ok(pkg.scripts['smoke:kosame-vp-work-assignment-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v4.9.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/kosame-vp-work-assignment-pack.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '4.9.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ task: { type: 'bulk draft', dataLevel: 'A', providerStatus: { gemini: 'up' } } });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

assert.ok(tool.FORBIDDEN_WITHOUT_APPROVAL.includes('git push'));
console.log('  PASS: git push gated');

assert.ok(tool.DATA_BOUNDARY.levelC_blocked.includes('API keys'));
console.log('  PASS: API keys blocked');

assert.strictEqual(tool.chooseProvider({ type: 'bulk draft', dataLevel: 'A', providerStatus: { gemini: 'up' } }).provider, 'gemini');
console.log('  PASS: Gemini bulk route');

assert.strictEqual(tool.chooseProvider({ type: 'implementation bugfix', dataLevel: 'A', providerStatus: { claude: 'up' } }).provider, 'claude');
console.log('  PASS: Claude implementation route');

assert.strictEqual(tool.chooseProvider({ type: 'strategy stuck', dataLevel: 'A', providerStatus: { grok: 'up' } }).provider, 'grok');
console.log('  PASS: Grok breakthrough route');

assert.strictEqual(tool.chooseProvider({ type: 'bulk draft', dataLevel: 'C', providerStatus: { gemini: 'up' } }).provider, 'kosame');
console.log('  PASS: Level C blocks external route');

console.log('PASS: kosame-vp-work-assignment-pack');

