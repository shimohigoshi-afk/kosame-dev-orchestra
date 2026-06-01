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
const tool   = require('../tools/first-end-to-end-dry-run-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-end-to-end-dry-run-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '13.0.0') >= 0, `package version must be 13.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 13.0.0 or later');

assert.ok(pkg.scripts['smoke:first-end-to-end-dry-run-console-pack'], 'smoke:first-end-to-end-dry-run-console-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-end-to-end-dry-run-console'], 'pm-agent:first-end-to-end-dry-run-console must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v13.0.0-release-record.md')),
  'v13.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-end-to-end-dry-run-console.sample.json')),
  'fixture first-end-to-end-dry-run-console.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '13.0.0', 'tool meta version must be 13.0.0');
console.log('  PASS: tool meta version 13.0.0');

const packet = tool.buildEndToEndConsole({
  projectName:   'kosame-dev-orchestra',
  repoPath:      '.',
  taskGoal:      'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  productLine:   'backoffice',
  taskType:      'docs',
  riskLevel:     'low',
  dataLevel:     'A',
  targetFiles:   ['README.md'],
  providerStatus: {},
  currentStatus: 'git clean, smoke passing',
  endToEndMode:  'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(packet.endToEndPassed, true, 'endToEndPassed must be true');
console.log('  PASS: endToEndPassed true');

assert.ok(packet.usageConsolePacket, 'usageConsolePacket must be present');
console.log('  PASS: usageConsolePacket present');

assert.ok(packet.docsTaskPacket, 'docsTaskPacket must be present');
console.log('  PASS: docsTaskPacket present');

assert.ok(packet.claudeExecutionPromptPacket, 'claudeExecutionPromptPacket must be present');
console.log('  PASS: claudeExecutionPromptPacket present');

assert.ok(packet.finalApprovalPacket, 'finalApprovalPacket must be present');
console.log('  PASS: finalApprovalPacket present');

assert.ok(packet.verificationPlan, 'verificationPlan must be present');
console.log('  PASS: verificationPlan present');

assert.ok(packet.rollbackNote, 'rollbackNote must be present');
console.log('  PASS: rollbackNote present');

assert.ok(packet.providerPromptPackets, 'providerPromptPackets must be present');
console.log('  PASS: providerPromptPackets present');

assert.ok(packet.finalApprovalPacket.commitGate, 'finalApprovalPacket must include commitGate');
assert.ok(packet.finalApprovalPacket.pushGate,   'finalApprovalPacket must include pushGate');
assert.ok(packet.finalApprovalPacket.tagGate,    'finalApprovalPacket must include tagGate');
console.log('  PASS: finalApprovalPacket includes commit / push / tag gates');

assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'),  'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),   'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),    'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('secret'),    'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

assert.strictEqual(packet.endToEndSummary.readmeDocsTaskIncluded, true, 'README.md docs task must be included');
console.log('  PASS: README.md docs task is included');

assert.strictEqual(packet.endToEndSummary.noRealApiExecution, true, 'noRealApiExecution must be true');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.endToEndSummary.noRealFileEdit, true, 'noRealFileEdit must be true');
console.log('  PASS: no real file edit');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0,
  'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: first-end-to-end-dry-run-console-pack');
