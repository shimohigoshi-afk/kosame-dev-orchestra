'use strict';

const assert = require('assert');
const fs     = require('fs');
const path   = require('path');
const tool   = require('../tools/anesty-board-next-task-selection-console-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== anesty-board-next-task-selection-console smoke ===');

// package version
assert.ok(parseInt(pkg.version.split('.')[0], 10) >= 42, `pkg version must be >= 42.0.0, got ${pkg.version}`);
console.log('  PASS: package version 42.0.0 or later');

// scripts exist
assert.ok(pkg.scripts['smoke:anesty-board-next-task-selection-console'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:anesty-board-next-task-selection-console'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

// docs and fixture exist
assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v42.0.0-release-record.md')),
  'v42 release record must exist'
);
console.log('  PASS: v42 release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/anesty-board-next-task-selection-console.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

// tool meta
assert.strictEqual(tool.TOOL_META.version, '42.0.0', 'tool version must be 42.0.0');
console.log('  PASS: tool meta version 42.0.0');

// build packet
const packet = tool.buildNextTaskSelectionConsole({});

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
  'anestyNextTaskSelectionId', 'targetProduct', 'targetRepoCandidate',
  'candidateTasks', 'recommendedTask', 'selectionReason',
  'businessImpact', 'implementationRisk', 'safetyRisk',
  'allowedScope', 'forbiddenScope', 'requiredInputs', 'missingInputs',
  'humanApprovalRequired', 'recommendedNextAction'
];
for (const key of requiredKeys) {
  assert.ok(packet[key] !== undefined, `${key} must be present`);
}
console.log('  PASS: all required keys present');

// candidateTasks
assert.ok(Array.isArray(packet.candidateTasks) && packet.candidateTasks.length >= 5, 'candidateTasks must have 5+ items');
console.log('  PASS: candidateTasks has 5+ items');

// recommended task has no forbidden files touching bot.js core
assert.ok(packet.recommendedTask.taskId, 'recommendedTask must have taskId');
const rt = packet.recommendedTask;
assert.ok(!rt.targetFiles || rt.targetFiles.every(f => !['bot.js', 'BOARD_CANON.js'].includes(f)),
  'recommendedTask must not target bot.js or BOARD_CANON.js');
console.log('  PASS: recommendedTask does not target bot.js / BOARD_CANON.js');

// forbiddenScope contains required items
const forbidden = packet.forbiddenScope || tool.FORBIDDEN_SCOPE;
assert.ok(forbidden.some(f => f.includes('bot.js')), 'forbiddenScope must include bot.js');
assert.ok(forbidden.some(f => f.includes('deploy')), 'forbiddenScope must include deploy');
assert.ok(forbidden.some(f => f.includes('git push')), 'forbiddenScope must include git push');
console.log('  PASS: forbiddenScope includes required entries');

// allowedScope is docs-only
assert.ok(Array.isArray(packet.allowedScope) && packet.allowedScope.length > 0, 'allowedScope must be non-empty');
assert.ok(packet.allowedScope.every(s => s.startsWith('docs/') || s.includes('README')),
  'allowedScope must be docs/README only');
console.log('  PASS: allowedScope is docs/README only');

// dangerous actions denied
const denied = packet.dangerousActionsDenied || tool.DANGEROUS_ACTIONS_DENIED;
assert.ok(denied.some(d => d.includes('deploy')), 'dangerousActionsDenied must include deploy');
assert.ok(denied.some(d => d.includes('git push')), 'dangerousActionsDenied must include git push');
console.log('  PASS: dangerousActionsDenied correct');

// providerRoleMap
const roleMap = packet.providerRoleMap || tool.PROVIDER_ROLE_MAP;
assert.ok(roleMap['Kosame/GPT'], 'providerRoleMap must include Kosame/GPT');
assert.ok(roleMap['Claude'], 'providerRoleMap must include Claude');
console.log('  PASS: providerRoleMap includes required providers');

console.log('=== anesty-board-next-task-selection-console smoke PASSED ===');
