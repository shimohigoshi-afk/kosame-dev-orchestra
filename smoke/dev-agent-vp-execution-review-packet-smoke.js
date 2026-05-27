'use strict';
const { reviewExecutionResult, VERDICTS } = require('../tools/vp-execution-review-packet');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== vp-execution-review-packet smoke ===');

// release candidate (all green)
const r1 = reviewExecutionResult({ operation: 'npm run verify', exitCode: 0, stdout: 'PASS: 420 / 420', stderr: '', verifyStatus: 'passed', actionsStatus: 'success' });
assert('packet field', r1.packet === 'vp-execution-review-packet');
assert('release_candidate', r1.verdict === VERDICTS.RELEASE_CANDIDATE);
assert('succeeded true', r1.succeeded === true);
assert('version 3.5.0', r1.version === '3.5.0');
assert('dryRun true', r1.dryRun === true);
assert('requiresHumanApproval release', r1.requiresHumanApproval === true);

// success (verify not yet run)
const r2 = reviewExecutionResult({ operation: 'git status', exitCode: 0, stdout: 'nothing to commit', stderr: '', verifyStatus: 'not_run' });
assert('success verdict', r2.verdict === VERDICTS.SUCCESS);
assert('success: nextSteps has verify', r2.nextSteps.some(s => s.includes('verify')));

// claude_repair (FAIL in output)
const r3 = reviewExecutionResult({ operation: 'npm run verify', exitCode: 1, stdout: 'FAIL: some-smoke', stderr: 'verify FAILED\n', verifyStatus: 'failed' });
assert('claude_repair verdict', r3.verdict === VERDICTS.CLAUDE_REPAIR);
assert('claude_repair: nextSteps has Claude', r3.nextSteps.some(s => s.includes('Claude')));

// failure (generic)
const r4 = reviewExecutionResult({ operation: 'unknown', exitCode: 127, stdout: '', stderr: 'command not found' });
assert('failure verdict', r4.verdict === VERDICTS.FAILURE);
assert('failure: succeeded false', r4.succeeded === false);

// VERDICTS export
assert('VERDICTS.SUCCESS', VERDICTS.SUCCESS === 'success');
assert('VERDICTS.CLAUDE_REPAIR', VERDICTS.CLAUDE_REPAIR === 'claude_repair');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
