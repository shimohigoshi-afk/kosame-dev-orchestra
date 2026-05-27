'use strict';
const { runVpOperationLoop, LOOP_VERSION, LOOP_PHASES } = require('../tools/kosame-vp-operation-loop');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-vp-operation-loop smoke ===');

// Full loop: all green
const r1 = runVpOperationLoop({
  rawData: {
    packageVersion: '3.5.0',
    repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
    actions: { status: 'success', conclusion: 'success', jobResults: [] },
    verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
    providerHealth: { gemini: 'gemini_auth_error', claude: 'claude_available' }
  },
  sessionGoal: 'Release v3.5.0',
  commandOperation: 'status'
});
assert('loop field', r1.loop === 'kosame-vp-operation-loop');
assert('loop_version 3.5.0', r1.loop_version === '3.5.0');
assert('dryRun true', r1.dryRun === true);
assert('all green: primaryNextAction release', r1.primaryNextAction === 'release_candidate' || r1.primaryNextAction === 'request_release_approval');
assert('phases: state_read', 'state_read' in r1.phases);
assert('phases: decision_report', 'decision_report' in r1.phases);
assert('phases: safe_command_proposal', 'safe_command_proposal' in r1.phases);
assert('phases: human_approval_gate', 'human_approval_gate' in r1.phases);
assert('phases: next_dispatch', 'next_dispatch' in r1.phases);
assert('phases: handoff', 'handoff' in r1.phases);
assert('completedPhases >= 5', r1.completedPhases.length >= 5);
assert('LOOP_PHASES 7', LOOP_PHASES.length === 7);
assert('LOOP_VERSION 3.5.0', LOOP_VERSION === '3.5.0');

// Verify failed → repair
const r2 = runVpOperationLoop({
  rawData: {
    repo: {},
    actions: { status: 'unknown', jobResults: [] },
    verify: { exitCode: 1, passedCount: 416, failedCount: 4 }
  },
  commandOperation: 'status'
});
assert('verify fail loop: primaryNextAction fix_verify', r2.primaryNextAction === 'fix_verify');

// Skip phases
const r3 = runVpOperationLoop({
  rawData: { repo: {}, actions: {}, verify: {} },
  skipPhases: ['safe_command_proposal', 'execution_review']
});
assert('skip: safe_command_proposal absent', !('safe_command_proposal' in r3.phases));
assert('skip: state_read present', 'state_read' in r3.phases);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
