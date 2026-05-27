'use strict';
const { readRepoState, parseGitStatusSb } = require('../tools/repo-state-reader');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== repo-state-reader smoke ===');

// Test 1: clean via gitStatusSbText
const r1 = readRepoState({ gitStatusSbText: '## main...origin/main\n', headCommit: 'abc1234', packageVersion: '3.2.0' });
assert('reader field', r1.reader === 'repo-state-reader');
assert('clean: workingTreeClean', r1.workingTreeClean === true);
assert('clean: branch main', r1.branch === 'main');
assert('clean: syncStatus in_sync', r1.syncStatus === 'in_sync');
assert('version 3.2.0', r1.version === '3.2.0');
assert('dryRun true', r1.dryRun === true);

// Test 2: dirty with modified and untracked
const r2 = readRepoState({ gitStatusSbText: '## main...origin/main [ahead 2]\n M tools/foo.js\n?? tools/new.js' });
assert('dirty: hasUncommittedChanges', r2.hasUncommittedChanges === true);
assert('dirty: uncommittedFiles has foo', r2.uncommittedFiles.length > 0);
assert('dirty: untrackedFiles has new', r2.untrackedFiles.length > 0);
assert('dirty: aheadCount 2', r2.aheadCount === 2);
assert('dirty: isAhead true', r2.isAhead === true);
assert('dirty: syncStatus ahead', r2.syncStatus === 'ahead_of_origin');

// Test 3: parseGitStatusSb directly
const parsed = parseGitStatusSb('## feature/foo...origin/feature/foo\nM  tools/a.js\n?? tools/b.js');
assert('parse: branch feature', parsed.branch === 'feature/foo');
assert('parse: modified file', parsed.uncommittedFiles.length === 1);
assert('parse: untracked file', parsed.untrackedFiles.length === 1);

// Test 4: statusLines fallback (no gitStatusSbText)
const r4 = readRepoState({ statusLines: [' M tools/foo.js', '?? tools/bar.js'], branch: 'main' });
assert('fallback: hasUncommittedChanges', r4.hasUncommittedChanges === true);
assert('fallback: untrackedFiles len 1', r4.untrackedFiles.length === 1);

// Test 5: commit hash truncated
const r5 = readRepoState({ headCommit: 'abcdef1234567890' });
assert('commit truncated', r5.headCommit.length === 7);

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
