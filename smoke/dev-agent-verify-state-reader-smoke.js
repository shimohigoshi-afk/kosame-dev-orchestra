'use strict';
const { readVerifyState, parseVerifyLog } = require('../tools/verify-state-reader');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== verify-state-reader smoke ===');

// Test 1: all pass via structured input
const r1 = readVerifyState({ exitCode: 0, passedCount: 420, failedCount: 0, failedSmokes: [], durationMs: 45000 });
assert('reader field', r1.reader === 'verify-state-reader');
assert('all pass: verifyStatus passed', r1.verifyStatus === 'passed');
assert('all pass: hasFailures false', r1.hasFailures === false);
assert('all pass: passRate 100', r1.passRate === 100);
assert('version 3.2.0', r1.version === '3.2.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: failures via structured
const r2 = readVerifyState({ exitCode: 1, passedCount: 416, failedCount: 4, failedSmokes: ['smoke-a', 'smoke-b'] });
assert('failure: verifyStatus failed', r2.verifyStatus === 'failed');
assert('failure: hasFailures true', r2.hasFailures === true);
assert('failure: failedSmokes len 2', r2.failedSmokes.length === 2);

// Test 3: not run
const r3 = readVerifyState({ exitCode: -1 });
assert('not run: verifyStatus not_run', r3.verifyStatus === 'not_run');

// Test 4: parse log text - all pass
const parsed1 = parseVerifyLog('  PASS: test1\n  PASS: test2\nPASS: 420 / 420\n');
assert('parse log pass: verifyStatus passed', parsed1.verifyStatus === 'passed');
assert('parse log pass: passedCount', parsed1.passedCount > 0);

// Test 5: parse log text - failure
const parsed2 = parseVerifyLog('  FAIL: some-smoke\nFAILED: 1 / 10\n');
assert('parse log fail: verifyStatus failed', parsed2.verifyStatus === 'failed');
assert('parse log fail: failedCount > 0', parsed2.failedCount > 0);

// Test 6: timeout detection
const r6 = readVerifyState({ logText: 'running tests...\ntimeout after 60s\n', exitCode: 1 });
assert('timeout: verifyStatus timeout', r6.verifyStatus === 'timeout');
assert('timeout: hasTimeout true', r6.hasTimeout === true);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
