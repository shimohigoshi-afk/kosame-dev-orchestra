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
const tool   = require('../tools/first-practical-orchestra-task-runner-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-practical-orchestra-task-runner-pack smoke ===');

assert.ok(compareVersion(pkg.version, '11.0.0') >= 0, `package version must be 11.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 11.0.0 or later');

assert.ok(pkg.scripts['smoke:first-practical-orchestra-task-runner-pack'], 'smoke:first-practical-orchestra-task-runner-pack must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-practical-orchestra-task-runner'], 'pm-agent:first-practical-orchestra-task-runner must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v11.0.0-release-record.md')),
  'v11.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-practical-orchestra-task-runner.sample.json')),
  'fixture first-practical-orchestra-task-runner.sample.json must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '11.0.0', 'tool meta version must be 11.0.0');
console.log('  PASS: tool meta version 11.0.0');

const packet = tool.buildRunner({
  projectName:   'kosame-dev-orchestra',
  repoPath:      '.',
  taskGoal:      'KOSAME Dev Orchestra READMEにv10.0.0 Full Orchestra Agent Runtimeの説明を追加する',
  productLine:   'backoffice',
  taskType:      'docs',
  riskLevel:     'low',
  dataLevel:     'A',
  currentStatus: 'git clean, smoke passing',
  targetFiles:   ['README.md'],
  allowedFiles:  ['./tools/**', './smoke/**', './fixtures/**', './docs/ai-dev-team/**', './README.md'],
  deniedFiles:   ['./.env', './secrets/**', './credentials/**'],
  providerStatus: {},
  runMode:       'dry-run'
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(packet.runnerPassed, true, 'runnerPassed must be true');
console.log('  PASS: runnerPassed true');

assert.ok(packet.runtimeProbePacket, 'runtimeProbePacket must be present');
console.log('  PASS: runtimeProbePacket present');

assert.ok(packet.practicalTaskPacket, 'practicalTaskPacket must be present');
console.log('  PASS: practicalTaskPacket present');

assert.ok(packet.providerPromptPackets, 'providerPromptPackets must be present');
console.log('  PASS: providerPromptPackets present');

const ppp = packet.providerPromptPackets;
assert.ok(ppp.geminiPacket,        'providerPromptPackets must include geminiPacket');
assert.ok(ppp.grokPacket,          'providerPromptPackets must include grokPacket');
assert.ok(ppp.claudePacket,        'providerPromptPackets must include claudePacket');
assert.ok(ppp.kosamePacket,        'providerPromptPackets must include kosamePacket');
assert.ok(ppp.humanApprovalPacket, 'providerPromptPackets must include humanApprovalPacket');
console.log('  PASS: providerPromptPackets includes gemini / grok / claude / kosame / humanApproval');

const cp = ppp.claudePacket;
assert.ok(Array.isArray(cp.allowedFiles),   'claudePacket must include allowedFiles');
assert.ok(Array.isArray(cp.deniedFiles),    'claudePacket must include deniedFiles');
assert.ok(Array.isArray(cp.verifyCommands), 'claudePacket must include verifyCommands');
assert.ok(Array.isArray(cp.doneCriteria),   'claudePacket must include doneCriteria');
console.log('  PASS: claudePacket includes allowedFiles / deniedFiles / verifyCommands / doneCriteria');

assert.strictEqual(ppp.geminiPacket.canEditRepo, false, 'geminiPacket must not edit repo');
console.log('  PASS: geminiPacket does not edit repo');

assert.strictEqual(ppp.grokPacket.canEditRepo, false, 'grokPacket must not edit repo');
console.log('  PASS: grokPacket does not edit repo');

const hap = ppp.humanApprovalPacket;
assert.ok(hap.commitGate, 'humanApprovalPacket must include commitGate');
assert.ok(hap.pushGate,   'humanApprovalPacket must include pushGate');
assert.ok(hap.tagGate,    'humanApprovalPacket must include tagGate');
console.log('  PASS: humanApprovalPacket includes commit / push / tag gates');

assert.ok(packet.verificationPlan, 'verificationPlan must be present');
const vp = packet.verificationPlan;
assert.ok(Array.isArray(vp.steps), 'verificationPlan.steps must be array');
assert.ok(vp.steps.some(s => s.category === 'smoke'),      'verificationPlan must include smoke step');
assert.ok(vp.steps.some(s => s.category === 'verify'),     'verificationPlan must include verify step');
assert.ok(vp.steps.some(s => s.category === 'git status'), 'verificationPlan must include git status step');
console.log('  PASS: verificationPlan includes smoke / verify / git status checks');

assert.ok(packet.rollbackNote, 'rollbackNote must be present');
console.log('  PASS: rollbackNote present');

assert.ok(Array.isArray(packet.blockedDangerousActions),             'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'),  'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'),   'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'),    'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('secret'),    'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

assert.strictEqual(packet.practicalTaskPacket.noRealApiExecution, true, 'no real API execution');
console.log('  PASS: no real API execution');

assert.strictEqual(packet.practicalTaskPacket.noRealFileEdit, true, 'no real file edit');
console.log('  PASS: no real file edit');

assert.ok(typeof packet.recommendedNextAction === 'string' && packet.recommendedNextAction.length > 0, 'recommendedNextAction must be present');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: first-practical-orchestra-task-runner-pack');
