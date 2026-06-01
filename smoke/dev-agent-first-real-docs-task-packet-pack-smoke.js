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
const tool   = require('../tools/first-real-docs-task-packet-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-docs-task-packet-pack smoke ===');

assert.ok(compareVersion(pkg.version, '13.0.0') >= 0, `package version must be 13.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 13.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-docs-task-packet-pack'], 'smoke:first-real-docs-task-packet-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-docs-task-packet'], 'pm-agent:first-real-docs-task-packet must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v12.0.0-release-record.md')),
  'v12.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-real-docs-task-packet.sample.json')),
  'fixture first-real-docs-task-packet.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '12.0.0', 'tool meta version must be 12.0.0');
console.log('  PASS: tool meta version 12.0.0');

const packet = tool.buildDocsTaskPacket({
  taskId:       'docs-001',
  projectName:  'kosame-dev-orchestra',
  repoPath:     '.',
  taskGoal:     'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  productLine:  'backoffice',
  taskType:     'docs',
  riskLevel:    'low',
  dataLevel:    'A',
  targetFiles:  ['README.md'],
  currentStatus: 'git clean'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.docsTaskPacketId, 'docsTaskPacketId must be present');
console.log('  PASS: docsTaskPacketId present');

assert.ok(packet.normalizedDocsTask, 'normalizedDocsTask must be present');
console.log('  PASS: normalizedDocsTask present');

assert.ok(Array.isArray(packet.targetFilePlan) && packet.targetFilePlan.some(f => f.file === 'README.md'),
  'targetFiles must include README.md');
console.log('  PASS: targetFiles include README.md');

assert.ok(packet.allowedEditPlan && packet.allowedEditPlan.files.some(f => f.includes('README')),
  'allowedFiles must include README.md');
console.log('  PASS: allowedFiles include README.md');

assert.ok(packet.deniedEditPlan && packet.deniedEditPlan.files.some(f => f.includes('.env')),
  'deniedFiles must include .env');
console.log('  PASS: deniedFiles include .env');

assert.ok(packet.providerPromptPackets, 'providerPromptPackets must be present');
console.log('  PASS: providerPromptPackets present');

assert.ok(packet.verificationPlan, 'verificationPlan must be present');
console.log('  PASS: verificationPlan present');

assert.ok(packet.approvalPacket,              'approvalPacket must be present');
assert.ok(packet.approvalPacket.commitGate,   'approvalPacket must include commitGate');
assert.ok(packet.approvalPacket.pushGate,     'approvalPacket must include pushGate');
assert.ok(packet.approvalPacket.tagGate,      'approvalPacket must include tagGate');
console.log('  PASS: approvalPacket includes commit/push/tag gates');

assert.ok(packet.rollbackNote, 'rollbackNote must be present');
console.log('  PASS: rollbackNote present');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0,
  'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

assert.strictEqual(packet.noRealApiExecution, true, 'noRealApiExecution must be true');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.noRealFileEdit, true, 'noRealFileEdit must be true');
console.log('  PASS: no real file edit');

console.log('PASS: first-real-docs-task-packet-pack');
