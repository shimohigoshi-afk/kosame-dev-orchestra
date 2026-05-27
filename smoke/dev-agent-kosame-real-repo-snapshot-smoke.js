'use strict';
const {
  readRealRepoSnapshot,
  parsePackageVersion,
  parseGitStatus,
  parseGitLog,
  parseGhRunList,
  parseTagList,
  parseVerifyLog,
  classifyRisk,
  SNAPSHOT_VERSION,
  RISK_LEVELS
} = require('../tools/kosame-real-repo-snapshot');

let passed = 0; let failed = 0;
function assert(label, condition) {
  if (condition) { console.log(`  PASS: ${label}`); passed++; }
  else { console.error(`  FAIL: ${label}`); failed++; }
}

console.log('=== kosame-real-repo-snapshot smoke ===');

// --- parsePackageVersion ---
assert('pkg version from JSON', parsePackageVersion('{"name":"x","version":"3.7.0"}') === '3.7.0');
assert('pkg version from string', parsePackageVersion('"version": "4.0.0"') === '4.0.0');
assert('pkg version empty → unknown', parsePackageVersion('') === 'unknown');
assert('pkg version malformed → unknown', parsePackageVersion('not-json no-version') === 'unknown');

// --- parseGitStatus ---
const gs1 = parseGitStatus('## main...origin/main\n');
assert('git status clean', gs1.workingTreeClean === true);
assert('git status no ahead', gs1.aheadBehind.ahead === 0);

const gs2 = parseGitStatus('## main...origin/main [ahead 2]\nM package.json\n?? tools/new.js\n');
assert('git status dirty', gs2.workingTreeClean === false);
assert('git status ahead 2', gs2.aheadBehind.ahead === 2);
assert('git status files', gs2.uncommittedFiles.length === 2);

const gs3 = parseGitStatus('');
assert('git status empty → clean', gs3.workingTreeClean === true);

// --- parseGitLog ---
const gl1 = parseGitLog('abc1234 feat: v3.7.0\ndef5678 (origin/main) feat: v3.6.0\n');
assert('git log headCommit', gl1.headCommit === 'abc1234');
assert('git log recentCommits', gl1.recentCommits.length >= 1);

const gl2 = parseGitLog('');
assert('git log empty → unknown', gl2.headCommit === 'unknown');

// --- parseGhRunList ---
const gh1 = parseGhRunList('completed\tsuccess\tKOSAME Verify\n');
assert('gh run list success', gh1.actionsStatus === 'success');

const gh2 = parseGhRunList('failure\tfailure\tKOSAME Verify\n');
assert('gh run list failed', gh2.actionsStatus === 'failed');

const gh3 = parseGhRunList('in_progress\t\tKOSAME Verify\n');
assert('gh run list pending', gh3.actionsStatus === 'pending');

const gh4 = parseGhRunList('');
assert('gh run list empty → unknown', gh4.actionsStatus === 'unknown');

// --- parseTagList ---
const tl1 = parseTagList('v3.7.0\nv3.6.0\nv3.5.0\n');
assert('tag list latestTag', tl1.latestTag === 'v3.7.0');
assert('tag list sorted', tl1.tags[0] === 'v3.7.0');
assert('tag list count', tl1.tags.length === 3);

const tl2 = parseTagList('');
assert('tag list empty → none', tl2.latestTag === 'none');

// --- parseVerifyLog ---
const vl1 = parseVerifyLog('PASS: 169 / 169\nEXIT:0\n');
assert('verify log passed', vl1.verifyStatus === 'passed');
assert('verify log passedCount', vl1.passedCount === 169);

const vl2 = parseVerifyLog('FAILED: 2 / 20\n');
assert('verify log failed', vl2.verifyStatus === 'failed');
assert('verify log failedCount', vl2.failedCount === 2);

const vl3 = parseVerifyLog('TIMEOUT exceeded\n');
assert('verify log timeout', vl3.verifyStatus === 'timeout');

const vl4 = parseVerifyLog('');
assert('verify log empty → not_run', vl4.verifyStatus === 'not_run');

