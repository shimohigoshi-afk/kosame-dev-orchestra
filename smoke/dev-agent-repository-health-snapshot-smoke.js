'use strict';
const { createRepositoryHealthSnapshot } = require('../tools/repository-health-snapshot');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== repository-health-snapshot smoke ===');

// Test 1: all green
const r1 = createRepositoryHealthSnapshot({
  packageVersion: '2.7.0',
  git: { branch: 'main', headCommit: 'abc1234', originCommit: 'abc1234', statusLines: [], aheadCount: 0 },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 0, passedCount: 94, failedCount: 0 }
});
assert('snapshot field', r1.snapshot === 'repository-health-snapshot');
assert('all green: overallHealth healthy', r1.overallHealth === 'healthy');
assert('all green: issueCount 0', r1.issueCount === 0);
assert('all green: actionsStatus success', r1.actionsStatus === 'success');
assert('all green: verifyStatus passed', r1.verifyStatus === 'passed');
assert('all green: workingTreeClean', r1.workingTreeClean === true);
assert('version 2.7.0', r1.version === '2.7.0');
assert('dryRun true', r1.dryRun === true);
assert('packageVersion set', r1.packageVersion === '2.7.0');

// Test 2: verify failed → issue logged
const r2 = createRepositoryHealthSnapshot({
  git: { statusLines: [], aheadCount: 0 },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 1, passedCount: 90, failedCount: 4 }
});
assert('verify failed: has issue', r2.issues.some(i => i.includes('verify FAILED')));
assert('verify failed: health degraded', r2.overallHealth === 'degraded');

// Test 3: dirty tree → issue
const r3 = createRepositoryHealthSnapshot({
  git: { statusLines: [' M tools/foo.js'], aheadCount: 0 },
  actions: { status: 'success', conclusion: 'success', jobResults: [] },
  verify: { exitCode: 0, passedCount: 94, failedCount: 0 }
});
assert('dirty: has uncommitted issue', r3.issues.some(i => i.includes('uncommitted')));
assert('dirty: uncommittedFiles in snapshot', r3.uncommittedFiles.length === 1);

// Test 4: multiple issues → critical
const r4 = createRepositoryHealthSnapshot({
  git: { statusLines: [' M a.js', ' M b.js', ' M c.js'], aheadCount: 1, headCommit: 'new', originCommit: 'old' },
  actions: { status: 'failure', conclusion: 'failure', jobResults: [{ name: 'test', conclusion: 'failure' }] },
  verify: { exitCode: 1, passedCount: 80, failedCount: 10 }
});
assert('multi-issue: overallHealth critical', r4.overallHealth === 'critical');

// Test 5: flattened fields accessible
assert('flattened branch', typeof r1.branch === 'string');
assert('flattened headCommit', typeof r1.headCommit === 'string');
assert('nested git snapshot', r1.git && r1.git.importer === 'git-status-importer');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
