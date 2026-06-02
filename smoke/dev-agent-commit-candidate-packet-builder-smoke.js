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
const tool   = require('../tools/commit-candidate-packet-builder-pack.js');

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'));

console.log('=== commit-candidate-packet-builder-pack smoke ===');

assert.ok(compareVersion(pkg.version, '16.0.0') >= 0, `package version must be 16.0.0 or later, got ${pkg.version}`);
console.log('  PASS: package version 16.0.0 or later');

assert.ok(pkg.scripts['smoke:commit-candidate-packet-builder'], 'smoke script must exist');
console.log('  PASS: smoke script exists');

assert.ok(pkg.scripts['pm-agent:commit-candidate-packet-builder'], 'pm-agent script must exist');
console.log('  PASS: pm-agent script exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../docs/ai-dev-team/kosame-dev-orchestra-v16.0.0-release-record.md')),
  'v16.0.0 release record must exist'
);
console.log('  PASS: release record exists');

assert.ok(
  fs.existsSync(path.join(__dirname, '../fixtures/commit-candidate-packet-builder.sample.json')),
  'fixture must exist'
);
console.log('  PASS: fixture exists');

assert.strictEqual(tool.TOOL_META.version, '16.0.0', 'tool meta version must be 16.0.0');
console.log('  PASS: tool meta version 16.0.0');

const packet = tool.buildCommitCandidatePacket({
  taskGoal:       'v16.0.0 Commit Candidate Packet Builder implementation',
  intendedFiles:  ['tools/commit-candidate-packet-builder-pack.js', 'package.json'],
  deniedFiles:    ['.env', '.env.*', 'secrets/**'],
  version:        '16.0.0',
  commitMsgBody:  'Add Commit Candidate Packet Builder',
  rollbackNote:   'git checkout -- <files> to revert.',
  verifyPassed:   true,
  nodeCheckPassed: true
});

assert.strictEqual(packet.dryRun, true, 'dryRun must be true');
console.log('  PASS: dryRun true');

assert.strictEqual(packet.humanApprovalRequired, true, 'humanApprovalRequired must be true');
console.log('  PASS: humanApprovalRequired true');

assert.ok(packet.packetId, 'packetId must be present');
console.log('  PASS: packetId present');

assert.ok(Array.isArray(packet.intendedFiles), 'intendedFiles must be array');
console.log('  PASS: intendedFiles present');

assert.ok(Array.isArray(packet.deniedFiles), 'deniedFiles must be array');
console.log('  PASS: deniedFiles present');

assert.ok(Array.isArray(packet.stagedFilesPreview), 'stagedFilesPreview must be array');
console.log('  PASS: stagedFilesPreview present');

assert.ok(packet.diffStatPreview, 'diffStatPreview must be present');
console.log('  PASS: diffStatPreview present');

assert.ok(typeof packet.commitMessageCandidate === 'string' && packet.commitMessageCandidate.length > 0,
  'commitMessageCandidate must be non-empty string');
console.log('  PASS: commitMessageCandidate present');

assert.ok(typeof packet.tagCandidate === 'string' && packet.tagCandidate.length > 0,
  'tagCandidate must be non-empty string');
assert.ok(packet.tagCandidate.includes('16.0.0'), 'tagCandidate must include version');
console.log('  PASS: tagCandidate present and includes version');

assert.ok(Array.isArray(packet.prePushChecklist) && packet.prePushChecklist.length > 0,
  'prePushChecklist must be non-empty array');
console.log('  PASS: prePushChecklist present');

assert.ok(Array.isArray(packet.githubActionsChecklist) && packet.githubActionsChecklist.length > 0,
  'githubActionsChecklist must be non-empty array');
console.log('  PASS: githubActionsChecklist present');

assert.ok(typeof packet.rollbackNote === 'string', 'rollbackNote must be string');
console.log('  PASS: rollbackNote present');

assert.ok(Array.isArray(packet.dangerousActionsDenied), 'dangerousActionsDenied must be array');
assert.ok(packet.dangerousActionsDenied.includes('git add'),    'must include git add');
assert.ok(packet.dangerousActionsDenied.includes('git commit'), 'must include git commit');
assert.ok(packet.dangerousActionsDenied.includes('git push'),   'must include git push');
assert.ok(packet.dangerousActionsDenied.includes('git tag'),    'must include git tag');
console.log('  PASS: dangerousActionsDenied includes git add/commit/push/tag');

assert.ok(Array.isArray(packet.absolutelyForbidden), 'absolutelyForbidden must be array');
console.log('  PASS: absolutelyForbidden present');

// denied file check
const packetWithDenied = tool.buildCommitCandidatePacket({
  taskGoal:       'test denied',
  intendedFiles:  ['.env'],
  deniedFiles:    ['.env'],
  version:        '16.0.0',
  verifyPassed:   true,
  nodeCheckPassed: true
});
assert.strictEqual(packetWithDenied.isDeniedFileIncluded, true, 'isDeniedFileIncluded must be true when .env in intendedFiles');
assert.strictEqual(packetWithDenied.readyForHumanReview,  false, 'readyForHumanReview must be false when denied file included');
console.log('  PASS: denied file detection works');

console.log('PASS: commit-candidate-packet-builder-pack');
