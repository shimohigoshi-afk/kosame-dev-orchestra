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
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/provider-prompt-router-real-use-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== provider-prompt-router-real-use-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.1.0') >= 0, `package version must be 7.1.0+, got ${pkg.version}`);
console.log('  PASS: package version 7.1.0 or later');

assert.ok(pkg.scripts['smoke:provider-prompt-router-real-use-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.1.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/provider-prompt-router-real-use.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.1.0', 'tool meta version must be 7.1.0');
console.log('  PASS: tool meta version 7.1.0');

const packet = tool.buildPacket({
  taskType:          'implementation',
  productLine:       'backoffice',
  riskLevel:         'low',
  dataLevel:         'A',
  preferredProvider: null,
  taskGoal:          'implement release note generator'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.providerRoute, 'providerRoute must be present');
assert.ok(packet.providerRoute.selectedProvider, 'providerRoute.selectedProvider must be present');
console.log('  PASS: providerRoute selectedProvider present');

assert.ok(packet.promptPacket, 'promptPacket must be present');
assert.ok(packet.promptPacket.prompt, 'promptPacket.prompt must be present');
console.log('  PASS: promptPacket prompt present');

assert.ok(packet.safetyCheck, 'safetyCheck must be present');
assert.ok(packet.contextualGuidance, 'contextualGuidance must be present');
console.log('  PASS: safetyCheck and contextualGuidance present');

// implementation → claude
const implPacket = tool.buildPacket({ taskType: 'implementation', productLine: 'backoffice', riskLevel: 'low', dataLevel: 'A', taskGoal: 'implement feature' });
assert.strictEqual(implPacket.providerRoute.selectedProvider, 'claude', 'implementation must route to claude');
console.log('  PASS: implementation routes to claude');

// draft → gemini
const draftPacket = tool.buildPacket({ taskType: 'draft', productLine: 'backoffice', riskLevel: 'low', dataLevel: 'A', taskGoal: 'write draft doc' });
assert.strictEqual(draftPacket.providerRoute.selectedProvider, 'gemini', 'draft must route to gemini');
console.log('  PASS: draft routes to gemini');

// strategy → grok
const stratPacket = tool.buildPacket({ taskType: 'strategy', productLine: 'backoffice', riskLevel: 'low', dataLevel: 'A', taskGoal: 'plan breakthrough' });
assert.strictEqual(stratPacket.providerRoute.selectedProvider, 'grok', 'strategy must route to grok');
console.log('  PASS: strategy routes to grok');

// review → kosame
const reviewPacket = tool.buildPacket({ taskType: 'review', productLine: 'backoffice', riskLevel: 'low', dataLevel: 'A', taskGoal: 'final review' });
assert.ok(
  reviewPacket.providerRoute.selectedProvider === 'kosame' || reviewPacket.providerRoute.selectedProvider === 'human',
  `review must route to kosame or human, got: ${reviewPacket.providerRoute.selectedProvider}`
);
console.log('  PASS: review routes to kosame/human');

// Level C → kosame or human
const levelCPacket = tool.buildPacket({ taskType: 'implementation', productLine: 'backoffice', riskLevel: 'low', dataLevel: 'C', taskGoal: 'process data' });
assert.ok(
  levelCPacket.providerRoute.selectedProvider === 'kosame' || levelCPacket.providerRoute.selectedProvider === 'human',
  `Level C must route to kosame or human, got: ${levelCPacket.providerRoute.selectedProvider}`
);
console.log('  PASS: Level C blocks external provider');

// safety_dx and anesty_board product lines
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'), 'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'), 'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'), 'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

// prompt includes productLine guidance
const anestyPacket = tool.buildPacket({ taskType: 'implementation', productLine: 'anesty_board', riskLevel: 'low', dataLevel: 'A', taskGoal: 'implement feature' });
assert.ok(anestyPacket.contextualGuidance.productLineGuidance.includes('ANESTY'), 'anesty_board must show ANESTY guidance');
console.log('  PASS: anesty_board contextualGuidance present');

console.log('PASS: provider-prompt-router-real-use-pack');
