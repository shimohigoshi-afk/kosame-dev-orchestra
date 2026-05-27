'use strict';
const { importGitHubActionsResult } = require('../tools/github-actions-result-importer');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== github-actions-result-importer smoke ===');

// Test 1: success
const r1 = importGitHubActionsResult({
  workflowName: 'CI',
  status: 'success',
  conclusion: 'success',
  runId: '99999',
  branch: 'main',
  commit: 'abc1234',
  durationSeconds: 180,
  jobResults: [{ name: 'build', conclusion: 'success' }, { name: 'test', conclusion: 'success' }]
});
assert('importer field', r1.importer === 'github-actions-result-importer');
assert('success: actionsStatus success', r1.actionsStatus === 'success');
assert('success: hasFailures false', r1.hasFailures === false);
assert('success: successJobs len 2', r1.successJobs.length === 2);
assert('version 2.7.0', r1.version === '2.7.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: failure
const r2 = importGitHubActionsResult({
  status: 'failure',
  conclusion: 'failure',
  jobResults: [{ name: 'test', conclusion: 'failure' }, { name: 'build', conclusion: 'success' }]
});
assert('failure: actionsStatus failed', r2.actionsStatus === 'failed');
assert('failure: hasFailures true', r2.hasFailures === true);
assert('failure: failedJobs has test', r2.failedJobs.includes('test'));

// Test 3: pending
const r3 = importGitHubActionsResult({ status: 'pending', jobResults: [] });
assert('pending: actionsStatus pending', r3.actionsStatus === 'pending');

// Test 4: unknown status
const r4 = importGitHubActionsResult({ status: 'bogus_status' });
assert('unknown: actionsStatus unknown', r4.actionsStatus === 'unknown');

// Test 5: commit truncated
const r5 = importGitHubActionsResult({ commit: 'abcdef1234567890' });
assert('commit truncated to 7', r5.commit.length === 7);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
