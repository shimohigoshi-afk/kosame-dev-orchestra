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
const tool   = require('../tools/first-real-product-repo-launch-handoff-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-real-product-repo-launch-handoff smoke ===');

assert.ok(compareVersion(pkg.version, '37.0.0') >= 0, `pkg version must be >= 37.0.0, got ${pkg.version}`);
console.log('  PASS: package version 37.0.0 or later');

assert.ok(pkg.scripts['smoke:first-real-product-repo-launch-handoff'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-real-product-repo-launch-handoff'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v37.0.0-release-record.md')), 'v37 release record must exist');
console.log('  PASS: v37 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-real-product-repo-launch-handoff.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '37.0.0', 'tool version must be 37.0.0');
console.log('  PASS: tool meta version 37.0.0');

// ---- ready handoff ----
const handoffPack = tool.buildLaunchHandoff({
  targetProduct:   'email_reply_bot',
  launchObjective: 'docs整備: README.md に目次・概要セクションを追加する',
  allowedFiles:    ['docs/**', 'README.md', 'smoke/**'],
  forbiddenFiles:  ['.env*', 'secrets/**', 'credentials/**'],
  finalGatePassed: true
});

assert.strictEqual(handoffPack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(handoffPack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(handoffPack.launchHandoffId, 'launchHandoffId must be present');
console.log('  PASS: launchHandoffId present');

assert.ok(handoffPack.launchObjective, 'launchObjective must be present');
console.log('  PASS: launchObjective present');

assert.ok(handoffPack.claudeRole, 'claudeRole must be present');
assert.ok(handoffPack.kosameRole, 'kosameRole must be present');
assert.ok(handoffPack.humanRole, 'humanRole must be present');
console.log('  PASS: role descriptions present');

assert.ok(Array.isArray(handoffPack.allowedFiles) && handoffPack.allowedFiles.length > 0, 'allowedFiles must be non-empty');
assert.ok(Array.isArray(handoffPack.forbiddenFiles) && handoffPack.forbiddenFiles.length > 0, 'forbiddenFiles must be non-empty');
console.log('  PASS: allowedFiles/forbiddenFiles present');

assert.ok(Array.isArray(handoffPack.allowedCommands), 'allowedCommands must be array');
assert.ok(Array.isArray(handoffPack.forbiddenCommands), 'forbiddenCommands must be array');
assert.ok(handoffPack.forbiddenCommands.some(c => c.includes('git commit')), 'git commit must be forbidden');
assert.ok(handoffPack.forbiddenCommands.some(c => c.includes('git push')), 'git push must be forbidden');
assert.ok(handoffPack.forbiddenCommands.some(c => c.includes('deploy')), 'deploy must be forbidden');
console.log('  PASS: forbiddenCommands correct');

assert.ok(Array.isArray(handoffPack.preflightCommands) && handoffPack.preflightCommands.length > 0, 'preflightCommands must be non-empty');
console.log('  PASS: preflightCommands present');

assert.ok(typeof handoffPack.implementationPrompt === 'string' && handoffPack.implementationPrompt.length > 100, 'implementationPrompt must be substantial string');
assert.ok(handoffPack.implementationPrompt.includes('git commit'), 'implementationPrompt must mention git commit prohibition');
assert.ok(handoffPack.implementationPrompt.includes('git push'), 'implementationPrompt must mention git push prohibition');
assert.ok(handoffPack.implementationPrompt.includes('deploy'), 'implementationPrompt must mention deploy prohibition');
assert.ok(handoffPack.implementationPrompt.toLowerCase().includes('secret') || handoffPack.implementationPrompt.includes('.env'), 'implementationPrompt must mention secret prohibition');
console.log('  PASS: implementationPrompt has safety rules');

assert.ok(Array.isArray(handoffPack.verificationCommands) && handoffPack.verificationCommands.length > 0, 'verificationCommands must be non-empty');
console.log('  PASS: verificationCommands present');

assert.ok(handoffPack.reportFormat, 'reportFormat must be present');
assert.ok(Array.isArray(handoffPack.reportFormat.requiredFields), 'reportFormat.requiredFields must be array');
console.log('  PASS: reportFormat present');

assert.ok(Array.isArray(handoffPack.stopConditions) && handoffPack.stopConditions.length > 0, 'stopConditions must be non-empty');
assert.ok(handoffPack.stopConditions.some(s => s.toLowerCase().includes('secret') || s.toLowerCase().includes('sensitive')), 'stopConditions must mention sensitive content');
console.log('  PASS: stopConditions correct');

assert.ok(handoffPack.rollbackInstruction, 'rollbackInstruction must be present');
assert.ok(Array.isArray(handoffPack.commitCandidateStopRule) && handoffPack.commitCandidateStopRule.length > 0, 'commitCandidateStopRule must be non-empty');
console.log('  PASS: rollbackInstruction and commitCandidateStopRule present');

assert.strictEqual(handoffPack.launchHandoffReady, true, 'launchHandoffReady must be true when finalGatePassed');
assert.strictEqual(handoffPack.blockerItems.length, 0, 'blockerItems must be empty');
console.log('  PASS: launchHandoffReady true');

assert.ok(Array.isArray(handoffPack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(handoffPack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(handoffPack.noRealRepoEdit, true, 'noRealRepoEdit must be true');
assert.strictEqual(handoffPack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: safety flags correct');

// ---- finalGate not passed → blocked ----
const blockedPack = tool.buildLaunchHandoff({ targetProduct: 'sales_dx' });
assert.strictEqual(blockedPack.launchHandoffReady, false, 'launchHandoffReady must be false without finalGatePassed');
assert.ok(blockedPack.blockerItems.length > 0, 'blockerItems must be non-empty');
console.log('  PASS: finalGate not passed → blocked');

// ---- all 5 products generate handoff ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const h = tool.buildLaunchHandoff({ targetProduct: p });
  assert.ok(h.launchHandoffId, `${p} must have launchHandoffId`);
  assert.ok(h.implementationPrompt, `${p} must have implementationPrompt`);
}
console.log('  PASS: all 5 products generate launch handoff');

console.log('PASS: first-real-product-repo-launch-handoff');
