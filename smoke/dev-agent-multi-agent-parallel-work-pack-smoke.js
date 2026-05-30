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
const tool   = require('../tools/multi-agent-parallel-work-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== multi-agent-parallel-work-pack smoke ===');

assert.ok(compareVersion(pkg.version, '10.0.0') >= 0, `package version must be 10.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 10.0.0 or later');

assert.ok(pkg.scripts['smoke:multi-agent-parallel-work-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v8.5.0-release-record.md')),
  'v8.5.0 release record must exist'
);
console.log('  PASS: v8.5.0 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/multi-agent-parallel-work.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '8.5.0', 'tool meta version must be 8.5.0');
console.log('  PASS: tool meta version 8.5.0');

// Basic packet
const packet = tool.buildPacket({
  planningPacket: {
    projectName:  'test-project',
    taskGoal:     'implement release note generator',
    productLine:  'backoffice',
    taskType:     'implementation'
  },
  availableAgents:      ['kosame', 'gemini', 'claude', 'grok'],
  parallelMode:         'full',
  maxConcurrentAgents:  3,
  dataLevel:            'A',
  riskLevel:            'low'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.parallelWorkId, 'parallelWorkId must be present');
console.log('  PASS: parallelWorkId present');

// agentTaskPackets includes Gemini/Claude/Grok/Kosame
assert.ok(Array.isArray(packet.agentTaskPackets), 'agentTaskPackets must be array');
const agentIds = packet.agentTaskPackets.map(p => p.agentId);
assert.ok(agentIds.includes('gemini'), 'agentTaskPackets must include Gemini');
assert.ok(agentIds.includes('claude'), 'agentTaskPackets must include Claude');
assert.ok(agentIds.includes('grok'),   'agentTaskPackets must include Grok');
assert.ok(agentIds.includes('kosame'), 'agentTaskPackets must include Kosame');
console.log('  PASS: parallel work packet includes Gemini/Claude/Grok/Kosame');

// Gemini/Grok cannot edit repo
const geminiPacket = packet.agentTaskPackets.find(p => p.agentId === 'gemini');
const grokPacket   = packet.agentTaskPackets.find(p => p.agentId === 'grok');
const claudePacket = packet.agentTaskPackets.find(p => p.agentId === 'claude');
assert.ok(geminiPacket, 'Gemini packet must exist');
assert.ok(grokPacket,   'Grok packet must exist');
assert.ok(claudePacket, 'Claude packet must exist');
assert.strictEqual(geminiPacket.canEditRepo, false, 'Gemini must not edit repo');
assert.strictEqual(grokPacket.canEditRepo,   false, 'Grok must not edit repo');
assert.strictEqual(claudePacket.canEditRepo, true,  'Claude must be able to edit repo');
console.log('  PASS: parallel work denies shared repo edits for Gemini/Grok');

// deniedSharedEdits
assert.ok(Array.isArray(packet.deniedSharedEdits), 'deniedSharedEdits must be array');
assert.ok(packet.deniedSharedEdits.length > 0, 'deniedSharedEdits must not be empty');
console.log('  PASS: deniedSharedEdits present');

// conflictPolicy
assert.ok(packet.conflictPolicy, 'conflictPolicy must be present');
assert.strictEqual(packet.conflictPolicy.simultaneousEditsPolicy, 'denied', 'simultaneousEditsPolicy must be denied');
console.log('  PASS: conflictPolicy denies simultaneous edits');

// executionOrder
assert.ok(Array.isArray(packet.executionOrder), 'executionOrder must be array');
console.log('  PASS: executionOrder present');

// blockedDangerousActions
assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'), 'git push must be blocked');
console.log('  PASS: blockedDangerousActions present');

// Level C blocks non-kosame agents
const levelCPacket = tool.buildPacket({
  planningPacket: { taskGoal: 'process health data', productLine: 'anesty_board', taskType: 'implementation' },
  availableAgents: ['kosame', 'gemini', 'claude', 'grok'],
  parallelMode: 'full', maxConcurrentAgents: 3, dataLevel: 'C', riskLevel: 'low'
});
const levelCGemini = levelCPacket.agentTaskPackets.find(p => p.agentId === 'gemini');
assert.ok(levelCGemini && levelCGemini.levelCBlocked, 'Level C must block Gemini prompt');
console.log('  PASS: Level C blocks external provider');

// recommendedNextAction
assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: multi-agent-parallel-work-pack');
