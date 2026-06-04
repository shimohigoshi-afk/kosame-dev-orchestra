'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/anesty-board-first-controlled-task-trial-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== anesty-board-first-controlled-task-trial-pack smoke ===');

// package version
assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 44, `pkg version must be >= 44.0.0, got ${pkg.version}`);
console.log('  PASS: package version 44.0.0 or later');

// scripts exist
assert.ok(pkg.scripts['smoke:anesty-board-first-controlled-task-trial-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:anesty-board-first-controlled-task-trial-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

// docs and fixture exist
assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v44.0.0-release-record.md')),
  'v44 release record must exist'
);
console.log('  PASS: v44 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/anesty-board-first-controlled-task-trial-pack.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta
assert.strictEqual(tool.TOOL_META.version, '44.0.0', 'tool version must be 44.0.0');
console.log('  PASS: tool meta version 44.0.0');

// build packet — low-risk docs task → trialReady = true
const packet = tool.buildFirstControlledTaskTrialPack({
  forbiddenFilesTouched: [],
  deployInvolved:        false
});

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
  'anestyFirstControlledTrialId', 'targetProduct', 'targetRepo',
  'selectedTask', 'trialObjective', 'launchReadiness',
  'safetyBoundary', 'dangerousActionsDenied',
  'allowedScope', 'forbiddenScope',
  'claudePromptToLaunch', 'expectedChangedFiles',
  'verificationPlan', 'acceptanceCriteria', 'resultReviewPlan',
  'humanApprovalContract', 'trialReady', 'blockerItems', 'nextAction'
];
for (const key of requiredKeys) {
  assert.ok(packet[key] !== undefined, `${key} must be present`);
}
console.log('  PASS: all required keys present');

// trialReady = true for low-risk docs task
assert.strictEqual(packet.trialReady, true, 'trialReady must be true for docs-only task');
console.log('  PASS: trialReady true for docs-only task');

// blockerItems empty when trialReady
assert.ok(Array.isArray(packet.blockerItems) && packet.blockerItems.length === 0, 'blockerItems must be empty when trialReady');
console.log('  PASS: blockerItems empty');

// trialReady = false when bot.js touched
const packetBotTouched = tool.buildFirstControlledTaskTrialPack({
  forbiddenFilesTouched: ['bot.js'],
  deployInvolved:        false
});
assert.strictEqual(packetBotTouched.trialReady, false, 'trialReady must be false when bot.js touched');
console.log('  PASS: trialReady false when bot.js touched');

// trialReady = false when deploy involved
const packetDeployInvolved = tool.buildFirstControlledTaskTrialPack({
  forbiddenFilesTouched: [],
  deployInvolved:        true
});
assert.strictEqual(packetDeployInvolved.trialReady, false, 'trialReady must be false when deploy involved');
console.log('  PASS: trialReady false when deploy involved');

// trialReady = false when secret touched
const packetSecretTouched = tool.buildFirstControlledTaskTrialPack({
  forbiddenFilesTouched: ['.env'],
  deployInvolved:        false
});
assert.strictEqual(packetSecretTouched.trialReady, false, 'trialReady must be false when .env touched');
console.log('  PASS: trialReady false when .env touched');

// claudePromptToLaunch contains safety rules
const prompt = packet.claudePromptToLaunch || tool.CLAUDE_PROMPT_TO_LAUNCH;
assert.ok(typeof prompt === 'string' && prompt.length > 100, 'claudePromptToLaunch must be a non-trivial string');
assert.ok(prompt.includes('git add'), 'claudePromptToLaunch must mention git add prohibition');
assert.ok(prompt.includes('bot.js'), 'claudePromptToLaunch must mention bot.js prohibition');
assert.ok(prompt.includes('npm run verify'), 'claudePromptToLaunch must include npm run verify');
console.log('  PASS: claudePromptToLaunch contains safety rules');

// forbiddenScope contains key entries
const forbidden = packet.forbiddenScope;
assert.ok(Array.isArray(forbidden) && forbidden.length >= 4, 'forbiddenScope must have 4+ items');
assert.ok(forbidden.some(f => f.includes('bot.js')), 'forbiddenScope must include bot.js');
assert.ok(forbidden.some(f => f.includes('deploy')), 'forbiddenScope must include deploy');
assert.ok(forbidden.some(f => f.includes('git add')), 'forbiddenScope must include git add');
console.log('  PASS: forbiddenScope contains required entries');

// acceptanceCriteria all required
assert.ok(Array.isArray(packet.acceptanceCriteria) && packet.acceptanceCriteria.length >= 6, 'acceptanceCriteria must have 6+ items');
assert.ok(packet.acceptanceCriteria.every(c => c.required === true), 'all acceptanceCriteria must be required');
console.log('  PASS: acceptanceCriteria all required');

// dangerousActionsDenied
const denied = packet.dangerousActionsDenied || tool.DANGEROUS_ACTIONS_DENIED;
assert.ok(denied.some(d => d.includes('deploy')), 'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('secret read')), 'dangerousActionsDenied must include secret read');
console.log('  PASS: dangerousActionsDenied correct');

// providerRoleMap
const roleMap = packet.providerRoleMap || tool.PROVIDER_ROLE_MAP;
assert.ok(roleMap['Kosame/GPT'], 'providerRoleMap must include Kosame/GPT');
assert.ok(roleMap['Claude'], 'providerRoleMap must include Claude');
console.log('  PASS: providerRoleMap includes required providers');

console.log('=== anesty-board-first-controlled-task-trial-pack smoke PASSED ===');