// --- classifyRisk ---
assert('risk: actions_failed', classifyRisk({ actionsStatus: 'failed' }) === RISK_LEVELS.ACTIONS_FAILED);
assert('risk: actions_pending', classifyRisk({ actionsStatus: 'pending' }) === RISK_LEVELS.ACTIONS_PENDING);
assert('risk: uncommitted', classifyRisk({ workingTreeClean: false, actionsStatus: 'success' }) === RISK_LEVELS.UNCOMMITTED_CHANGES);
assert('risk: ahead_unpushed', classifyRisk({ workingTreeClean: true, aheadBehind: { ahead: 1, behind: 0 }, actionsStatus: 'success' }) === RISK_LEVELS.AHEAD_UNPUSHED);
assert('risk: tag_missing', classifyRisk({ workingTreeClean: true, aheadBehind: { ahead: 0, behind: 0 }, actionsStatus: 'success', verifyStatus: 'passed', latestTag: 'none' }) === RISK_LEVELS.TAG_MISSING);
assert('risk: release_ready', classifyRisk({ workingTreeClean: true, aheadBehind: { ahead: 0, behind: 0 }, actionsStatus: 'success', verifyStatus: 'passed', latestTag: 'v3.7.0' }) === RISK_LEVELS.RELEASE_READY);
assert('risk: clean_and_synced', classifyRisk({ workingTreeClean: true, aheadBehind: { ahead: 0, behind: 0 }, actionsStatus: 'success', verifyStatus: 'not_run', latestTag: 'v3.7.0' }) === RISK_LEVELS.CLEAN_AND_SYNCED);

// --- readRealRepoSnapshot (full) ---
const r1 = readRealRepoSnapshot({
  packageJsonText: '{"version":"3.7.0"}',
  gitStatusText: '## main...origin/main\n',
  gitLogText: 'abc1234 feat: v3.7.0\ndef5678 (origin/main) feat: v3.6.0\n',
  ghRunListText: 'completed\tsuccess\tKOSAME Verify\n',
  tagListText: 'v3.7.0\nv3.6.0\n',
  verifyLogText: 'PASS: 169 / 169\nEXIT:0\n',
  session_id: 'smoke-001'
});
assert('readRealRepoSnapshot: snapshot_reader', r1.snapshot_reader === 'kosame-real-repo-snapshot');
assert('readRealRepoSnapshot: version 3.7.0', r1.version === '3.7.0');
assert('readRealRepoSnapshot: dryRun', r1.dryRun === true);
assert('readRealRepoSnapshot: session_id', r1.session_id === 'smoke-001');
assert('readRealRepoSnapshot: riskLevel release_ready', r1.riskLevel === RISK_LEVELS.RELEASE_READY);
assert('readRealRepoSnapshot: releaseReady true', r1.releaseReady === true);
assert('readRealRepoSnapshot: currentVersion', r1.snapshot.currentVersion === '3.7.0');
assert('readRealRepoSnapshot: workingTreeClean', r1.snapshot.workingTreeClean === true);
assert('readRealRepoSnapshot: actionsStatus', r1.snapshot.actionsStatus === 'success');
assert('readRealRepoSnapshot: verifyStatus', r1.snapshot.verifyStatus === 'passed');
assert('readRealRepoSnapshot: latestTag', r1.snapshot.latestTag === 'v3.7.0');

// dirty scenario
const r2 = readRealRepoSnapshot({
  gitStatusText: '## main...origin/main [ahead 1]\nM package.json\n',
  ghRunListText: 'failure\tfailure\t',
  verifyLogText: 'FAILED: 1 / 10\n'
});
assert('dirty: riskLevel actions_failed', r2.riskLevel === RISK_LEVELS.ACTIONS_FAILED);
assert('dirty: releaseReady false', r2.releaseReady === false);

// --- exports ---
assert('SNAPSHOT_VERSION 3.7.0', SNAPSHOT_VERSION === '3.7.0');
assert('RISK_LEVELS object', typeof RISK_LEVELS === 'object');
assert('RISK_LEVELS.RELEASE_READY', RISK_LEVELS.RELEASE_READY === 'release_ready');
assert('RISK_LEVELS.ACTIONS_FAILED', RISK_LEVELS.ACTIONS_FAILED === 'actions_failed');

if (failed > 0) { console.error(`\nFAILED: ${failed} / ${passed + failed}`); process.exit(1); }
console.log(`\nPASS: ${passed} / ${passed + failed}`);
