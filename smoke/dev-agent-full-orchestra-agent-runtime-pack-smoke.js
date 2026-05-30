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
const tool   = require('../tools/full-orchestra-agent-runtime-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== full-orchestra-agent-runtime-pack smoke ===');

// package version 10.0.0 or later
assert.ok(compareVersion(pkg.version, '10.0.0') >= 0, `package version must be 10.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 10.0.0 or later');

// scripts exist
assert.ok(pkg.scripts['smoke:full-orchestra-agent-runtime-pack'], 'smoke:full-orchestra-agent-runtime-pack script must exist');
assert.ok(pkg.scripts['pm-agent:full-orchestra-agent-runtime'],   'pm-agent:full-orchestra-agent-runtime script must exist');
console.log('  PASS: smoke:full-orchestra-agent-runtime-pack script exists');
console.log('  PASS: pm-agent:full-orchestra-agent-runtime script exists');

// Prior smoke scripts
assert.ok(pkg.scripts['smoke:full-orchestra-planning-layer-pack'],    'smoke:full-orchestra-planning-layer-pack must exist');
assert.ok(pkg.scripts['smoke:multi-agent-parallel-work-pack'],        'smoke:multi-agent-parallel-work-pack must exist');
assert.ok(pkg.scripts['smoke:orchestra-result-merger-pack'],          'smoke:orchestra-result-merger-pack must exist');
assert.ok(pkg.scripts['smoke:autonomous-repair-retry-board-pack'],    'smoke:autonomous-repair-retry-board-pack must exist');
console.log('  PASS: all v8.0-v9.5 smoke scripts exist');

// Release records
const versions = ['v8.0.0', 'v8.5.0', 'v9.0.0', 'v9.5.0', 'v10.0.0'];
for (const v of versions) {
  assert.ok(
    fs.existsSync(path.join(__dirname, `../docs/ai-dev-team/kosame-dev-orchestra-${v}-release-record.md`)),
    `${v} release record must exist`
  );
}
console.log('  PASS: all v8.0.0-v10.0.0 release records exist');

// Fixtures
const fixtures = [
  'full-orchestra-planning-layer.sample.json',
  'multi-agent-parallel-work.sample.json',
  'orchestra-result-merger.sample.json',
  'autonomous-repair-retry-board.sample.json',
  'full-orchestra-agent-runtime.sample.json'
];
for (const f of fixtures) {
  assert.ok(fs.existsSync(path.join(__dirname, `../fixtures/${f}`)), `fixture ${f} must exist`);
}
console.log('  PASS: all v8.0-v10.0 fixtures exist');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '10.0.0', 'tool meta version must be 10.0.0');
console.log('  PASS: tool meta version 10.0.0');

// Build full orchestra packet
const packet = tool.buildPacket({
  projectName:   'test-project',
  repoPath:      '.',
  taskGoal:      'implement release note generator',
  productLine:   'backoffice',
  taskType:      'implementation',
  riskLevel:     'low',
  dataLevel:     'A',
  currentStatus: 'git clean, smoke passing',
  geminiResult:  'Spec clarification complete. No concerns.',
  grokResult:    'Weakness analysis complete. No critical issues.',
  claudeResult:  'Implementation complete. All smoke tests pass. npm run verify: OK.',
  providerStatus: {}
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.orchestraId, 'orchestraId must be present');
console.log('  PASS: orchestraId present');

// planningPacket
assert.ok(packet.planningPacket, 'planningPacket must be present');
assert.ok(packet.planningPacket.planningId, 'planningPacket.planningId must be present');
console.log('  PASS: full orchestra runtime includes planningPacket');

// parallelWorkPacket
assert.ok(packet.parallelWorkPacket, 'parallelWorkPacket must be present');
assert.ok(packet.parallelWorkPacket.parallelWorkId, 'parallelWorkPacket.parallelWorkId must be present');
console.log('  PASS: full orchestra runtime includes parallelWorkPacket');

// mergedReviewPacket
assert.ok(packet.mergedReviewPacket, 'mergedReviewPacket must be present');
assert.ok(packet.mergedReviewPacket.mergerId, 'mergedReviewPacket.mergerId must be present');
assert.ok(packet.mergedReviewPacket.mergeDecisionPacket, 'mergedReviewPacket.mergeDecisionPacket must be present');
console.log('  PASS: full orchestra runtime includes mergedReviewPacket');

// repairRetryPacket
assert.ok(packet.repairRetryPacket, 'repairRetryPacket must be present');
assert.ok(packet.repairRetryPacket.repairBoardId, 'repairRetryPacket.repairBoardId must be present');
console.log('  PASS: full orchestra runtime includes repairRetryPacket');

// finalApprovalPacket
assert.ok(packet.finalApprovalPacket, 'finalApprovalPacket must be present');
const fap = packet.finalApprovalPacket;
assert.ok(fap.commitGate,  'finalApprovalPacket.commitGate must be present');
assert.ok(fap.pushGate,    'finalApprovalPacket.pushGate must be present');
assert.ok(fap.tagGate,     'finalApprovalPacket.tagGate must be present');
assert.ok(fap.deployGate,  'finalApprovalPacket.deployGate must be present');
assert.strictEqual(fap.commitGate.allowed, false, 'commitGate.allowed must be false');
assert.strictEqual(fap.pushGate.allowed,   false, 'pushGate.allowed must be false');
assert.strictEqual(fap.tagGate.allowed,    false, 'tagGate.allowed must be false');
assert.strictEqual(fap.deployGate.allowed, false, 'deployGate.allowed must be false');
console.log('  PASS: full orchestra runtime includes finalApprovalPacket');
console.log('  PASS: finalApprovalPacket includes commit/push/tag gates');

// blockedDangerousActions
assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'),  'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),   'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),    'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('secret') || packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

// parallel work — Gemini/Grok cannot edit repo
const ptp = packet.parallelWorkPacket.agentTaskPackets;
const geminiP = ptp.find(p => p.agentId === 'gemini');
const grokP   = ptp.find(p => p.agentId === 'grok');
assert.ok(geminiP && geminiP.canEditRepo === false, 'Gemini must not edit repo');
assert.ok(grokP   && grokP.canEditRepo   === false, 'Grok must not edit repo');
console.log('  PASS: parallel work denies shared repo edits for Gemini/Grok');

// Level C blocks external provider
const levelCPacket = tool.buildPacket({
  projectName: 'level-c-test', repoPath: '.', taskGoal: 'process health data',
  productLine: 'anesty_board', taskType: 'implementation', riskLevel: 'low', dataLevel: 'C',
  currentStatus: '', geminiResult: null, grokResult: null, claudeResult: null, providerStatus: {}
});
assert.strictEqual(levelCPacket.levelCBlocked, true, 'Level C must be blocked');
console.log('  PASS: Level C blocks external provider');

// API key blocked in prompts — claude prompt must mention not reading secrets
const claudeAgent = ptp.find(p => p.agentId === 'claude');
assert.ok(claudeAgent && /secret|env|api key/i.test(claudeAgent.prompt), 'Claude prompt must mention secret/env restriction');
console.log('  PASS: API key blocked (Claude prompt restricts secret reading)');

// product lines
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

// recommendedNextAction
assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

// mergeDecisionPacket noRealFileMerge
assert.strictEqual(packet.mergedReviewPacket.mergeDecisionPacket.noRealFileMerge, true, 'noRealFileMerge must be true');
console.log('  PASS: result merger does not claim real file merge');

// repair board creates repairInstructionPacket
assert.ok(packet.repairRetryPacket.repairInstructionPacket, 'repairInstructionPacket must be present in runtime');
console.log('  PASS: repair board creates repairInstructionPacket in runtime');

console.log('PASS: full-orchestra-agent-runtime-pack');
