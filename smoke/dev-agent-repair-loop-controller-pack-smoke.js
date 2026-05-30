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
const tool   = require('../tools/repair-loop-controller-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== repair-loop-controller-pack smoke ===');

assert.ok(compareVersion(pkg.version, '7.4.0') >= 0, `package version must be 7.4.0+, got ${pkg.version}`);
console.log('  PASS: package version 7.4.0 or later');

assert.ok(pkg.scripts['smoke:repair-loop-controller-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v7.4.0-release-record.md')),
  'release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/repair-loop-controller.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '7.4.0', 'tool meta version must be 7.4.0');
console.log('  PASS: tool meta version 7.4.0');

const packet = tool.buildPacket({
  failureType:   'syntax_error',
  errorOutput:   'SyntaxError: Unexpected token } at line 42',
  taskGoal:      'implement release note generator',
  taskType:      'implementation',
  productLine:   'backoffice',
  provider:      'claude',
  attempt:       1
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.repairId, 'repairId must be present');
assert.ok(packet.repairRoute, 'repairRoute must be present');
assert.ok(packet.repairPrompt, 'repairPrompt must be present');
assert.ok(Array.isArray(packet.repairSteps), 'repairSteps must be an array');
assert.ok(packet.repairSteps.length > 0, 'repairSteps must not be empty');
console.log('  PASS: repairId, repairRoute, repairPrompt, repairSteps present');

// syntax_error → claude
const syntaxPacket = tool.buildPacket({
  failureType: 'syntax_error', errorOutput: 'SyntaxError at line 5',
  taskGoal: 'fix syntax', taskType: 'repair', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.strictEqual(syntaxPacket.repairRoute.repairProvider, 'claude', `syntax_error must route to claude, got: ${syntaxPacket.repairRoute.repairProvider}`);
console.log('  PASS: repair loop routes syntax error to claude');

// verify_failure → claude
const verifyPacket = tool.buildPacket({
  failureType: 'verify_failure', errorOutput: 'AssertionError: expected PASS',
  taskGoal: 'fix verify', taskType: 'repair', productLine: 'backoffice',
  provider: 'gemini', attempt: 1
});
assert.strictEqual(verifyPacket.repairRoute.repairProvider, 'claude', `verify_failure must route to claude, got: ${verifyPacket.repairRoute.repairProvider}`);
console.log('  PASS: repair loop routes verify failure to claude');

// unclear_spec → kosame
const specPacket = tool.buildPacket({
  failureType: 'unclear_spec', errorOutput: 'Requirements unclear',
  taskGoal: 'implement unclear feature', taskType: 'implementation', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.strictEqual(specPacket.repairRoute.repairProvider, 'kosame', `unclear_spec must route to kosame, got: ${specPacket.repairRoute.repairProvider}`);
console.log('  PASS: repair loop routes unclear/spec issue to kosame');

// spec_issue → kosame
const specIssuePacket = tool.buildPacket({
  failureType: 'spec_issue', errorOutput: 'Conflicting requirements',
  taskGoal: 'implement spec', taskType: 'implementation', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.ok(
  specIssuePacket.repairRoute.repairProvider === 'kosame' || specIssuePacket.repairRoute.repairProvider === 'human',
  `spec_issue must route to kosame or human, got: ${specIssuePacket.repairRoute.repairProvider}`
);
console.log('  PASS: repair loop routes spec issue to kosame/human');

// provider_unavailable → fallback
const unavailPacket = tool.buildPacket({
  failureType: 'provider_unavailable', errorOutput: 'Provider claude is unavailable',
  taskGoal: 'implement feature', taskType: 'implementation', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.ok(
  unavailPacket.repairRoute.repairProvider !== 'claude',
  `provider_unavailable must route to fallback, not original provider. Got: ${unavailPacket.repairRoute.repairProvider}`
);
console.log('  PASS: repair loop routes provider unavailable to fallback provider');

// missing_file → claude
const missingPacket = tool.buildPacket({
  failureType: 'missing_file', errorOutput: 'Cannot find module ./tools/example.js',
  taskGoal: 'implement feature', taskType: 'implementation', productLine: 'backoffice',
  provider: 'gemini', attempt: 1
});
assert.strictEqual(missingPacket.repairRoute.repairProvider, 'claude', `missing_file must route to claude, got: ${missingPacket.repairRoute.repairProvider}`);
console.log('  PASS: repair loop routes missing_file to claude');

// safety_block → kosame/human
const safetyPacket = tool.buildPacket({
  failureType: 'safety_block', errorOutput: 'Safety policy violated',
  taskGoal: 'do unsafe thing', taskType: 'implementation', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.ok(
  safetyPacket.repairRoute.repairProvider === 'kosame' || safetyPacket.repairRoute.repairProvider === 'human',
  `safety_block must route to kosame or human, got: ${safetyPacket.repairRoute.repairProvider}`
);
console.log('  PASS: safety_block routes to kosame/human');

// human_approval_required → human
const humanPacket = tool.buildPacket({
  failureType: 'human_approval_required', errorOutput: 'Human approval needed',
  taskGoal: 'release deploy', taskType: 'release', productLine: 'backoffice',
  provider: 'claude', attempt: 1
});
assert.strictEqual(humanPacket.repairRoute.repairProvider, 'human', `human_approval_required must route to human, got: ${humanPacket.repairRoute.repairProvider}`);
console.log('  PASS: human_approval_required routes to human');

// blockedDangerousActions
assert.ok(Array.isArray(packet.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(packet.blockedDangerousActions.includes('git push'), 'git push must be blocked');
assert.ok(packet.blockedDangerousActions.includes('git tag'), 'git tag must be blocked');
assert.ok(packet.blockedDangerousActions.includes('deploy'), 'deploy must be blocked');
assert.ok(packet.blockedDangerousActions.includes('Secret value read'), 'secret must be blocked');
console.log('  PASS: blockedDangerousActions includes git push / git tag / deploy / secret');

assert.ok(typeof packet.recommendedNextAction === 'string', 'recommendedNextAction must be a string');
assert.ok(packet.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: repair-loop-controller-pack');
