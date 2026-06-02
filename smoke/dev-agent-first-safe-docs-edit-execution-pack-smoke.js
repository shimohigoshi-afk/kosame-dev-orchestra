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
const tool   = require('../tools/first-safe-docs-edit-execution-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-safe-docs-edit-execution-pack smoke ===');

assert.ok(compareVersion(pkg.version, '15.0.0') >= 0, `package version must be 15.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 15.0.0 or later');

assert.ok(pkg.scripts['smoke:first-safe-docs-edit-execution'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-safe-docs-edit-execution'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v15.0.0-release-record.md')),
  'v15.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/first-safe-docs-edit-execution.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '15.0.0', 'tool meta version must be 15.0.0');
console.log('  PASS: tool meta version 15.0.0');

const pack = tool.buildSafeDocsEditPack({
  taskGoal:    'README.mdにv15.0.0 First Safe Docs Edit Execution Packの説明を追加する',
  targetFiles: ['README.md'],
  editScopeDesc: 'Add v15.0.0 section to README.md'
});

assert.strictEqual(pack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(pack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(pack.packId, 'packId must be present');
console.log('  PASS: packId present');

assert.ok(Array.isArray(pack.allowedFiles) && pack.allowedFiles.length > 0, 'allowedFiles must be non-empty array');
console.log('  PASS: allowedFiles present');

assert.ok(Array.isArray(pack.deniedFiles) && pack.deniedFiles.length > 0, 'deniedFiles must be non-empty array');
console.log('  PASS: deniedFiles present');

assert.ok(Array.isArray(pack.editScope), 'editScope must be array');
console.log('  PASS: editScope is array');

assert.ok(Array.isArray(pack.verifyCommands), 'verifyCommands must be array');
console.log('  PASS: verifyCommands present');

assert.ok(Array.isArray(pack.doneCriteria), 'doneCriteria must be array');
console.log('  PASS: doneCriteria present');

assert.ok(typeof pack.rollbackHint === 'string' && pack.rollbackHint.length > 0, 'rollbackHint must be string');
console.log('  PASS: rollbackHint present');

assert.ok(Array.isArray(pack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(pack.dangerousActionsDenied.includes('git commit'), 'must include git commit');
assert.ok(pack.dangerousActionsDenied.includes('git push'),   'must include git push');
assert.ok(pack.dangerousActionsDenied.includes('git tag'),    'must include git tag');
console.log('  PASS: dangerousActionsDenied includes git commit/push/tag');

assert.strictEqual(pack.noRealFileEdit, true, 'noRealFileEdit must be true');
assert.strictEqual(pack.noRealCommit,   true, 'noRealCommit must be true');
assert.strictEqual(pack.noRealPush,     true, 'noRealPush must be true');
assert.strictEqual(pack.noRealTag,      true, 'noRealTag must be true');
console.log('  PASS: all no-real-* flags true');

// README.md should be allowed
const readmeScope = pack.editScope.find(s => s.file === 'README.md');
assert.ok(readmeScope, 'editScope must include README.md');
assert.strictEqual(readmeScope.isAllowed, true, 'README.md must be allowed');
assert.strictEqual(readmeScope.isDenied,  false, 'README.md must not be denied');
console.log('  PASS: README.md is allowed in editScope');

// .env should be denied
const deniedPack = tool.buildSafeDocsEditPack({
  taskGoal:    'test',
  targetFiles: ['./.env']
});
const envScope = deniedPack.editScope.find(s => s.file === './.env');
assert.ok(envScope, 'editScope must include .env');
assert.strictEqual(envScope.isDenied, true, '.env must be denied');
console.log('  PASS: .env is denied in editScope');

console.log('PASS: first-safe-docs-edit-execution-pack');
