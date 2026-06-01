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
const tool   = require('../tools/task-runner-usage-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== task-runner-usage-console-pack smoke ===');

assert.ok(compareVersion(pkg.version, '13.0.0') >= 0, `package version must be 13.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 13.0.0 or later');

assert.ok(pkg.scripts['smoke:task-runner-usage-console-pack'], 'smoke:task-runner-usage-console-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:task-runner-usage-console'], 'pm-agent:task-runner-usage-console must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v11.5.0-release-record.md')),
  'v11.5.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/task-runner-usage-console.sample.json')),
  'fixture task-runner-usage-console.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '11.5.0', 'tool meta version must be 11.5.0');
console.log('  PASS: tool meta version 11.5.0');

const packet = tool.buildUsageConsole({
  projectName:   'test-project',
  repoPath:      '.',
  taskGoal:      'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  productLine:   'backoffice',
  taskType:      'docs',
  riskLevel:     'low',
  dataLevel:     'A',
  targetFiles:   ['README.md'],
  providerStatus: {},
  usageMode:     'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.runnerFunctionUsed, 'runnerFunctionUsed must be present');
console.log('  PASS: runnerFunctionUsed present');

assert.ok(packet.usageConsoleId, 'usageConsoleId must be present');
console.log('  PASS: usageConsoleId present');

assert.ok(packet.runnerPacket, 'runnerPacket must be present');
console.log('  PASS: runnerPacket present');

assert.ok(packet.providerPacketSummary, 'providerPacketSummary must be present');
console.log('  PASS: providerPacketSummary present');

assert.ok(packet.verificationSummary, 'verificationSummary must be present');
console.log('  PASS: verificationSummary present');

assert.ok(packet.approvalGateSummary,            'approvalGateSummary must be present');
assert.ok(packet.approvalGateSummary.commitGate, 'approvalGateSummary must include commitGate');
assert.ok(packet.approvalGateSummary.pushGate,   'approvalGateSummary must include pushGate');
assert.ok(packet.approvalGateSummary.tagGate,    'approvalGateSummary must include tagGate');
console.log('  PASS: approvalGateSummary includes commit/push/tag');

assert.strictEqual(packet.usagePassed, true, 'usagePassed must be true');
console.log('  PASS: usagePassed true');

assert.strictEqual(packet.noRealApiExecution, true, 'noRealApiExecution must be true');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.noRealFileEdit, true, 'noRealFileEdit must be true');
console.log('  PASS: no real file edit');

console.log('PASS: task-runner-usage-console-pack');
