'use strict';
const { suggestNextPhase, PHASE_SUGGESTIONS } = require('../tools/post-release-next-phase-suggestion');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== post-release-next-phase-suggestion smoke ===');

// Test 1: v2.9.0 complete, all clear
const r1 = suggestNextPhase({
  completedVersion: '2.9.0',
  openIssues: [],
  failedSmokes: [],
  providerHealth: { gemini: 'gemini_available', claude: 'claude_available' }
});
assert('suggestion field', r1.suggestion === 'post-release-next-phase-suggestion');
assert('v2.9.0 → nextVersion v3.0.0', r1.nextVersion === 'v3.0.0');
assert('readyForNextPhase true', r1.readyForNextPhase === true);
assert('immediateActions empty', r1.immediateActions.length === 0);
assert('phaseName mentions Operating Console', r1.phaseName.includes('Operating Console'));
assert('keyDeliverables has foundation', r1.keyDeliverables.some(d => d.includes('foundation')));
assert('version 2.9.0', r1.version === '2.9.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: failed smokes → not ready
const r2 = suggestNextPhase({
  completedVersion: '2.9.0',
  failedSmokes: ['dev-agent-foo-smoke.js'],
  openIssues: []
});
assert('failed smokes: readyForNextPhase false', r2.readyForNextPhase === false);
assert('failed smokes: immediateAction listed', r2.immediateActions.some(a => a.includes('failing smokes')));

// Test 3: gemini error → action suggested
const r3 = suggestNextPhase({
  completedVersion: '2.9.0',
  providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' },
  failedSmokes: [],
  openIssues: []
});
assert('gemini error: immediateAction for gemini', r3.immediateActions.some(a => a.includes('Gemini')));

// Test 4: with 'v' prefix on version
const r4 = suggestNextPhase({ completedVersion: 'v2.9.0' });
assert('v-prefix: nextVersion v3.0.0', r4.nextVersion === 'v3.0.0');

// Test 5: PHASE_SUGGESTIONS export
assert('PHASE_SUGGESTIONS exported', typeof PHASE_SUGGESTIONS === 'object');
assert('PHASE_SUGGESTIONS has v2.9.0', 'v2.9.0' in PHASE_SUGGESTIONS);

// Test 6: unknown version → TBD
const r6 = suggestNextPhase({ completedVersion: '99.0.0' });
assert('unknown version: nextVersion TBD', r6.nextVersion === 'TBD');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
