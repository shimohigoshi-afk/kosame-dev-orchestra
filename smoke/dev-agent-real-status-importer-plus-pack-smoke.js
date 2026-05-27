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
const fs = require('fs');
const path = require('path');
const tool = require('../tools/real-status-importer-plus-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== real-status-importer-plus-pack smoke ===');

assert.ok(compareVersion(pkg.version, '6.1.0') >= 0);
console.log('  PASS: package version 6.1.0 or later');

assert.ok(pkg.scripts['smoke:real-status-importer-plus-pack']);
console.log('  PASS: script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v6.1.0-release-record.md')));
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/real-status-importer-plus.sample.json')));
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '6.1.0');
console.log('  PASS: tool meta version');

const packet = tool.buildPacket({ packageVersion: '6.1.0', verifyResult: { passed: true, totalSmokes: 5, failedSmokes: [] } });
assert.strictEqual(packet.dryRun, true);
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true);
console.log('  PASS: human approval true');

const gitClean = tool.importGitStatus('');
assert.strictEqual(gitClean.clean, true);
console.log('  PASS: empty git status = clean');

const gitDirty = tool.importGitStatus(' M package.json\n?? newfile.js');
assert.strictEqual(gitDirty.clean, false);
assert.strictEqual(gitDirty.modified.length, 1);
assert.strictEqual(gitDirty.untracked.length, 1);
console.log('  PASS: dirty git status parsed');

const pkgVer = tool.importPackageVersion('6.1.0');
assert.strictEqual(pkgVer.major, 6);
assert.strictEqual(pkgVer.minor, 1);
console.log('  PASS: package version parsed');

const runs = tool.importGhRunList([
  { conclusion: 'success' }, { conclusion: 'failure' }, { conclusion: null }
]);
assert.strictEqual(runs.passing, 1);
assert.strictEqual(runs.failing, 1);
assert.strictEqual(runs.pending, 1);
console.log('  PASS: gh run list parsed');

const pStatus = tool.importProviderStatus({ claude: 'down' });
assert.ok(pStatus.downProviders.includes('claude'));
assert.strictEqual(pStatus.allUp, false);
console.log('  PASS: provider status down detected');

const verify = tool.importVerifyStatus({ passed: true, totalSmokes: 10, failedSmokes: [] });
assert.strictEqual(verify.passed, true);
console.log('  PASS: verify status imported');

console.log('PASS: real-status-importer-plus-pack');
