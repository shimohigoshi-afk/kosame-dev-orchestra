'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/first-real-repo-trial-success-record-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-repo-trial-success-record smoke ===');

// package version
assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 41, `pkg version must be >= 41.0.0, got ${pkg.version}`);
console.log('  PASS: package version 41.0.0 or later');

// scripts exist
assert.ok(pkg.scripts['smoke:first-real-repo-trial-success-record'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-repo-trial-success-record'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

// docs and fixture exist
assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v41.0.0-release-record.md')),
  'v41 release record must exist'
);
console.log('  PASS: v41 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-real-repo-trial-success-record.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta
assert.strictEqual(tool.TOOL_META.version, '41.0.0', 'tool version must be 41.0.0');
console.log('  PASS: tool meta version 41.0.0');

// build packet
const packet = tool.buildTrialSuccessRecord({
  targetProduct:  'anesty_board',
  targetRepoPath: '/home/shimohigoshi/anesty-board',
  testedVersion:  'v87.0.8-gemini-first-routing-smoke',
  testedCommit:   'd7a3d3e',
  trialSucceeded: true
});

// required safety flags
assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.strictEqual(packet.noRealGitCommit, true, 'noRealGitCommit must be true');
console.log('  PASS: noRealGitCommit true');

assert.strictEqual(packet.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: noRealDeploy true');

assert.strictEqual(packet.noSecretRead, true, 'noSecretRead must be true');
console.log('  PASS: noSecretRead true');

// required keys
const requiredKeys = [
  'trialSuccessRecordId', 'targetProduct', 'targetRepo', 'targetRepoPath',
  'testedVersion', 'testedCommit', 'testedTag', 'trialPurpose',
  'checksPerformed', 'verificationResults', 'backupResult',
  'safetyBoundary', 'humanApprovalContract', 'successCriteria',
  'trialSucceeded', 'lessonsLearned', 'recommendedNextAction'
];
for (const key of requiredKeys) {
  assert.ok(packet[key] !== undefined, `${key} must be present`);
}
console.log('  PASS: all required keys present');

// trialSucceeded
assert.strictEqual(packet.trialSucceeded, true, 'trialSucceeded must be true');
console.log('  PASS: trialSucceeded true');

// checksPerformed
assert.ok(Array.isArray(packet.checksPerformed) && packet.checksPerformed.length >= 4, 'checksPerformed must have 4+ items');
assert.ok(packet.checksPerformed.every(c => c.result === 'PASS'), 'all checks must PASS');
console.log('  PASS: checksPerformed all PASS');

// successCriteria all met
assert.ok(Array.isArray(packet.successCriteria) && packet.successCriteria.length >= 6, 'successCriteria must have 6+ items');
assert.ok(packet.successCriteria.every(c => c.met === true), 'all successCriteria must be met');
console.log('  PASS: successCriteria all met');

// dangerous actions denied contains key terms
const denied = packet.dangerousActionsDenied || tool.DANGEROUS_ACTIONS_DENIED;
assert.ok(denied.some(d => d.includes('deploy')), 'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('git push')), 'dangerousActionsDenied must include git push');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied contains required entries');

// providerRoleMap
const roleMap = packet.providerRoleMap || tool.PROVIDER_ROLE_MAP;
assert.ok(roleMap['Kosame/GPT'], 'providerRoleMap must include Kosame/GPT');
assert.ok(roleMap['Claude'], 'providerRoleMap must include Claude');
assert.ok(roleMap['Gemini'], 'providerRoleMap must include Gemini');
console.log('  PASS: providerRoleMap includes required providers');

console.log('=== first-real-repo-trial-success-record smoke PASSED ===');
