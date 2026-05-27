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
const tool = require('../tools/fallback-routing-decision-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== fallback-routing-decision-pack smoke ===');

assert.ok(compareVersion(pkg.version, '5.3.0') >= 0);
console.log('  PASS: package version 5.3.0 or later');

assert.ok(pkg.scripts['smoke:fallback-routing-decision-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v5.3.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/fallback-routing-decision.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '5.3.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ primary: 'gemini', providerStatus: { gemini: 'up' } });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const primary = tool.decideFallback('gemini', { gemini: 'up' });
assert.strictEqual(primary.provider, 'gemini');
console.log('  PASS: primary used when up');

const fallback = tool.decideFallback('gemini', { gemini: 'down', grok: 'up' });
assert.strictEqual(fallback.provider, 'grok');
console.log('  PASS: fallback to grok when gemini down');

const finalFallback = tool.decideFallback('gemini', { gemini: 'down', grok: 'down', kimi: 'down' });
assert.strictEqual(finalFallback.provider, 'kosame');
console.log('  PASS: final fallback to kosame');

const chain = tool.getFallbackChain('claude');
assert.ok(chain.includes('grok'));
console.log('  PASS: claude fallback chain includes grok');

console.log('PASS: fallback-routing-decision-pack');
