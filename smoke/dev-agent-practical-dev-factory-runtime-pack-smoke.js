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
const tool = require('../tools/practical-dev-factory-runtime-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== practical-dev-factory-runtime-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.0.0') >= 0, `package version must be 7.0.0+, got ${pkg.version}`);
console.log('  PASS: package version 7.0.0 or later');

assert.ok(pkg.scripts['smoke:practical-dev-factory-runtime-pack'], 'smoke script must exist');
console.log('  PASS: script exists');

assert.ok(pkg.scripts['pm-agent:practical-dev-factory-runtime'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.0.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/practical-dev-factory-runtime.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.0.0', 'tool meta version must be 7.0.0');
console.log('  PASS: tool meta version 7.0.0');

const packet = tool.buildPacket({
  projectName:       'test-project',
  repoPath:          '.',
  taskGoal:          'implement release note generator',
  productLine:       'backoffice',
  taskType:          'implementation',
  riskLevel:         'low',
  dataLevel:         'A',
  preferredProvider: null,
  currentStatus:     'git clean, smoke passing'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.runtimeId, 'runtimeId must be present');
console.log('  PASS: runtimeId present');

assert.ok(packet.normalizedTask, 'normalizedTask must be present');
assert.ok(packet.normalizedTask.taskGoal, 'normalizedTask.taskGoal must be present');
console.log('  PASS: normalizedTask present');

assert.ok(packet.realStatusSummary, 'realStatusSummary must be present');
assert.ok(packet.realStatusSummary.rawStatus, 'realStatusSummary.rawStatus must be present');
console.log('  PASS: realStatusSummary present');

assert.ok(packet.workBreakdown, 'workBreakdown must be present');
assert.ok(Array.isArray(packet.workBreakdown.phases), 'workBreakdown.phases must be an array');
assert.ok(packet.workBreakdown.phases.length > 0, 'workBreakdown.phases must not be empty');
console.log('  PASS: workBreakdown has phases');

assert.ok(packet.providerRoute, 'providerRoute must be present');
assert.ok(packet.providerRoute.selectedProvider, 'providerRoute.selectedProvider must be present');
console.log('  PASS: providerRoute selectedProvider present');

assert.ok(Array.isArray(packet.executionPackets), 'executionPackets must be an array');
assert.ok(packet.executionPackets.length > 0, 'executionPackets must not be empty');
assert.ok(packet.executionPackets[0].prompt, 'executionPackets[0] must have prompt');
console.log('  PASS: executionPackets includes prompt packets');

assert.ok(packet.verificationPlan, 'verificationPlan must be present');
assert.ok(Array.isArray(packet.verificationPlan.steps), 'verificationPlan.steps must be an array');
assert.ok(packet.verificationPlan.steps.length > 0, 'verificationPlan.steps must not be empty');
console.log('  PASS: verificationPlan has steps');

assert.ok(packet.repairLoopPlan, 'repairLoopPlan must be present');
assert.ok(packet.repairLoopPlan.enabled, 'repairLoopPlan.enabled must be true');
console.log('  PASS: repairLoopPlan present');

assert.ok(packet.humanApprovalPacket, 'humanApprovalPacket must be present');
const hap = packet.humanApprovalPacket;
assert.ok(hap.actionsRequiringApproval.includes('git commit'), 'humanApprovalPacket must include git commit gate');
assert.ok(hap.actionsRequiringApproval.includes('git push'),   'humanApprovalPacket must include git push gate');
assert.ok(hap.actionsRequiringApproval.includes('git tag'),    'humanApprovalPacket must include git tag gate');
console.log('  PASS: humanApprovalPacket includes commit/push/tag gates');

assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be an array');
assert.ok(packet.blockedDangerousActions.includes('git push'),          'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),           'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),            'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

const implRoute = tool.routeProvider('implementation', 'A', 'low', null, 'implement feature');
assert.strictEqual(implRoute.selectedProvider, 'claude', 'implementation must route to claude');
console.log('  PASS: implementation routes to claude');

const draftRoute = tool.routeProvider('draft', 'A', 'low', null, 'write draft document');
assert.strictEqual(draftRoute.selectedProvider, 'gemini', 'draft must route to gemini');
console.log('  PASS: draft routes to gemini');

const strategyRoute = tool.routeProvider('strategy', 'A', 'low', null, 'plan breakthrough design');
assert.strictEqual(strategyRoute.selectedProvider, 'grok', 'strategy must route to grok');
console.log('  PASS: strategy routes to grok');

const levelCRoute = tool.routeProvider('implementation', 'C', 'low', null, 'implement feature');
assert.ok(
  levelCRoute.selectedProvider === 'kosame' || levelCRoute.selectedProvider === 'human',
  `Level C must route to kosame or human, got: ${levelCRoute.selectedProvider}`
);
console.log('  PASS: Level C routes to kosame/human');

const criticalRoute = tool.routeProvider('implementation', 'A', 'critical', null, 'implement feature');
assert.ok(
  criticalRoute.selectedProvider === 'kosame' || criticalRoute.selectedProvider === 'human',
  `critical risk must route to kosame or human, got: ${criticalRoute.selectedProvider}`
);
console.log('  PASS: critical risk routes to kosame/human');

assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

const secretPacket = tool.buildPacket({
  projectName: 'secret-test',
  taskGoal:    'read customer data and API key from .env',
  taskType:    'implementation',
  productLine: 'backoffice',
  riskLevel:   'high',
  dataLevel:   'A'
});
assert.strictEqual(secretPacket.normalizedTask.safeForExternal, false, 'secret task must not be safe for external');
assert.ok(secretPacket.normalizedTask.hasBlockedKeyword, 'blocked keyword must be detected');
console.log('  PASS: secret/customer data blocked for external provider');

const anestyPacket = tool.buildPacket({
  projectName: 'anesty-test',
  taskGoal:    'implement ANESTY Board data view',
  productLine: 'anesty_board',
  taskType:    'implementation',
  riskLevel:   'medium',
  dataLevel:   'B'
});
assert.ok(anestyPacket.runtimeId, 'anesty_board packet must have runtimeId');
assert.ok(anestyPacket.workBreakdown.phases.length > 0, 'anesty_board workBreakdown must have phases');
console.log('  PASS: anesty_board packet builds correctly');

console.log('PASS: practical-dev-factory-runtime-pack');
