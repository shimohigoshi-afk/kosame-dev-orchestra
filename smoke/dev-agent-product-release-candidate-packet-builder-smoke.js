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
const tool   = require('../tools/product-release-candidate-packet-builder-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== product-release-candidate-packet-builder-pack smoke ===');

assert.ok(compareVersion(pkg.version, '19.0.0') >= 0, `pkg version must be >= 19.0.0, got ${pkg.version}`);
console.log('  PASS: package version 19.0.0 or later');

assert.ok(pkg.scripts['smoke:product-release-candidate-packet-builder'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:product-release-candidate-packet-builder'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v19.0.0-release-record.md')), 'release record must exist');
console.log('  PASS: release record exists');

assert.ok(fs.existsSync(path.join(__dirname, '../fixtures/product-release-candidate-packet-builder.sample.json')), 'fixture must exist');
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '19.0.0', 'tool version must be 19.0.0');
console.log('  PASS: tool meta version 19.0.0');

const packet = tool.buildReleaseCandidatePacket({
  targetProduct:   'sales_dx',
  targetRepo:      'kosame-sales-dx',
  taskGoal:        'CSVエクスポート機能追加',
  intendedFiles:   ['src/leads/csv-export.js', 'tests/leads/csv-export.test.js'],
  version:         '1.2.0',
  rollbackNote:    'git checkout -- src/leads/csv-export.js',
  verifyPassed:    true,
  nodeCheckPassed: true,
  smokePassed:     true
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.releaseCandidateId, 'releaseCandidateId must be present');
console.log('  PASS: releaseCandidateId present');

assert.ok(packet.targetProduct, 'targetProduct must be present');
assert.ok(packet.targetRepo, 'targetRepo must be present');
console.log('  PASS: targetProduct and targetRepo present');

assert.ok(Array.isArray(packet.intendedFiles), 'intendedFiles must be array');
assert.ok(Array.isArray(packet.deniedFiles), 'deniedFiles must be array');
console.log('  PASS: intendedFiles and deniedFiles present');

assert.ok(packet.verificationSummary, 'verificationSummary must be present');
assert.strictEqual(packet.verificationSummary.allPassed, true, 'allPassed must be true');
console.log('  PASS: verificationSummary.allPassed true');

assert.ok(typeof packet.releaseNotesDraft === 'string' && packet.releaseNotesDraft.length > 0, 'releaseNotesDraft must be non-empty');
console.log('  PASS: releaseNotesDraft present');

assert.ok(typeof packet.rollbackNote === 'string', 'rollbackNote must be string');
console.log('  PASS: rollbackNote present');

assert.ok(Array.isArray(packet.prePushChecklist) && packet.prePushChecklist.length > 0, 'prePushChecklist must be non-empty');
assert.ok(packet.prePushChecklist.some(c => c.item.includes('じゅんやさん')), 'prePushChecklist must include じゅんやさん');
console.log('  PASS: prePushChecklist valid');

assert.ok(Array.isArray(packet.preDeployChecklist) && packet.preDeployChecklist.length > 0, 'preDeployChecklist must be non-empty');
console.log('  PASS: preDeployChecklist present');

assert.ok(Array.isArray(packet.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(packet.dangerousActionsDenied.includes('git commit'), 'must include git commit');
assert.ok(packet.dangerousActionsDenied.includes('git push'),   'must include git push');
assert.ok(packet.dangerousActionsDenied.includes('git tag'),    'must include git tag');
assert.ok(packet.dangerousActionsDenied.includes('deploy'),     'must include deploy');
console.log('  PASS: dangerousActionsDenied valid');

assert.ok(Array.isArray(packet.absolutelyForbidden), 'absolutelyForbidden must be array');
assert.ok(packet.absolutelyForbidden.some(a => a.includes('deploy')), 'absolutelyForbidden must include deploy');
console.log('  PASS: absolutelyForbidden present');

assert.strictEqual(packet.isDeniedIncluded, false, 'isDeniedIncluded must be false for clean files');
assert.strictEqual(packet.readyForHumanReview, true, 'readyForHumanReview must be true when all passed');
console.log('  PASS: readyForHumanReview true');

// denied file detection
const deniedPacket = tool.buildReleaseCandidatePacket({
  targetProduct: 'sales_dx',
  intendedFiles: ['.env'],
  deniedFiles:   ['.env'],
  verifyPassed: true, nodeCheckPassed: true, smokePassed: true
});
assert.strictEqual(deniedPacket.isDeniedIncluded, true, 'isDeniedIncluded must be true for .env');
assert.strictEqual(deniedPacket.readyForHumanReview, false, 'readyForHumanReview must be false when denied file included');
console.log('  PASS: denied file detection works');

assert.strictEqual(packet.noRealRelease, true);
assert.strictEqual(packet.noRealDeploy, true);
assert.strictEqual(packet.noRealPush, true);
console.log('  PASS: no real release/deploy/push flags');

console.log('PASS: product-release-candidate-packet-builder-pack');
