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
const tool   = require('../tools/full-orchestra-planning-layer-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== full-orchestra-planning-layer-pack smoke ===');

assert.ok(compareVersion(pkg.version, '10.0.0') >= 0, `package version must be 10.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 10.0.0 or later');

assert.ok(pkg.scripts['smoke:full-orchestra-planning-layer-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v8.0.0-release-record.md')),
  'v8.0.0 release record must exist'
);
console.log('  PASS: v8.0.0 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/full-orchestra-planning-layer.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '8.0.0', 'tool meta version must be 8.0.0');
console.log('  PASS: tool meta version 8.0.0');

// Basic packet
const packet = tool.buildPacket({
  projectName:     'test-project',
  repoPath:        '.',
  taskGoal:        'implement release note generator',
  productLine:     'backoffice',
  taskType:        'implementation',
  riskLevel:       'low',
  dataLevel:       'A',
  currentStatus:   'git clean',
  requestedAgents: ['kosame', 'gemini', 'claude', 'grok', 'human']
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.planningId, 'planningId must be present');
console.log('  PASS: planningId present');

// Agent roles
assert.ok(Array.isArray(packet.agentRoles), 'agentRoles must be an array');
assert.ok(packet.agentRoles.length > 0, 'agentRoles must not be empty');
const agentIds = packet.agentRoles.map(r => r.agentId);
assert.ok(agentIds.includes('gemini'), 'agentRoles must include Gemini');
assert.ok(agentIds.includes('claude'), 'agentRoles must include Claude');
assert.ok(agentIds.includes('grok'),   'agentRoles must include Grok');
assert.ok(agentIds.includes('kosame'), 'agentRoles must include Kosame');
console.log('  PASS: planning packet has agent roles (gemini/claude/grok/kosame)');

// Work lanes
assert.ok(Array.isArray(packet.workLanes), 'workLanes must be array');
console.log('  PASS: workLanes present');

// Safety boundary
assert.ok(packet.safetyBoundary, 'safetyBoundary must be present');
assert.ok(typeof packet.safetyBoundary.repoEditOwner === 'string', 'repoEditOwner must be string');
console.log('  PASS: safetyBoundary present');

// Approval gates
assert.ok(Array.isArray(packet.approvalGates), 'approvalGates must be array');
const gateNames = packet.approvalGates.map(g => g.gate);
assert.ok(gateNames.includes('commit_gate'), 'commit_gate must be in approvalGates');
assert.ok(gateNames.includes('push_gate'),   'push_gate must be in approvalGates');
assert.ok(gateNames.includes('tag_gate'),    'tag_gate must be in approvalGates');
console.log('  PASS: approvalGates includes commit/push/tag gates');

// blockedDangerousActions
assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'), 'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),  'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),   'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('secret') || packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

// Level C blocks external providers
const levelCPacket = tool.buildPacket({
  projectName: 'level-c-test', repoPath: '.', taskGoal: 'process health data',
  productLine: 'anesty_board', taskType: 'implementation', riskLevel: 'low', dataLevel: 'C',
  currentStatus: '', requestedAgents: ['kosame','gemini','claude','grok','human']
});
const levelCGemini = levelCPacket.agentRoles.find(r => r.agentId === 'gemini');
assert.ok(levelCGemini && levelCGemini.blockedByDataLevel, 'Level C must block Gemini');
console.log('  PASS: Level C blocks external provider (Gemini)');

// Product lines
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

// recommendedNextAction
assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: full-orchestra-planning-layer-pack');
