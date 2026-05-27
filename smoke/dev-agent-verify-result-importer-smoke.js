'use strict';
const { importVerifyResult } = require('../tools/verify-result-importer');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== verify-result-importer smoke ===');

// Test 1: all pass
const r1 = importVerifyResult({ exitCode: 0, passedCount: 94, failedCount: 0, skippedCount: 0, failedSmokes: [], durationMs: 12000 });
assert('importer field', r1.importer === 'verify-result-importer');
assert('all pass: verifyStatus passed', r1.verifyStatus === 'passed');
assert('all pass: hasFailures false', r1.hasFailures === false);
assert('all pass: passRate 100', r1.passRate === 100);
assert('all pass: totalSmokes 94', r1.totalSmokes === 94);
assert('version 2.7.0', r1.version === '2.7.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: some failures
const r2 = importVerifyResult({ exitCode: 1, passedCount: 90, failedCount: 4, skippedCount: 0, failedSmokes: ['smoke-a', 'smoke-b'] });
assert('failures: verifyStatus failed', r2.verifyStatus === 'failed');
assert('failures: hasFailures true', r2.hasFailures === true);
assert('failures: failedSmokes len 2', r2.failedSmokes.length === 2);
assert('failures: passRate 96', r2.passRate === 96);

// Test 3: not run
const r3 = importVerifyResult({ exitCode: -1 });
assert('not run: verifyStatus not_run', r3.verifyStatus === 'not_run');
assert('not run: passRate 0', r3.passRate === 0);

// Test 4: zero total smokes → passRate 0
const r4 = importVerifyResult({ exitCode: 0, passedCount: 0, failedCount: 0 });
assert('zero total: passRate 0', r4.passRate === 0);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
