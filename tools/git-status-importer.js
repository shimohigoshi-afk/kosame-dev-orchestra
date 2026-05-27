/**
 * Git Status Importer v2.7.0
 *
 * Parses structured git status data into a normalized snapshot.
 * Input: raw git data object (no shell exec — dryRun always).
 */

function importGitStatus(rawGitData = {}) {
  const {
    branch = 'main',
    headCommit = '',
    originCommit = '',
    statusLines = [],
    aheadCount = 0,
    behindCount = 0
  } = rawGitData;

  const uncommittedFiles = [];
  const untrackedFiles = [];

  for (const line of statusLines) {
    if (typeof line !== 'string') continue;
    const xy = line.slice(0, 2);
    const file = line.slice(3).trim();
    if (xy === '??' || xy === '? ') {
      untrackedFiles.push(file);
    } else {
      uncommittedFiles.push(file);
    }
  }

  const hasUncommittedChanges = uncommittedFiles.length > 0;
  const workingTreeClean = !hasUncommittedChanges && untrackedFiles.length === 0;
  const isAhead = aheadCount > 0 || (headCommit && originCommit && headCommit !== originCommit);
  const syncStatus = isAhead ? 'ahead_of_origin' : 'in_sync';

  return {
    importer: 'git-status-importer',
    branch,
    headCommit: headCommit.slice(0, 7) || 'unknown',
    originCommit: originCommit.slice(0, 7) || 'unknown',
    uncommittedFiles,
    untrackedFiles,
    hasUncommittedChanges,
    workingTreeClean,
    aheadCount,
    behindCount,
    syncStatus,
    isAhead,
    version: '2.7.0',
    importedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { importGitStatus };

if (require.main === module) {
  const result = importGitStatus({
    branch: 'main',
    headCommit: 'abc1234def',
    originCommit: 'b9b02ee',
    statusLines: [' M tools/foo.js', '?? tools/new.js'],
    aheadCount: 1
  });
  console.log(JSON.stringify(result, null, 2));
}
