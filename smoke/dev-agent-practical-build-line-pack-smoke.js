'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/dev-agent-practical-build-line-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== dev-agent-practical-build-line-pack smoke ===');

// package version >= 50
assert.ok(
  parseInt(pkg.version.split('.')[0], 10) >= 50,
  `pkg version must be >= 50.0.0, got ${pkg.version}`
);
console.log('  PASS: package version 50.0.0 or later');

// smoke script exists
assert.ok(pkg.scripts['smoke:practical-build-line'], 'smoke:practical-build-line must exist');
console.log('  PASS: smoke script exists');

// pm-agent script exists
assert.ok(pkg.scripts['pm-agent:practical-build-line'], 'pm-agent:practical-build-line must exist');
console.log('  PASS: pm-agent:practical-build-line must exist');

// fixture exists
assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/dev-agent-practical-build-line-pack.fixture.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta version
assert.strictEqual(tool.TOOL_META.version, '50.0.0', 'tool version must be 50.0.0');
console.log('  PASS: tool meta version 50.0.0');

// build line — clean scenario
const line = tool.buildPracticalBuildLine({ templateId: 'docs_update' });

// dryRun true
assert.strictEqual(line.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

// humanApprovalRequired true
assert.strictEqual(line.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

// operationBoard exists
assert.ok(line.operationBoard && typeof line.operationBoard === 'object', 'operationBoard must exist');
console.log('  PASS: operationBoard exists');

// selectedTaskTemplate exists
assert.ok(line.selectedTaskTemplate && line.selectedTaskTemplate.templateId, 'selectedTaskTemplate must exist');
console.log('  PASS: selectedTaskTemplate exists');

// claudePromptPacket exists
assert.ok(line.claudePromptPacket && line.claudePromptPacket.prompt, 'claudePromptPacket must exist');
console.log('  PASS: claudePromptPacket exists');

// safetyGate exists
assert.ok(line.safetyGate && typeof line.safetyGate.passed === 'boolean', 'safetyGate must exist');
console.log('  PASS: safetyGate exists');

// verificationPlan exists
assert.ok(line.verificationPlan && Array.isArray(line.verificationPlan.commands), 'verificationPlan must exist');
console.log('  PASS: verificationPlan exists');

// acceptanceGate exists
assert.ok(line.acceptanceGate && typeof line.acceptanceGate.commitCandidate === 'boolean', 'acceptanceGate must exist');
console.log('  PASS: acceptanceGate exists');

// humanApprovalPacket exists
assert.ok(line.humanApprovalPacket && line.humanApprovalPacket.junyaApprovalRequired === true, 'humanApprovalPacket must exist');
console.log('  PASS: humanApprovalPacket exists');

// nextAction exists
assert.ok(line.nextAction, 'nextAction must exist');
console.log('  PASS: nextAction exists');

// clean scenario: commitCandidate = true (no blockers)
assert.strictEqual(line.acceptanceGate.commitCandidate, true, 'commitCandidate must be true when no blockers');
assert.strictEqual(line.safetyGate.passed, true, 'safetyGate.passed must be true when no blockers');
console.log('  PASS: commitCandidate true when no blockers');

// blocked scenario: secretTouched → commitCandidate = false
const blockedLine = tool.buildPracticalBuildLine({
  templateId: 'docs_update',
  safetyOverrides: { secretTouched: true }
});
assert.strictEqual(blockedLine.safetyGate.passed, false, 'safetyGate.passed must be false when secret touched');
assert.strictEqual(blockedLine.acceptanceGate.commitCandidate, false, 'commitCandidate must be false when safetyGate fails');
assert.ok(blockedLine.acceptanceGate.blockers.length > 0, 'blockers must be populated when safetyGate fails');
console.log('  PASS: blocked scenario: secretTouched → commitCandidate false');

// deployInScope scenario
const deployLine = tool.buildPracticalBuildLine({
  templateId:      'docs_update',
  safetyOverrides: { deployInScope: true }
});
assert.strictEqual(deployLine.acceptanceGate.commitCandidate, false, 'commitCandidate must be false when deploy in scope');
console.log('  PASS: blocked scenario: deployInScope → commitCandidate false');

// no git/deploy side effects — check humanApprovalPacket deniedActions
const denied = line.humanApprovalPacket.deniedActions;
assert.ok(Array.isArray(denied) && denied.some(d => d.includes('deploy')), 'humanApprovalPacket.deniedActions must include deploy');
assert.ok(denied.some(d => d.includes('git push')), 'humanApprovalPacket.deniedActions must include git push');
console.log('  PASS: no git/deploy/secret side effects (deniedActions correct)');

// dangerousActionsDenied correct
const linedenied = line.dangerousActionsDenied;
assert.ok(Array.isArray(linedenied) && linedenied.length >= 4, 'dangerousActionsDenied must have 4+ items');
assert.ok(linedenied.some(d => d.includes('deploy')),      'dangerousActionsDenied must include deploy');
assert.ok(linedenied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
assert.ok(linedenied.some(d => d.includes('.env read')),   'dangerousActionsDenied must include .env read');
assert.ok(linedenied.some(d => d.includes('git push')),    'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// safetyGate dangerGates all BLOCKED
const dg = line.safetyGate.dangerGates;
assert.ok(Object.values(dg).every(v => v === 'BLOCKED'), 'all safetyGate dangerGates must be BLOCKED');
console.log('  PASS: safetyGate dangerGates all BLOCKED');

// build functions exported
assert.ok(typeof tool.buildClaudePromptPacket  === 'function', 'buildClaudePromptPacket must be exported');
assert.ok(typeof tool.buildSafetyGate          === 'function', 'buildSafetyGate must be exported');
assert.ok(typeof tool.buildVerificationPlan    === 'function', 'buildVerificationPlan must be exported');
assert.ok(typeof tool.buildAcceptanceGate      === 'function', 'buildAcceptanceGate must be exported');
assert.ok(typeof tool.buildHumanApprovalPacket === 'function', 'buildHumanApprovalPacket must be exported');
console.log('  PASS: all build functions exported');

console.log('=== dev-agent-practical-build-line-pack smoke PASSED ===');
