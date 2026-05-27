/**
 * Repo State Reader v3.2.0
 *
 * Reads repo state from structured input (git status -sb / log / package info).
 * No shell execution — caller provides raw text or structured data.
 */

function parseGitStatusSb(statusText = '') {
  const lines = statusText.split('\n').filter(Boolean);
  const branchLine = lines.find(l => l.startsWith('##')) || '';
  const fileLines = lines.filter(l => !l.startsWith('##'));

  let branch = 'main';
  let aheadCount = 0;
  let behindCount = 0;

  const branchMatch = branchLine.match(/^## (.+?)(?:\.\.\.|$)/);
  if (branchMatch) branch = branchMatch[1].trim();
  const aheadMatch = branchLine.match(/ahead (\d+)/);
  if (aheadMatch) aheadCount = parseInt(aheadMatch[1]);
  const behindMatch = branchLine.match(/behind (\d+)/);
  if (behindMatch) behindCount = parseInt(behindMatch[1]);

  const modifiedFiles = fileLines.filter(l => l.match(/^[ M][M ]/)).map(l => l.slice(3).trim());
  const untrackedFiles = fileLines.filter(l => l.startsWith('??')).map(l => l.slice(3).trim());
  const addedFiles = fileLines.filter(l => l.startsWith('A ')).map(l => l.slice(3).trim());
  const deletedFiles = fileLines.filter(l => l.match(/^[ D][D ]/)).map(l => l.slice(3).trim());

  const uncommittedFiles = [...modifiedFiles, ...addedFiles, ...deletedFiles];
  const hasUncommittedChanges = uncommittedFiles.length > 0;

  return {
    branch,
    aheadCount,
    behindCount,
    uncommittedFiles,
    untrackedFiles,
    hasUncommittedChanges,
    workingTreeClean: !hasUncommittedChanges && untrackedFiles.length === 0,
    isAhead: aheadCount > 0
  };
}

function readRepoState(repoInput = {}) {
  const {
    gitStatusSbText = '',
    headCommit = '',
    originCommit = '',
    packageVersion = 'unknown',
    latestTag = '',
    statusLines = [],
    branch = 'main',
    session_id = ''
  } = repoInput;

  const parsed = gitStatusSbText
    ? parseGitStatusSb(gitStatusSbText)
    : {
        branch,
        aheadCount: 0, behindCount: 0,
        uncommittedFiles: statusLines.filter(l => !l.startsWith('??')).map(l => l.slice(3)),
        untrackedFiles: statusLines.filter(l => l.startsWith('??')).map(l => l.slice(3)),
        hasUncommittedChanges: statusLines.some(l => !l.startsWith('??')),
        workingTreeClean: statusLines.length === 0,
        isAhead: headCommit && originCommit && headCommit !== originCommit
      };

  return {
    reader: 'repo-state-reader',
    session_id,
    packageVersion,
    latestTag,
    headCommit: headCommit.slice(0, 7) || 'unknown',
    originCommit: originCommit.slice(0, 7) || 'unknown',
    ...parsed,
    syncStatus: parsed.isAhead ? 'ahead_of_origin' : 'in_sync',
    version: '3.2.0',
    readAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { readRepoState, parseGitStatusSb };

if (require.main === module) {
  const result = readRepoState({
    gitStatusSbText: '## main...origin/main [ahead 1]\n M tools/foo.js\n?? tools/new.js',
    headCommit: 'abc1234def',
    packageVersion: '3.2.0'
  });
  console.log(JSON.stringify(result, null, 2));
}
