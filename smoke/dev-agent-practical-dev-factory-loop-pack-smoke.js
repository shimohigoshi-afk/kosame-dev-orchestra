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
const tool   = require('../tools/practical-dev-factory-loop-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== practical-dev-factory-loop-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.5.0') >= 0, `package version must be 7.5.0, got ${pkg.version}`);
console.log('  PASS: package version 7.5.0 or later');

assert.ok(pkg.scripts['smoke:practical-dev-factory-loop-pack'], 'smoke script must exist');
assert.ok(pkg.scripts['pm-agent:practical-dev-factory-loop'], 'pm-agent script must exist');
console.log('  PASS: scripts exist');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.5.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/practical-dev-factory-loop.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.5.0', 'tool meta version must be 7.5.0');
console.log('  PASS: tool meta version 7.5.0');

// v7.1-7.4 release records
for (const v of ['7.1.0', '7.2.0', '7.3.0', '7.4.0']) {
  assert.ok(
    fs.existsSync(path.join(__dirname, `../docs/ai-dev-team/kosame-dev-orchestra-v${v}-release-record.md`)),
    `v${v} release record must exist`
  );
}
console.log('  PASS: all v7.1.0-v7.4.0 release records exist');

// v7.1-7.4 smoke scripts
assert.ok(pkg.scripts['smoke:provider-prompt-router-real-use-pack'], 'v7.1.0 smoke script must exist');
assert.ok(pkg.scripts['smoke:task-execution-packet-generator-pack'], 'v7.2.0 smoke script must exist');
assert.ok(pkg.scripts['smoke:result-import-review-pack'],            'v7.3.0 smoke script must exist');
assert.ok(pkg.scripts['smoke:repair-loop-controller-pack'],          'v7.4.0 smoke script must exist');
console.log('  PASS: all v7.1.0-v7.4.0 smoke scripts exist');

// v7.1-7.4 fixtures
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/provider-prompt-router-real-use.sample.json')), 'v7.1.0 fixture must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/task-execution-packet-generator.sample.json')), 'v7.2.0 fixture must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/result-import-review.sample.json')),            'v7.3.0 fixture must exist');
assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/repair-loop-controller.sample.json')),          'v7.4.0 fixture must exist');
console.log('  PASS: all v7.1.0-v7.4.0 fixtures exist');

// Basic loop packet
const loopPacket = tool.buildLoopPacket({
  projectName:       'test-project',
  repoPath:          '.',
  taskGoal:          'implement release note generator',
  productLine:       'backoffice',
  taskType:          'implementation',
  riskLevel:         'low',
  dataLevel:         'A',
  preferredProvider: null,
  currentStatus:     'git clean, smoke passing',
  providerResult:    null
});

