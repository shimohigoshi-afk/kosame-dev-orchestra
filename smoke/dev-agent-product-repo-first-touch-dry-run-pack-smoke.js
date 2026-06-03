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
const tool   = require('../tools/product-repo-first-touch-dry-run-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-repo-first-touch-dry-run-pack smoke ===');

assert.ok(compareVersion(pkg.version, '33.0.0') >= 0, `pkg version must be >= 33.0.0, got ${pkg.version}`);
console.log('  PASS: package version 33.0.0 or later');

assert.ok(pkg.scripts['smoke:product-repo-first-touch-dry-run-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-repo-first-touch-dry-run-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v33.0.0-release-record.md')), 'v33 release record must exist');
console.log('  PASS: v33 release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-repo-first-touch-dry-run.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '33.0.0', 'tool version must be 33.0.0');
console.log('  PASS: tool meta version 33.0.0');

// ---- known product (email_reply_bot) ----
const pack = tool.buildFirstTouchDryRunPack({
  targetProduct:    'email_reply_bot',
  firstTouchPurpose: 'Email Reply BOT repoへの初回接触前確認。docs/README を read-only で確認する。'
});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(pack.firstTouchDryRunId, 'firstTouchDryRunId must be present');
console.log('  PASS: firstTouchDryRunId present');

assert.ok(pack.targetRepoCandidate, 'targetRepoCandidate must be present');
console.log('  PASS: targetRepoCandidate present');

assert.ok(pack.firstTouchPurpose, 'firstTouchPurpose must be present');
console.log('  PASS: firstTouchPurpose present');

assert.ok(Array.isArray(pack.safeReadOnlyPlan) && pack.safeReadOnlyPlan.length > 0, 'safeReadOnlyPlan must be non-empty');
assert.ok(pack.safeReadOnlyPlan.every(s => s.cmd && s.purpose), 'each safeReadOnlyPlan item must have cmd and purpose');
console.log('  PASS: safeReadOnlyPlan correct structure');

assert.ok(Array.isArray(pack.allowedFirstTouchAreas) && pack.allowedFirstTouchAreas.length > 0, 'allowedFirstTouchAreas must be non-empty');
console.log('  PASS: allowedFirstTouchAreas non-empty');

assert.ok(Array.isArray(pack.forbiddenFirstTouchAreas) && pack.forbiddenFirstTouchAreas.length > 0, 'forbiddenFirstTouchAreas must be non-empty');
assert.ok(pack.forbiddenFirstTouchAreas.some(f => f.includes('.env')), '.env must be in forbiddenFirstTouchAreas');
assert.ok(pack.forbiddenFirstTouchAreas.some(f => f.includes('secrets')), 'secrets must be in forbiddenFirstTouchAreas');
console.log('  PASS: forbiddenFirstTouchAreas correct');

assert.ok(Array.isArray(pack.commandsToPreview) && pack.commandsToPreview.length > 0, 'commandsToPreview must be non-empty');
console.log('  PASS: commandsToPreview non-empty');

assert.ok(Array.isArray(pack.commandsForbidden) && pack.commandsForbidden.length > 0, 'commandsForbidden must be non-empty');
assert.ok(pack.commandsForbidden.some(c => c.includes('git commit')), 'git commit must be forbidden');
assert.ok(pack.commandsForbidden.some(c => c.includes('git push')), 'git push must be forbidden');
assert.ok(pack.commandsForbidden.some(c => c.includes('.env')), '.env read must be forbidden');
console.log('  PASS: commandsForbidden correct');

assert.ok(Array.isArray(pack.expectedObservations) && pack.expectedObservations.length > 0, 'expectedObservations must be non-empty');
console.log('  PASS: expectedObservations non-empty');

assert.ok(typeof pack.backupBeforeTouchRequired === 'boolean', 'backupBeforeTouchRequired must be boolean');
console.log('  PASS: backupBeforeTouchRequired boolean');

assert.strictEqual(pack.dryRunReady, true, 'dryRunReady must be true for known product');
assert.strictEqual(pack.notReadyReasons.length, 0, 'notReadyReasons must be empty for known product');
console.log('  PASS: dryRunReady true for known product');

assert.ok(Array.isArray(pack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(pack.dangerousActionsDenied.some(a => a.includes('deploy')), 'deploy must be denied');
console.log('  PASS: dangerousActionsDenied correct');

assert.strictEqual(pack.noRealFileEdit, true, 'noRealFileEdit must be true');
assert.strictEqual(pack.noRealGitCommit, true, 'noRealGitCommit must be true');
assert.strictEqual(pack.noSecretRead, true, 'noSecretRead must be true');
console.log('  PASS: safety flags correct');

// ---- unknown product ----
const unknownPack = tool.buildFirstTouchDryRunPack({ targetProduct: 'unknown_xyz' });
assert.strictEqual(unknownPack.dryRunReady, false, 'dryRunReady must be false for unknown product');
assert.ok(unknownPack.notReadyReasons.some(r => r.includes('Unknown')), 'notReadyReasons must mention Unknown');
console.log('  PASS: unknown product handled');

// ---- all 5 products generate dry-run pack ----
for (const p of tool.SUPPORTED_PRODUCTS) {
  const d = tool.buildFirstTouchDryRunPack({ targetProduct: p });
  assert.ok(d.firstTouchDryRunId, `${p} must have firstTouchDryRunId`);
  assert.ok(d.safeReadOnlyPlan.length > 0, `${p} must have safeReadOnlyPlan`);
}
console.log('  PASS: all 5 products generate first touch dry-run pack');

console.log('PASS: product-repo-first-touch-dry-run-pack');
