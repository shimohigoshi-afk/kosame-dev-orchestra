'use strict';
const { createCombinedStateSnapshot } = require('../tools/combined-state-snapshot');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== combined-state-snapshot smoke ===');

// Test 1: all green
const r1 = createCombinedStateSnapshot({
  packageVersion: '3.2.0',
  repo: { gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234' },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 0, passedCount: 420, failedCount: 0 },
  providerHealth: { gemini: 'gemini_available', claude: 'claude_available' }
});
assert('snapshot field', r1.snapshot === 'combined-state-snapshot');
assert('all green: overallHealth healthy', r1.overallHealth === 'healthy');
assert('all green: issueCount 0', r1.issueCount === 0);
assert('all green: actionsStatus success', r1.actionsStatus === 'success');
assert('all green: verifyStatus passed', r1.verifyStatus === 'passed');
assert('all green: workingTreeClean', r1.workingTreeClean === true);
assert('all green: geminiAvailable', r1.geminiAvailable === true);
assert('version 3.2.0', r1.version === '3.2.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: verify failed → issue
const r2 = createCombinedStateSnapshot({
  verify: { exitCode: 1, passedCount: 416, failedCount: 4 },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  repo: {}
});
assert('verify fail: issueCount > 0', r2.issueCount > 0);
assert('verify fail: health degraded', r2.overallHealth === 'degraded');
assert('verify fail: verifyStatus failed', r2.verifyStatus === 'failed');

// Test 3: multiple issues → critical
const r3 = createCombinedStateSnapshot({
  repo: { gitStatusSbText: '## main...origin/main [ahead 1]\n M a.js\n M b.js\n M c.js' },
  actions: { status: 'failure', conclusion: 'failure', jobResults: [{ name: 'test', conclusion: 'failure' }] },
  verify: { exitCode: 1, passedCount: 400, failedCount: 20 }
});
assert('multi-issue: health critical', r3.overallHealth === 'critical');

// Test 4: flattened fields
assert('flattened branch', typeof r1.branch === 'string');
assert('flattened isAhead', r1.isAhead === false);
assert('nested repo reader', r1.repo.reader === 'repo-state-reader');
assert('nested actions reader', r1.actions.reader === 'actions-state-reader');
assert('nested verify reader', r1.verify.reader === 'verify-state-reader');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
