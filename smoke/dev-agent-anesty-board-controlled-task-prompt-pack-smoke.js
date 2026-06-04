'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/anesty-board-controlled-task-prompt-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== anesty-board-controlled-task-prompt-pack smoke ===');

// package version
assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 43, `pkg version must be >= 43.0.0, got ${pkg.version}`);
console.log('  PASS: package version 43.0.0 or later');

// scripts exist
assert.ok(pkg.scripts['smoke:anesty-board-controlled-task-prompt-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:anesty-board-controlled-task-prompt-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

// docs and fixture exist
assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v43.0.0-release-record.md')),
  'v43 release record must exist'
);
console.log('  PASS: v43 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/anesty-board-controlled-task-prompt-pack.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta
assert.strictEqual(tool.TOOL_META.version, '43.0.0', 'tool version must be 43.0.0');
console.log('  PASS: tool meta version 43.0.0');

// build packet
const packet = tool.buildControlledTaskPromptPack({ blockerItems: [] });

// safety flags
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
  'anestyControlledPromptPackId', 'targetProduct', 'targetRepo',
  'taskTitle', 'taskGoal', 'claudeRole', 'kosameRole', 'humanRole',
  'allowedFiles', 'forbiddenFiles', 'allowedCommands', 'forbiddenCommands',
  'preflightCommands', 'implementationPrompt', 'verificationCommands',
  'reportFormat', 'rollbackInstruction', 'commitCandidateStopRule',
  'humanApprovalRequired', 'promptReady', 'blockerItems', 'recommendedNextAction'
];
for (const key of requiredKeys) {
  assert.ok(packet[key] !== undefined, `${key} must be present`);
}
console.log('  PASS: all required keys present');

// promptReady when no blockers
assert.strictEqual(packet.promptReady, true, 'promptReady must be true when blockerItems is empty');
console.log('  PASS: promptReady true with no blockers');

// implementationPrompt contains safety rules
const prompt = packet.implementationPrompt || tool.IMPLEMENTATION_PROMPT;
assert.ok(typeof prompt === 'string' && prompt.length > 100, 'implementationPrompt must be a non-trivial string');
assert.ok(prompt.includes('git add'), 'implementationPrompt must mention git add prohibition');
assert.ok(prompt.includes('bot.js'), 'implementationPrompt must mention bot.js prohibition');
assert.ok(prompt.includes('npm run verify'), 'implementationPrompt must include npm run verify');
console.log('  PASS: implementationPrompt contains safety rules');

// forbiddenFiles and forbiddenCommands
const forbiddenFiles = packet.forbiddenFiles || tool.FORBIDDEN_FILES;
assert.ok(forbiddenFiles.some(f => f.includes('bot.js')), 'forbiddenFiles must include bot.js');
assert.ok(forbiddenFiles.some(f => f.includes('.env')), 'forbiddenFiles must include .env');
console.log('  PASS: forbiddenFiles correct');

const forbiddenCommands = packet.forbiddenCommands || tool.FORBIDDEN_COMMANDS;
assert.ok(forbiddenCommands.some(c => c.includes('git add')), 'forbiddenCommands must include git add');
assert.ok(forbiddenCommands.some(c => c.includes('git push')), 'forbiddenCommands must include git push');
assert.ok(forbiddenCommands.some(c => c.includes('deploy')), 'forbiddenCommands must include deploy');
console.log('  PASS: forbiddenCommands correct');

// allowedFiles must be docs-only
const allowedFiles = packet.allowedFiles || tool.ALLOWED_FILES;
assert.ok(allowedFiles.every(f => f.startsWith('docs/') || f.includes('README')),
  'allowedFiles must be docs/README only');
console.log('  PASS: allowedFiles docs/README only');

// commitCandidateStopRule
assert.ok(typeof packet.commitCandidateStopRule === 'string' && packet.commitCandidateStopRule.length > 10,
  'commitCandidateStopRule must be present');
console.log('  PASS: commitCandidateStopRule present');

// dangerous actions denied
const denied = packet.dangerousActionsDenied || tool.DANGEROUS_ACTIONS_DENIED;
assert.ok(denied.some(d => d.includes('deploy')), 'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

// promptReady = false when blockers
const packetWithBlocker = tool.buildControlledTaskPromptPack({ blockerItems: ['some-blocker'] });
assert.strictEqual(packetWithBlocker.promptReady, false, 'promptReady must be false when blockerItems is non-empty');
console.log('  PASS: promptReady false with blockers');

console.log('=== anesty-board-controlled-task-prompt-pack smoke PASSED ===');