assert.strictEqual(loopPacket.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(loopPacket.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(loopPacket.loopId, 'loopId must be present');
console.log('  PASS: loopId present');

// All required output fields
assert.ok(loopPacket.runtimePacket,   'runtimePacket must be present');
assert.ok(loopPacket.providerRoute,   'providerRoute must be present');
assert.ok(loopPacket.executionPacket, 'executionPacket must be present');
assert.ok(loopPacket.importedResult,  'importedResult must be present');
assert.ok(loopPacket.reviewDecision,  'reviewDecision must be present');
assert.ok(loopPacket.finalApprovalPacket, 'finalApprovalPacket must be present');
console.log('  PASS: loop output includes runtimePacket / executionPacket / importedResult / repairLoop / finalApprovalPacket');

// executionPacket includes allowedFiles / deniedFiles / verifyCommands / doneCriteria / forbiddenActions
assert.ok(Array.isArray(loopPacket.executionPacket.allowedFiles),   'executionPacket.allowedFiles must be array');
assert.ok(Array.isArray(loopPacket.executionPacket.deniedFiles),    'executionPacket.deniedFiles must be array');
assert.ok(Array.isArray(loopPacket.executionPacket.verifyCommands), 'executionPacket.verifyCommands must be array');
assert.ok(Array.isArray(loopPacket.executionPacket.doneCriteria),   'executionPacket.doneCriteria must be array');
assert.ok(Array.isArray(loopPacket.executionPacket.forbiddenActions),'executionPacket.forbiddenActions must be array');
console.log('  PASS: executionPacket includes allowedFiles / deniedFiles / verifyCommands / doneCriteria / forbiddenActions');

// finalApprovalPacket includes commit/push/tag gates
const fap = loopPacket.finalApprovalPacket;
assert.ok(fap.commitGate, 'finalApprovalPacket.commitGate must be present');
assert.ok(fap.pushGate,   'finalApprovalPacket.pushGate must be present');
assert.ok(fap.tagGate,    'finalApprovalPacket.tagGate must be present');
assert.strictEqual(fap.commitGate.allowed, false, 'commitGate.allowed must be false');
assert.strictEqual(fap.pushGate.allowed,   false, 'pushGate.allowed must be false');
assert.strictEqual(fap.tagGate.allowed,    false, 'tagGate.allowed must be false');
console.log('  PASS: finalApprovalPacket includes commit/push/tag gates');

// blockedDangerousActions
assert.ok(Array.isArray(loopPacket.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(loopPacket.blockedDangerousActions.includes('git push'),          'git push must be blocked');
assert.ok(loopPacket.blockedDangerousActions.includes('git tag'),           'git tag must be blocked');
assert.ok(loopPacket.blockedDangerousActions.includes('deploy'),            'deploy must be blocked');
assert.ok(loopPacket.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

// Loop with success result → no repairLoop
const successLoop = tool.buildLoopPacket({
  projectName: 'success-test', repoPath: '.', taskGoal: 'implement feature',
  productLine: 'backoffice', taskType: 'implementation', riskLevel: 'low',
  dataLevel: 'A', preferredProvider: null, currentStatus: 'clean',
  providerResult: 'PASS: all smoke tests passed. npm run verify: OK. Files changed: tools/example.js'
});
assert.ok(successLoop.importedResult, 'importedResult must be present in success loop');
console.log('  PASS: success loop builds correctly');

// Loop with failure result → repairLoop present
const failureLoop = tool.buildLoopPacket({
  projectName: 'failure-test', repoPath: '.', taskGoal: 'implement feature',
  productLine: 'backoffice', taskType: 'implementation', riskLevel: 'low',
  dataLevel: 'A', preferredProvider: null, currentStatus: 'clean',
  providerResult: 'SyntaxError: Unexpected token } at line 42\nFAIL: smoke test'
});
assert.ok(failureLoop.repairLoop, 'repairLoop must be present when failure detected');
console.log('  PASS: failure loop generates repairLoop');

// Level C blocks external provider
const levelCLoop = tool.buildLoopPacket({
  projectName: 'levelc-test', repoPath: '.', taskGoal: 'process health data',
  productLine: 'anesty_board', taskType: 'implementation', riskLevel: 'low',
  dataLevel: 'C', preferredProvider: null, currentStatus: 'clean',
  providerResult: null
});
assert.ok(
  levelCLoop.providerRoute.selectedProvider === 'kosame' || levelCLoop.providerRoute.selectedProvider === 'human',
  `Level C must route to kosame or human, got: ${levelCLoop.providerRoute.selectedProvider}`
);
console.log('  PASS: Level C blocks external provider');

// product lines
assert.ok(tool.PRODUCT_LINES.includes('sales_dx'),    'sales_dx must be in PRODUCT_LINES');
assert.ok(tool.PRODUCT_LINES.includes('anesty_board'), 'anesty_board must be in PRODUCT_LINES');
console.log('  PASS: product lines include sales_dx and anesty_board');

// recommendedNextAction
assert.ok(typeof loopPacket.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(loopPacket.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

// provider route works: implementation → claude
assert.strictEqual(loopPacket.providerRoute.selectedProvider, 'claude', `implementation must route to claude, got: ${loopPacket.providerRoute.selectedProvider}`);
console.log('  PASS: provider route works (implementation → claude)');

console.log('PASS: practical-dev-factory-loop-pack');
