'use strict';
const { importGitStatus } = require('../tools/git-status-importer');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== git-status-importer smoke ===');

// Test 1: clean repo
const r1 = importGitStatus({ branch: 'main', headCommit: 'abc1234', originCommit: 'abc1234', statusLines: [], aheadCount: 0 });
assert('importer field', r1.importer === 'git-status-importer');
assert('clean: workingTreeClean', r1.workingTreeClean === true);
assert('clean: syncStatus in_sync', r1.syncStatus === 'in_sync');
assert('clean: isAhead false', r1.isAhead === false);
assert('version 2.7.0', r1.version === '2.7.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: modified + untracked files
const r2 = importGitStatus({
  branch: 'main',
  headCommit: 'abc1234',
  originCommit: 'abc1234',
  statusLines: [' M tools/foo.js', 'M  tools/bar.js', '?? tools/new.js'],
  aheadCount: 0
});
assert('dirty: uncommittedFiles len 2', r2.uncommittedFiles.length === 2);
assert('dirty: untrackedFiles len 1', r2.untrackedFiles.length === 1);
assert('dirty: hasUncommittedChanges', r2.hasUncommittedChanges === true);
assert('dirty: workingTreeClean false', r2.workingTreeClean === false);

// Test 3: ahead of origin
const r3 = importGitStatus({ headCommit: 'newcommit', originCommit: 'oldcommit', statusLines: [], aheadCount: 2 });
assert('ahead: isAhead true', r3.isAhead === true);
assert('ahead: syncStatus ahead_of_origin', r3.syncStatus === 'ahead_of_origin');

// Test 4: commit hashes truncated to 7 chars
const r4 = importGitStatus({ headCommit: 'abcdef1234567890', originCommit: 'fedcba9876543210' });
assert('commit truncated to 7', r4.headCommit.length === 7);

// Test 5: empty input defaults
const r5 = importGitStatus({});
assert('empty: branch main', r5.branch === 'main');
assert('empty: syncStatus in_sync', r5.syncStatus === 'in_sync');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
