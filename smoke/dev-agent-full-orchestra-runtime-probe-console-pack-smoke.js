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
const tool   = require('../tools/full-orchestra-runtime-probe-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== full-orchestra-runtime-probe-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '11.0.0') >= 0, `package version must be 11.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 11.0.0 or later');

assert.ok(pkg.scripts['smoke:full-orchestra-runtime-probe-console-pack'], 'smoke:full-orchestra-runtime-probe-console-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:full-orchestra-runtime-probe-console'], 'pm-agent:full-orchestra-runtime-probe-console must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v10.5.0-release-record.md')),
  'v10.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/full-orchestra-runtime-probe-console.sample.json')),
  'fixture full-orchestra-runtime-probe-console.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '10.5.0', 'tool meta version must be 10.5.0');
console.log('  PASS: tool meta version 10.5.0');

const packet = tool.buildProbe({
  projectName:   'test-project',
  repoPath:      '.',
  taskGoal:      'probe full orchestra runtime',
  productLine:   'backoffice',
  taskType:      'implementation',
  riskLevel:     'low',
  dataLevel:     'A',
  currentStatus: 'git clean, smoke passing',
  geminiResult:  'Spec clarification complete. No concerns.',
  grokResult:    'Weakness analysis complete. No critical issues.',
  claudeResult:  'Implementation complete. All smoke tests pass.',
  providerStatus: {},
  probeMode:     'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(typeof tool.buildProbe === 'function', 'buildProbe function must exist');
console.log('  PASS: buildPacket function is used');

assert.ok(packet.probeId, 'probeId must be present');
console.log('  PASS: probeId present');

assert.strictEqual(packet.runtimeFunctionUsed, 'buildPacket', 'runtimeFunctionUsed must be buildPacket');
console.log('  PASS: runtimeFunctionUsed is buildPacket');

assert.ok(packet.inputSummary, 'inputSummary must be present');
console.log('  PASS: inputSummary present');

const requiredKeys = [
  'orchestraId', 'planningPacket', 'parallelWorkPacket',
  'mergedReviewPacket', 'repairRetryPacket', 'finalRuntimePacket', 'finalApprovalPacket'
];
assert.ok(packet.packetPresence, 'packetPresence must be present');
for (const key of requiredKeys) {
  assert.ok(key in packet.packetPresence, `packetPresence must have key: ${key}`);
}
console.log('  PASS: packetPresence has all required keys');

for (const key of requiredKeys) {
  assert.strictEqual(packet.packetPresence[key], true, `packetPresence.${key} must be true`);
}
console.log('  PASS: packetPresence all true');

assert.ok(packet.safetySummary, 'safetySummary must be present');
assert.strictEqual(packet.safetySummary.dryRun, true, 'safetySummary.dryRun must be true');
console.log('  PASS: safetySummary dryRun true');

assert.strictEqual(packet.safetySummary.humanApprovalRequired, true, 'safetySummary.humanApprovalRequired must be true');
console.log('  PASS: safetySummary humanApprovalRequired true');

assert.ok(packet.approvalGateSummary,              'approvalGateSummary must be present');
assert.ok(packet.approvalGateSummary.commitGate,   'approvalGateSummary must include commitGate');
assert.ok(packet.approvalGateSummary.pushGate,     'approvalGateSummary must include pushGate');
assert.ok(packet.approvalGateSummary.tagGate,      'approvalGateSummary must include tagGate');
console.log('  PASS: approvalGateSummary includes commit/push/tag');

assert.ok(Array.isArray(packet.blockedDangerousActions),              'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'),  'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),   'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),    'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('secret'),    'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

assert.strictEqual(packet.probePassed, true, 'probePassed must be true');
console.log('  PASS: probePassed true');

assert.ok(packet.runtimePacket, 'runtimePacket must be present');
console.log('  PASS: runtimePacket present');

assert.ok(packet.runtimePacket.finalApprovalPacket, 'runtimePacket must include finalApprovalPacket');
console.log('  PASS: runtimePacket includes finalApprovalPacket');

assert.ok(packet.runtimePacket.recommendedNextAction, 'runtimePacket must include recommendedNextAction');
console.log('  PASS: runtimePacket includes recommendedNextAction');

assert.strictEqual(packet.runtimePacket.dryRun, true, 'runtimePacket.dryRun must be true (no real API execution)');
console.log('  PASS: runtimePacket does not claim real API execution');

assert.strictEqual(
  packet.runtimePacket.mergedReviewPacket.mergeDecisionPacket.noRealFileMerge,
  true,
  'runtimePacket must not claim real file merge'
);
console.log('  PASS: runtimePacket does not claim real file merge');

console.log('PASS: full-orchestra-runtime-probe-console-pack');
