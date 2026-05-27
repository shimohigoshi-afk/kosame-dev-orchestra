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
const tool = require('../tools/dev-factory-mvp-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-factory-mvp-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.0.0') >= 0);
console.log('  PASS: package version 6.0.0 or later');

assert.ok(pkg.scripts['smoke:dev-factory-mvp-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.0.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/dev-factory-mvp.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.0.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({
  projectName: 'test-project',
  repoPath: '.',
  taskGoal: 'implement release note generator',
  productLine: 'backoffice',
  riskLevel: 'low',
  preferredProviders: ['claude', 'gemini']
});

assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

assert.ok(packet.workBreakdown);
assert.ok(Array.isArray(packet.workBreakdown.phases));
console.log('  PASS: workBreakdown has phases');

assert.ok(packet.providerAssignments);
assert.ok(packet.providerAssignments.primary);
console.log('  PASS: providerAssignments present');

assert.ok(packet.sanitizedPromptPackets);
assert.strictEqual(typeof packet.sanitizedPromptPackets.sanitized, 'boolean');
console.log('  PASS: sanitizedPromptPackets present');

assert.ok(packet.verificationPlan);
assert.ok(Array.isArray(packet.verificationPlan.steps));
console.log('  PASS: verificationPlan has steps');

assert.ok(packet.humanApprovalPacket);
assert.ok(packet.humanApprovalPacket.note.includes('じゅんやさん'));
console.log('  PASS: humanApprovalPacket note correct');

assert.ok(Array.isArray(packet.blockedDangerousActions));
assert.ok(packet.blockedDangerousActions.includes('git push'));
console.log('  PASS: git push is blocked dangerous action');

assert.ok(typeof packet.recommendedNextAction === 'string');
console.log('  PASS: recommendedNextAction present');

const secretTask = tool.buildPacket({
  projectName: 'secret-test',
  taskGoal: 'read customer data and API key',
  productLine: 'backoffice',
  riskLevel: 'high'
});
assert.strictEqual(secretTask.sanitizedPromptPackets.sanitized, false);
assert.ok(secretTask.sanitizedPromptPackets.blockedKeywords.length > 0);
console.log('  PASS: customer data and API key blocked');

const productLines = tool.PRODUCT_LINES;
assert.ok(productLines.includes('anesty_board'));
assert.ok(productLines.includes('sales_dx'));
console.log('  PASS: product lines include anesty_board and sales_dx');

const wb = tool.buildWorkBreakdown('implement X', 'ai_bot');
const releasePhase = wb.phases.find(p => p.phase === 'release');
assert.strictEqual(releasePhase.owner, 'human');
assert.strictEqual(releasePhase.requiresHumanApproval, true);
console.log('  PASS: release phase owner is human with approval');

const approvalPkt = tool.createHumanApprovalPacket({ projectName: 'test', productLine: 'ai_bot', riskLevel: 'low' });
assert.strictEqual(approvalPkt.humanApprovalRequired, true);
assert.ok(approvalPkt.actionsRequiringApproval.includes('git commit'));
console.log('  PASS: human approval packet has git commit');

console.log('PASS: dev-factory-mvp-pack');
