'use strict';
const { generateTagReadinessPacket } = require('../tools/tag-readiness-packet');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== tag-readiness-packet smoke ===');

// Test 1: ready for tag
const r1 = generateTagReadinessPacket({
  targetVersion: '2.9.0',
  packageVersion: '2.9.0',
  headCommit: 'abc1234def',
  actionsStatus: 'success',
  verifyPassed: 94,
  verifyFailed: 0,
  releaseDocsPath: 'docs/ai-dev-team/v2.9.0-release-record.md'
});
assert('packet field', r1.packet === 'tag-readiness-packet');
assert('readyForTag true', r1.readyForTag === true);
assert('tagCommands has git tag', r1.tagCommands.some(c => c.includes('git tag v2.9.0')));
assert('tagCommands has git push', r1.tagCommands.some(c => c.includes('git push')));
assert('gate_required always', r1.gate_required === true);
assert('humanApprovalRequired always', r1.humanApprovalRequired === true);
assert('version 2.9.0', r1.version === '2.9.0');
assert('dryRun true', r1.dryRun === true);
assert('summary contains version', r1.summary.includes('2.9.0'));
assert('headCommit truncated', r1.headCommit.length === 7);

// Test 2: version mismatch → not ready
const r2 = generateTagReadinessPacket({
  targetVersion: '2.9.0',
  packageVersion: '2.8.0',
  actionsStatus: 'success',
  verifyPassed: 94,
  verifyFailed: 0
});
assert('version mismatch: readyForTag false', r2.readyForTag === false);
assert('version mismatch: tagCommands empty', r2.tagCommands.length === 0);

// Test 3: actions not success → not ready
const r3 = generateTagReadinessPacket({
  targetVersion: '2.9.0',
  packageVersion: '2.9.0',
  actionsStatus: 'pending',
  verifyPassed: 94,
  verifyFailed: 0
});
assert('actions pending: readyForTag false', r3.readyForTag === false);

// Test 4: verify failed → not ready
const r4 = generateTagReadinessPacket({
  targetVersion: '2.9.0',
  packageVersion: '2.9.0',
  actionsStatus: 'success',
  verifyPassed: 90,
  verifyFailed: 4
});
assert('verify failed: readyForTag false', r4.readyForTag === false);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
