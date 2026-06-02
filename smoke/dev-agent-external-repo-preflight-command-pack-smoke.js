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
const tool   = require('../tools/external-repo-preflight-command-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== external-repo-preflight-command-pack smoke ===');

assert.ok(compareVersion(pkg.version, '25.5.0') >= 0, `pkg version must be >= 25.5.0, got ${pkg.version}`);
console.log('  PASS: package version 25.5.0 or later');

assert.ok(pkg.scripts['smoke:external-repo-preflight-command-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:external-repo-preflight-command-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v25.5.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/external-repo-preflight-command-pack.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '25.5.0', 'tool version must be 25.5.0');
console.log('  PASS: tool meta version 25.5.0');

const PRODUCTS = ['sales_dx', 'anesty_board', 'backoffice_agent', 'email_reply_bot', 'cloud_run_pm_agent'];

for (const shellType of ['bash', 'powershell', 'cloud_shell']) {
  const pack = tool.buildPreflightPack({ targetProduct: 'sales_dx', shellType });
  assert.strictEqual(pack.dryRun, true, `dryRun must be true for ${shellType}`);
  assert.strictEqual(pack.humanApprovalRequired, true, `humanApprovalRequired must be true for ${shellType}`);
  assert.ok(pack.preflightPackId, `preflightPackId must be present for ${shellType}`);
  assert.ok(Array.isArray(pack.safeReadCommands) && pack.safeReadCommands.length > 0, `safeReadCommands must be non-empty for ${shellType}`);
  assert.ok(Array.isArray(pack.forbiddenCommands) && pack.forbiddenCommands.length > 0, `forbiddenCommands must be non-empty for ${shellType}`);
  assert.ok(pack.repoCleanCheck, `repoCleanCheck must be present for ${shellType}`);
  assert.ok(pack.repoCleanCheck.note.includes('dry-run'), `repoCleanCheck must be marked dry-run for ${shellType}`);
  assert.ok(pack.branchCheck, `branchCheck must be present for ${shellType}`);
  assert.ok(pack.packageVersionCheck, `packageVersionCheck must be present for ${shellType}`);
  assert.ok(pack.dependencyCheck, `dependencyCheck must be present for ${shellType}`);
  assert.ok(pack.verifyCommandCandidate, `verifyCommandCandidate must be present for ${shellType}`);
  assert.ok(pack.gitSafetyCheck, `gitSafetyCheck must be present for ${shellType}`);
  assert.ok(Array.isArray(pack.gitSafetyCheck.safeOps), `safeOps must be array for ${shellType}`);
  assert.ok(Array.isArray(pack.gitSafetyCheck.unsafeOps), `unsafeOps must be array for ${shellType}`);
  assert.ok(pack.gitSafetyCheck.unsafeOps.includes('git add'),    `unsafeOps must include git add for ${shellType}`);
  assert.ok(pack.gitSafetyCheck.unsafeOps.includes('git commit'), `unsafeOps must include git commit for ${shellType}`);
  assert.ok(pack.gitSafetyCheck.unsafeOps.includes('git push'),   `unsafeOps must include git push for ${shellType}`);
  assert.ok(pack.gitSafetyCheck.unsafeOps.includes('git tag'),    `unsafeOps must include git tag for ${shellType}`);
  assert.ok(pack.secretSafetyCheck, `secretSafetyCheck must be present for ${shellType}`);
  assert.ok(Array.isArray(pack.secretSafetyCheck.checkItems), `secretSafetyCheck.checkItems must be array for ${shellType}`);
  assert.ok(pack.backupRecommendation, `backupRecommendation must be present for ${shellType}`);
  assert.strictEqual(pack.noRealCommandExecution, true, `noRealCommandExecution must be true for ${shellType}`);
  assert.strictEqual(pack.noRealRepoAccess, true, `noRealRepoAccess must be true for ${shellType}`);
}
console.log('  PASS: bash / powershell / cloud_shell all produce valid preflight pack');

// forbidden commands must include critical items
const pack = tool.buildPreflightPack({ targetProduct: 'sales_dx', shellType: 'bash' });
assert.ok(pack.forbiddenCommands.some(c => c.includes('rm -rf')),        'forbiddenCommands must include rm -rf');
assert.ok(pack.forbiddenCommands.some(c => c.includes('git reset')),     'forbiddenCommands must include git reset');
assert.ok(pack.forbiddenCommands.some(c => c.includes('deploy')),        'forbiddenCommands must include deploy');
assert.ok(pack.forbiddenCommands.some(c => c.includes('.env')),          'forbiddenCommands must include .env');
assert.ok(pack.forbiddenCommands.some(c => c.includes('docker')),        'forbiddenCommands must include docker');
assert.ok(pack.forbiddenCommands.some(c => c.includes('gcloud')),        'forbiddenCommands must include gcloud');
console.log('  PASS: forbiddenCommands includes all critical items');

// all 5 products produce valid pack
for (const p of PRODUCTS) {
  const pPack = tool.buildPreflightPack({ targetProduct: p, shellType: 'bash' });
  assert.strictEqual(pPack.preflightReady, true, `preflightReady must be true for ${p}`);
  assert.ok(pPack.secretSafetyCheck.checkItems.length > 0, `secretSafetyCheck must have items for ${p}`);
}
console.log('  PASS: all 5 product types produce valid preflight pack');

// ANESTY: secret safety must mention insurance/health
const anestyPack = tool.buildPreflightPack({ targetProduct: 'anesty_board', shellType: 'bash' });
const secretCheckText = anestyPack.secretSafetyCheck.checkItems.join(' ').toLowerCase();
assert.ok(secretCheckText.includes('insurance') || secretCheckText.includes('health'), 'ANESTY secretSafetyCheck must mention insurance/health');
console.log('  PASS: ANESTY secretSafetyCheck mentions insurance/health');

// unknown product / unknown shell
const unknownPack = tool.buildPreflightPack({ targetProduct: 'unknown_xyz', shellType: 'bash' });
assert.strictEqual(unknownPack.preflightReady, false, 'preflightReady must be false for unknown product');
console.log('  PASS: unknown product handled correctly');

const badShell = tool.buildPreflightPack({ targetProduct: 'sales_dx', shellType: 'zsh_unknown' });
assert.strictEqual(badShell.preflightReady, false, 'preflightReady must be false for unknown shell');
console.log('  PASS: unknown shell type handled correctly');

console.log('PASS: external-repo-preflight-command-pack');
