'use strict';
const { generateReleaseHandoffPacket } = require('../tools/release-handoff-packet');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== release-handoff-packet smoke ===');

// Test 1: incomplete release (no tag/push yet)
const r1 = generateReleaseHandoffPacket({
  releasedVersion: '2.9.0',
  previousVersion: '2.8.0',
  tagCreated: false,
  pushedToRemote: false,
  newToolCount: 4,
  newSmokeCount: 5,
  totalSmokePassed: 94,
  nextMilestone: 'v3.0.0'
});
assert('packet field', r1.packet === 'release-handoff-packet');
assert('incomplete: releaseComplete false', r1.releaseComplete === false);
assert('incomplete: humanApprovalRequired', r1.humanApprovalRequired === true);
assert('incomplete: nextSteps has tag', r1.nextSteps.some(s => s.includes('git tag')));
assert('incomplete: nextSteps has push', r1.nextSteps.some(s => s.includes('git push')));
assert('incomplete: nextSteps has milestone', r1.nextSteps.some(s => s.includes('v3.0.0')));
assert('version 2.9.0', r1.version === '2.9.0');
assert('dryRun true', r1.dryRun === true);
assert('summary mentions 2.9.0', r1.summary.includes('2.9.0'));

// Test 2: complete release
const r2 = generateReleaseHandoffPacket({
  releasedVersion: '2.9.0',
  tagCreated: true,
  pushedToRemote: true,
  newToolCount: 4,
  newSmokeCount: 5,
  totalSmokePassed: 94
});
assert('complete: releaseComplete true', r2.releaseComplete === true);
assert('complete: humanApprovalRequired false', r2.humanApprovalRequired === false);
assert('complete: no tag step in nextSteps', !r2.nextSteps.some(s => s.includes('git tag')));

// Test 3: handoffItems
assert('handoffItems is array', Array.isArray(r1.handoffItems));
assert('handoffItems has tool count', r1.handoffItems.some(i => i.includes('4件')));

// Test 4: monitoring notes default
const r3 = generateReleaseHandoffPacket({ releasedVersion: '2.9.0' });
assert('default monitoring notes', r3.monitoringNotes.length > 0);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
