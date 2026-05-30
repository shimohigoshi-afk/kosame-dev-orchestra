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
const tool   = require('../tools/autonomous-repair-retry-board-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== autonomous-repair-retry-board-pack smoke ===');

assert.ok(compareVersion(pkg.version, '10.0.0') >= 0, `package version must be 10.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 10.0.0 or later');

assert.ok(pkg.scripts['smoke:autonomous-repair-retry-board-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v9.5.0-release-record.md')),
  'v9.5.0 release record must exist'
);
console.log('  PASS: v9.5.0 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/autonomous-repair-retry-board.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '9.5.0', 'tool meta version must be 9.5.0');
console.log('  PASS: tool meta version 9.5.0');

// syntax_error → routes to claude
const syntaxPacket = tool.buildPacket({
  failureType: 'syntax_error',
  failedStep: 'implementation',
  errorSummary: 'SyntaxError: Unexpected token } at line 42',
  providerStatus: {}, previousAttempts: 0, riskLevel: 'low', dataLevel: 'A'
});

assert.strictEqual(syntaxPacket.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.ok(syntaxPacket.repairBoardId, 'repairBoardId must be present');
console.log('  PASS: repairBoardId present');

assert.ok(syntaxPacket.repairInstructionPacket, 'repairInstructionPacket must be present');
console.log('  PASS: repair board creates repairInstructionPacket');

assert.strictEqual(syntaxPacket.retryTargetAgent.agent, 'claude', `syntax_error must route to claude, got: ${syntaxPacket.retryTargetAgent.agent}`);
console.log('  PASS: repair board routes syntax_error to Claude');

// unclear_spec → routes to kosame
const unclearPacket = tool.buildPacket({
  failureType: 'unclear_spec',
  failedStep: 'spec_review',
  errorSummary: 'Spec is ambiguous',
  providerStatus: {}, previousAttempts: 0, riskLevel: 'low', dataLevel: 'A'
});
assert.strictEqual(unclearPacket.retryTargetAgent.agent, 'kosame', `unclear_spec must route to kosame, got: ${unclearPacket.retryTargetAgent.agent}`);
console.log('  PASS: repair board routes unclear_spec to Kosame');

// provider_unavailable → fallback
const providerPacket = tool.buildPacket({
  failureType: 'provider_unavailable',
  failedStep: 'dispatch',
  errorSummary: 'Provider timeout 503',
  providerStatus: {}, previousAttempts: 0, riskLevel: 'low', dataLevel: 'A'
});
assert.ok(providerPacket.retryTargetAgent.agent !== 'stop', 'provider_unavailable must route to fallback, not stop');
console.log('  PASS: repair board routes provider_unavailable to fallback');

// repeated_failure → stop
const repeatedPacket = tool.buildPacket({
  failureType: 'verify_failure',
  failedStep: 'smoke',
  errorSummary: 'FAIL: smoke test',
  providerStatus: {}, previousAttempts: 5, riskLevel: 'low', dataLevel: 'A'
});
assert.ok(repeatedPacket.retryTargetAgent.shouldStop, 'repeated_failure must stop');
console.log('  PASS: repair board stops on repeated_failure');

// failureClassification
assert.ok(syntaxPacket.failureClassification, 'failureClassification must be present');
assert.ok(syntaxPacket.failureClassification.classified, 'classified must be present');
console.log('  PASS: failureClassification present');

// retryLimit
assert.ok(typeof syntaxPacket.retryLimit === 'number', 'retryLimit must be number');
console.log('  PASS: retryLimit present');

// escalationPolicy
assert.ok(syntaxPacket.escalationPolicy, 'escalationPolicy must be present');
console.log('  PASS: escalationPolicy present');

// stopConditions
assert.ok(Array.isArray(syntaxPacket.stopConditions), 'stopConditions must be array');
assert.ok(syntaxPacket.stopConditions.length > 0, 'stopConditions must not be empty');
console.log('  PASS: stopConditions present');

// humanApprovalRequired for safety_block
const safetyPacket = tool.buildPacket({
  failureType: 'safety_block', failedStep: 'dispatch', errorSummary: 'Blocked: Level C data',
  providerStatus: {}, previousAttempts: 0, riskLevel: 'low', dataLevel: 'A'
});
assert.strictEqual(safetyPacket.humanApprovalRequired, true, 'safety_block must require human approval');
console.log('  PASS: safety_block requires human approval');

// blockedDangerousActions
assert.ok(Array.isArray(syntaxPacket.blockedDangerousActions), 'blockedDangerousActions must be array');
assert.ok(syntaxPacket.blockedDangerousActions.includes('git push'), 'git push must be blocked');
console.log('  PASS: blockedDangerousActions present');

// recommendedNextAction
assert.ok(typeof syntaxPacket.recommendedNextAction === 'string', 'recommendedNextAction must be string');
assert.ok(syntaxPacket.recommendedNextAction.length > 0, 'recommendedNextAction must not be empty');
console.log('  PASS: recommendedNextAction present');

console.log('PASS: autonomous-repair-retry-board-pack');
