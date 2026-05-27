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
const tool = require('../tools/provider-prompt-router-cli-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-prompt-router-cli-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.5.0') >= 0);
console.log('  PASS: package version 6.5.0 or later');

assert.ok(pkg.scripts['smoke:provider-prompt-router-cli-pack']);
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:provider-prompt-router']);
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.5.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-prompt-router-cli.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.5.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({
  taskType: 'implementation', productLine: 'backoffice',
  riskLevel: 'low', dataLevel: 'A',
  preferredProvider: null, goal: 'implement release note generator'
});
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

assert.ok(packet.selectedProvider);
console.log('  PASS: selectedProvider present');

assert.ok(Array.isArray(packet.fallbackProviders));
console.log('  PASS: fallbackProviders is array');

assert.ok(packet.promptPacket && packet.promptPacket.prompt);
console.log('  PASS: promptPacket has prompt');

assert.ok(packet.safetyBoundary);
console.log('  PASS: safetyBoundary present');

assert.ok(packet.verificationPlan);
assert.ok(Array.isArray(packet.verificationPlan.steps));
console.log('  PASS: verificationPlan has steps');

assert.ok(Array.isArray(packet.blockedActions));
assert.ok(packet.blockedActions.includes('git push'));
console.log('  PASS: git push is blocked action');

assert.ok(typeof packet.recommendedNextAction === 'string');
console.log('  PASS: recommendedNextAction present');

const implRoute = tool.selectProvider({ taskType: 'implementation', dataLevel: 'A', riskLevel: 'low' });
assert.strictEqual(implRoute.provider, 'claude');
console.log('  PASS: implementation routes to claude');

const draftRoute = tool.selectProvider({ taskType: 'draft', dataLevel: 'A', riskLevel: 'low' });
assert.strictEqual(draftRoute.provider, 'gemini');
console.log('  PASS: draft routes to gemini');

const strategyRoute = tool.selectProvider({ taskType: 'strategy', dataLevel: 'A', riskLevel: 'low' });
assert.strictEqual(strategyRoute.provider, 'grok');
console.log('  PASS: strategy routes to grok');

const levelCRoute = tool.selectProvider({ taskType: 'implementation', dataLevel: 'C', riskLevel: 'low' });
assert.strictEqual(levelCRoute.provider, 'kosame');
console.log('  PASS: level C routes to kosame');

const criticalRoute = tool.selectProvider({ taskType: 'implementation', dataLevel: 'A', riskLevel: 'critical' });
assert.strictEqual(criticalRoute.provider, 'kosame');
console.log('  PASS: critical risk routes to kosame');

const safeCheck = tool.checkSafetyBoundary('implement feature', 'A', 'gemini');
assert.strictEqual(safeCheck.safe, true);
console.log('  PASS: safe goal passes boundary');

const apiKeyBlocked = tool.checkSafetyBoundary('read API key value', 'A', 'gemini');
assert.strictEqual(apiKeyBlocked.safe, false);
console.log('  PASS: API key blocked for gemini');

const levelBForGemini = tool.checkSafetyBoundary('code review', 'B', 'gemini');
assert.strictEqual(levelBForGemini.safe, false);
console.log('  PASS: level B blocked for gemini (max A)');

const fallbacks = tool.buildFallbacks('claude', 'A');
assert.ok(fallbacks.includes('grok'));
console.log('  PASS: claude fallback chain includes grok');

console.log('PASS: provider-prompt-router-cli-pack');
