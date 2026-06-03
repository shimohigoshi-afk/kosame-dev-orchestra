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
const tool   = require('../tools/product-repo-first-controlled-task-launch-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-repo-first-controlled-task-launch-pack smoke ===');

assert.ok(compareVersion(pkg.version, '34.0.0') >= 0, `pkg version must be >= 34.0.0, got ${pkg.version}`);
console.log('  PASS: package version 34.0.0 or later');

assert.ok(pkg.scripts['smoke:product-repo-first-controlled-task-launch-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-repo-first-controlled-task-launch-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v34.0.0-release-record.md')), 'v34 release record must exist');
console.log('  PASS: v34 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-repo-first-controlled-task-launch.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '34.0.0', 'tool version must be 34.0.0');
console.log('  PASS: tool meta version 34.0.0');

// ---- launch ready ----
const launchPack = tool.buildControlledLaunchPack({
  targetProduct:      'email_reply_bot',
  launchTaskTitle:    'docs整備: README.md に目次と概要セクションを追加する',
  launchTaskGoal:     'Email Reply BOT の README.md を整備する',
  allowedFiles:       ['docs/**', 'README.md', 'smoke/**'],
  forbiddenFiles:     ['.env*', 'secrets/**', 'credentials/**'],
  preLaunchConfirmed: true
});

assert.strictEqual(launchPack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(launchPack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(launchPack.controlledLaunchId, 'controlledLaunchId must be present');
console.log('  PASS: controlledLaunchId present');

assert.ok(launchPack.launchTaskTitle, 'launchTaskTitle must be present');
assert.ok(launchPack.launchTaskGoal, 'launchTaskGoal must be present');
console.log('  PASS: task title and goal present');

assert.ok(Array.isArray(launchPack.allowedFiles) && launchPack.allowedFiles.length > 0, 'allowedFiles must be non-empty');
assert.ok(Array.isArray(launchPack.forbiddenFiles) && launchPack.forbiddenFiles.length > 0, 'forbiddenFiles must be non-empty');
assert.ok(launchPack.forbiddenFiles.some(f => f.includes('.env')), '.env must be in forbiddenFiles');
assert.ok(launchPack.forbiddenFiles.some(f => f.includes('secrets')), 'secrets must be in forbiddenFiles');
console.log('  PASS: allowed/forbidden files correct');

assert.ok(Array.isArray(launchPack.allowedCommands) && launchPack.allowedCommands.length > 0, 'allowedCommands must be non-empty');
assert.ok(launchPack.allowedCommands.some(c => c.includes('node --check')), 'node --check must be allowed');
console.log('  PASS: allowedCommands correct');

assert.ok(Array.isArray(launchPack.forbiddenCommands) && launchPack.forbiddenCommands.length > 0, 'forbiddenCommands must be non-empty');
assert.ok(launchPack.forbiddenCommands.some(c => c.includes('git push')), 'git push must be forbidden');
assert.ok(launchPack.forbiddenCommands.some(c => c.includes('git commit')), 'git commit must be forbidden');
assert.ok(launchPack.forbiddenCommands.some(c => c.includes('deploy')), 'deploy must be forbidden');
console.log('  PASS: forbiddenCommands correct');

assert.ok(typeof launchPack.claudePromptToLaunch === 'string' && launchPack.claudePromptToLaunch.length > 50, 'claudePromptToLaunch must be a substantial string');
assert.ok(launchPack.claudePromptToLaunch.includes('git commit'), 'claudePromptToLaunch must mention git commit prohibition');
assert.ok(launchPack.claudePromptToLaunch.includes('git push'), 'claudePromptToLaunch must mention git push prohibition');
assert.ok(launchPack.claudePromptToLaunch.includes('deploy'), 'claudePromptToLaunch must mention deploy prohibition');
assert.ok(launchPack.claudePromptToLaunch.includes('.env') || launchPack.claudePromptToLaunch.toLowerCase().includes('secret'), 'claudePromptToLaunch must mention secret prohibition');
console.log('  PASS: claudePromptToLaunch has safety rules');

assert.ok(Array.isArray(launchPack.preLaunchChecklist) && launchPack.preLaunchChecklist.length > 0, 'preLaunchChecklist must be non-empty');
console.log('  PASS: preLaunchChecklist non-empty');

assert.ok(launchPack.postLaunchReportFormat, 'postLaunchReportFormat must be present');
assert.ok(Array.isArray(launchPack.postLaunchReportFormat.requiredFields), 'postLaunchReportFormat.requiredFields must be array');
assert.ok(launchPack.postLaunchReportFormat.requiredFields.some(f => f.includes('changedFiles')), 'changedFiles must be required field');
console.log('  PASS: postLaunchReportFormat correct');

assert.ok(launchPack.rollbackInstruction, 'rollbackInstruction must be present');
console.log('  PASS: rollbackInstruction present');

assert.ok(Array.isArray(launchPack.commitStopRule) && launchPack.commitStopRule.length > 0, 'commitStopRule must be non-empty');
assert.ok(launchPack.commitStopRule.some(r => r.includes('git add') || r.includes('git commit')), 'commitStopRule must mention git add/commit');
console.log('  PASS: commitStopRule correct');

assert.strictEqual(launchPack.launchReady, true, 'launchReady must be true when preLaunchConfirmed');
assert.strictEqual(launchPack.blockedReasons.length, 0, 'blockedReasons must be empty when launch ready');
console.log('  PASS: launchReady true');

assert.ok(Array.isArray(launchPack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(launchPack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(launchPack.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(launchPack.noRealPush, true, 'noRealPush must be true');
assert.strictEqual(launchPack.noRealDeploy, true, 'noRealDeploy must be true');
assert.strictEqual(launchPack.noSecretRead, true, 'noSecretRead must be true');
console.log('  PASS: safety flags correct');

// ---- not confirmed → blocked ----
const blockedPack = tool.buildControlledLaunchPack({
  targetProduct: 'sales_dx'
});
assert.strictEqual(blockedPack.launchReady, false, 'launchReady must be false when preLaunchConfirmed is falsy');
assert.ok(blockedPack.blockedReasons.length > 0, 'blockedReasons must be non-empty when not confirmed');
console.log('  PASS: unconfirmed launch blocked');

// ---- unknown product ----
const unknownPack = tool.buildControlledLaunchPack({ targetProduct: 'unknown_xyz' });
assert.strictEqual(unknownPack.launchReady, false, 'launchReady must be false for unknown product');
console.log('  PASS: unknown product blocked');

// ---- all 5 products generate launch packet ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const lp = tool.buildControlledLaunchPack({ targetProduct: p });
  assert.ok(lp.controlledLaunchId, `${p} must have controlledLaunchId`);
  assert.ok(lp.claudePromptToLaunch, `${p} must have claudePromptToLaunch`);
}
console.log('  PASS: all 5 products generate launch packet');

console.log('PASS: product-repo-first-controlled-task-launch-pack');
