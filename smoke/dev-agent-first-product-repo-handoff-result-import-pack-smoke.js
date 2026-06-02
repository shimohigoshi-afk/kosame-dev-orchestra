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
const tool   = require('../tools/first-product-repo-handoff-result-import-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== first-product-repo-handoff-result-import-pack smoke ===');

assert.ok(compareVersion(pkg.version, '26.0.0') >= 0, `pkg version must be >= 26.0.0, got ${pkg.version}`);
console.log('  PASS: package version 26.0.0 or later');

assert.ok(pkg.scripts['smoke:first-product-repo-handoff-result-import-pack'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:first-product-repo-handoff-result-import-pack'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v26.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/first-product-repo-handoff-result-import-pack.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '26.0.0', 'tool version must be 26.0.0');
console.log('  PASS: tool meta version 26.0.0');

// ---- clean import case ----
const cleanPack = tool.buildHandoffImportPack({
  targetProduct:          'sales_dx',
  taskGoal:               '営業DXにリード向けメール一括返信機能を追加した',
  version:                '1.5.0',
  claudeReportSummary:    '2 files created in src/leads/. All tests passing. No out-of-scope files touched.',
  changedFilesReported:   ['src/leads/bulk-email-reply.js', 'tests/leads/bulk-email-reply.test.js'],
  verificationResultsRaw: 'All tests passed.',
  nodeCheckRaw:           'ok',
  gitStatusReported:      '?? src/leads/bulk-email-reply.js',
  risksReported:          [],
  rollbackNote:           'git checkout -- src/leads/bulk-email-reply.js',
  allowedFileZones:       ['src/leads/**', 'src/components/**', 'tests/**', 'docs/**'],
  deniedFileZones:        ['.env*', 'secrets/**', 'credentials/**']
});

assert.strictEqual(cleanPack.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(cleanPack.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(cleanPack.handoffImportId, 'handoffImportId must be present');
console.log('  PASS: handoffImportId present');

assert.ok(cleanPack.claudeReportSummary, 'claudeReportSummary must be present');
console.log('  PASS: claudeReportSummary present');

assert.ok(Array.isArray(cleanPack.changedFilesReported), 'changedFilesReported must be array');
console.log('  PASS: changedFilesReported array');

assert.ok(cleanPack.verificationResultsReported, 'verificationResultsReported must be present');
assert.strictEqual(cleanPack.verificationResultsReported.passed, true, 'verificationResultsReported.passed must be true');
console.log('  PASS: verificationResultsReported.passed true');

assert.ok(cleanPack.fileZoneCheck, 'fileZoneCheck must be present');
assert.strictEqual(cleanPack.fileZoneCheck.clean, true, 'fileZoneCheck.clean must be true for allowed files');
console.log('  PASS: fileZoneCheck.clean true');

assert.strictEqual(cleanPack.hasSensitiveContent, false, 'hasSensitiveContent must be false for clean report');
console.log('  PASS: no sensitive content detected');

assert.ok(Array.isArray(cleanPack.blockedItems), 'blockedItems must be array');
assert.ok(Array.isArray(cleanPack.acceptedItems), 'acceptedItems must be array');
assert.ok(Array.isArray(cleanPack.rejectedItems), 'rejectedItems must be array');
assert.ok(cleanPack.acceptedItems.length > 0, 'acceptedItems must be non-empty for clean report');
assert.strictEqual(cleanPack.rejectedItems.length, 0, 'rejectedItems must be empty for clean report');
console.log('  PASS: acceptedItems/blockedItems/rejectedItems valid');

assert.strictEqual(cleanPack.commitCandidateReady, true, 'commitCandidateReady must be true for clean report');
console.log('  PASS: commitCandidateReady true');

assert.ok(typeof cleanPack.commitMessageCandidate === 'string' && cleanPack.commitMessageCandidate.length > 0, 'commitMessageCandidate must be non-empty');
assert.ok(!cleanPack.commitMessageCandidate.includes('not ready'), 'commitMessageCandidate must not say not ready');
console.log('  PASS: commitMessageCandidate present');

assert.ok(typeof cleanPack.tagCandidate === 'string', 'tagCandidate must be string');
assert.ok(cleanPack.tagCandidate.includes('1.5.0'), 'tagCandidate must include version');
console.log('  PASS: tagCandidate present');

assert.ok(cleanPack.rollbackNote, 'rollbackNote must be present');
console.log('  PASS: rollbackNote present');

assert.strictEqual(cleanPack.importReady, true, 'importReady must be true for clean report');
console.log('  PASS: importReady true');

assert.ok(Array.isArray(cleanPack.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(cleanPack.dangerousActionsDenied.some(a => a.includes('git commit')), 'must include git commit');
assert.ok(cleanPack.dangerousActionsDenied.some(a => a.includes('deploy')), 'must include deploy');
console.log('  PASS: dangerousActionsDenied valid');

assert.strictEqual(cleanPack.noRealCommit, true, 'noRealCommit must be true');
assert.strictEqual(cleanPack.noRealPush,   true, 'noRealPush must be true');
assert.strictEqual(cleanPack.noRealTag,    true, 'noRealTag must be true');
assert.strictEqual(cleanPack.noRealDeploy, true, 'noRealDeploy must be true');
console.log('  PASS: no real git/deploy flags');

// ---- sensitive content detection ----
const sensitivePack = tool.buildHandoffImportPack({
  targetProduct:       'sales_dx',
  taskGoal:            'test',
  claudeReportSummary: 'Updated api key in config file',
  changedFilesReported: ['src/leads/test.js'],
  allowedFileZones:    ['src/leads/**'],
  deniedFileZones:     ['.env*', 'secrets/**']
});
assert.strictEqual(sensitivePack.hasSensitiveContent, true, 'hasSensitiveContent must be true for api key report');
assert.ok(sensitivePack.sensitiveFound.length > 0, 'sensitiveFound must be non-empty');
assert.strictEqual(sensitivePack.commitCandidateReady, false, 'commitCandidateReady must be false when sensitive content');
assert.strictEqual(sensitivePack.importReady, false, 'importReady must be false when sensitive content');
console.log('  PASS: sensitive content detection works (api key)');

// ---- denied file detection ----
const deniedFilePack = tool.buildHandoffImportPack({
  targetProduct:       'sales_dx',
  taskGoal:            'test',
  claudeReportSummary: 'edited files',
  changedFilesReported: ['secrets/api.json'],
  allowedFileZones:    ['src/**'],
  deniedFileZones:     ['secrets/**']
});
assert.strictEqual(deniedFilePack.fileZoneCheck.clean, false, 'fileZoneCheck.clean must be false for denied file');
assert.strictEqual(deniedFilePack.commitCandidateReady, false, 'commitCandidateReady must be false for denied file');
console.log('  PASS: denied file detection works');

// ---- dangerous operation detection ----
const dangerousPack = tool.buildHandoffImportPack({
  targetProduct:       'sales_dx',
  taskGoal:            'test',
  claudeReportSummary: 'ran git commit and git push',
  changedFilesReported: ['src/leads/test.js'],
  allowedFileZones:    ['src/leads/**'],
  deniedFileZones:     ['.env*']
});
assert.ok(dangerousPack.dangerousOpsInReport.length > 0, 'dangerousOpsInReport must be non-empty for dangerous ops report');
assert.strictEqual(dangerousPack.needsHumanApproval, true, 'needsHumanApproval must be true when dangerous ops detected');
console.log('  PASS: dangerous operation detection works');

// ---- empty report case ----
const emptyPack = tool.buildHandoffImportPack({ targetProduct: 'sales_dx', taskGoal: 'test' });
assert.strictEqual(emptyPack.commitCandidateReady, false, 'commitCandidateReady must be false for empty report');
assert.strictEqual(emptyPack.importReady, false, 'importReady must be false for empty report');
console.log('  PASS: empty report handled correctly');

// ---- ANESTY: insurance pattern in report ----
const anestyPack = tool.buildHandoffImportPack({
  targetProduct:       'anesty_board',
  taskGoal:            'test',
  claudeReportSummary: 'accessed insurance data table',
  changedFilesReported: ['src/board/component.js'],
  allowedFileZones:    ['src/board/**'],
  deniedFileZones:     ['src/insurance/**', '.env*']
});
assert.strictEqual(anestyPack.hasSensitiveContent, true, 'hasSensitiveContent must be true for insurance content');
assert.strictEqual(anestyPack.commitCandidateReady, false, 'commitCandidateReady must be false for insurance content');
console.log('  PASS: ANESTY insurance content detection works');

for (const p of tool.SUPPORTED_PRODUCTS) assert.ok(tool.SUPPORTED_PRODUCTS.includes(p));
console.log('  PASS: all 5 product types in SUPPORTED_PRODUCTS');

console.log('PASS: first-product-repo-handoff-result-import-pack');
