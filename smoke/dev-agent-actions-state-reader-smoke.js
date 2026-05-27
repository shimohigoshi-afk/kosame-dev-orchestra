'use strict';
const { readActionsState, parseGhRunListText } = require('../tools/actions-state-reader');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== actions-state-reader smoke ===');

// Test 1: success via runListText
const r1 = readActionsState({ runListText: 'success\tKOSAME Verify\tmain\t2min\nsuccess\tPM Agent\tmain\t1min' });
assert('reader field', r1.reader === 'actions-state-reader');
assert('success: actionsStatus success', r1.actionsStatus === 'success');
assert('success: runs len 2', r1.runs.length === 2);
assert('success: hasFailures false', r1.hasFailures === false);
assert('version 3.2.0', r1.version === '3.2.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: failure via runListText
const r2 = readActionsState({ runListText: 'failure\tCI\tmain\t3min' });
assert('failure: actionsStatus failed', r2.actionsStatus === 'failed');
assert('failure: hasFailures true', r2.hasFailures === true);

// Test 3: pending via runListText
const r3 = readActionsState({ runListText: 'in_progress\tCI\tmain' });
assert('pending: actionsStatus pending', r3.actionsStatus === 'pending');

// Test 4: structured input (no text)
const r4 = readActionsState({ status: 'success', conclusion: 'success', jobResults: [{ name: 'test', conclusion: 'success' }] });
assert('structured success: actionsStatus', r4.actionsStatus === 'success');
assert('structured success: successJobs', r4.successJobs.length === 1);

// Test 5: failure via structured
const r5 = readActionsState({ status: 'failure', conclusion: 'failure', jobResults: [{ name: 'test', conclusion: 'failure' }] });
assert('structured failure: actionsStatus failed', r5.actionsStatus === 'failed');
assert('structured failure: failedJobs', r5.failedJobs.includes('test'));

// Test 6: parseGhRunListText directly
const parsed = parseGhRunListText('success\tCI\tmain\nfailure\tDeploy\tmain');
assert('parse: 2 runs', parsed.runs.length === 2);
assert('parse: latest is success', parsed.actionsStatus === 'success');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
