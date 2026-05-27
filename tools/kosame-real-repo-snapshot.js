'use strict';
/**
 * Kosame Real Repo Snapshot Reader v3.7.0
 *
 * 実際のCLIテキスト出力を受け取り、repo状態を構造化する。
 * package.json / git status / git log / gh run list / tag list / verify log テキストを入力とし
 * snapshot + riskLevel を返す。
 *
 * 実際のgit/ghコマンドは実行しない（テキスト入力のパースのみ）。
 */

const SNAPSHOT_VERSION = '3.7.0';

const RISK_LEVELS = {
  RELEASE_READY: 'release_ready',
  CLEAN_AND_SYNCED: 'clean_and_synced',
  AHEAD_UNPUSHED: 'ahead_unpushed',
  UNCOMMITTED_CHANGES: 'uncommitted_changes',
  TAG_MISSING: 'tag_missing',
  ACTIONS_PENDING: 'actions_pending',
  ACTIONS_FAILED: 'actions_failed',
  DANGEROUS_UNKNOWN: 'dangerous_unknown'
};

function parsePackageVersion(packageJsonText = '') {
  if (!packageJsonText) return 'unknown';
  try {
    const parsed = JSON.parse(packageJsonText);
    return parsed.version || 'unknown';
  } catch (_) {
    const m = packageJsonText.match(/"version"\s*:\s*"([^"]+)"/);
    return m ? m[1] : 'unknown';
  }
}

function parseGitStatus(gitStatusText = '') {
  if (!gitStatusText) return { workingTreeClean: true, aheadBehind: { ahead: 0, behind: 0 }, uncommittedFiles: [] };

  const lines = gitStatusText.split('\n');
  const headerLine = lines.find(l => l.startsWith('##')) || '';

  let ahead = 0;
  let behind = 0;
  const aheadMatch = headerLine.match(/\[ahead (\d+)/);
  const behindMatch = headerLine.match(/behind (\d+)/);
  if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
  if (behindMatch) behind = parseInt(behindMatch[1], 10);

  const fileLines = lines.filter(l => l.length >= 2 && !l.startsWith('##') && !l.startsWith('On branch'));
  return {
    workingTreeClean: fileLines.length === 0,
    aheadBehind: { ahead, behind },
    uncommittedFiles: fileLines.map(l => l.trim())
  };
}

function parseGitLog(gitLogText = '') {
  if (!gitLogText) return { headCommit: 'unknown', originMainCommit: 'unknown', recentCommits: [] };

  const lines = gitLogText.split('\n').filter(Boolean);
  // First line is HEAD commit
  const headLine = lines[0] || '';
  const headCommit = headLine.split(' ')[0] || 'unknown';

  // Look for origin/main reference
  const originLine = lines.find(l => l.includes('origin/main')) || '';
  const originCommit = originLine ? originLine.split(' ')[0] : 'unknown';

  return {
    headCommit: headCommit.slice(0, 7),
    originMainCommit: originCommit ? originCommit.slice(0, 7) : 'unknown',
    recentCommits: lines.slice(0, 5)
  };
}

function parseGhRunList(ghRunListText = '') {
  if (!ghRunListText) return { actionsStatus: 'unknown', latestRun: null };

  // gh run list outputs tab-separated lines: status\tconclusion\tname\t...
  const lines = ghRunListText.split('\n').filter(Boolean);
  if (lines.length === 0) return { actionsStatus: 'unknown', latestRun: null };

  const firstLine = lines[0].toLowerCase();

  // Check conclusion keywords
  if (firstLine.includes('success') || firstLine.includes('completed')) {
    return { actionsStatus: 'success', latestRun: lines[0] };
  }
  if (firstLine.includes('failure') || firstLine.includes('failed')) {
    return { actionsStatus: 'failed', latestRun: lines[0] };
  }
  if (firstLine.includes('in_progress') || firstLine.includes('queued') || firstLine.includes('waiting')) {
    return { actionsStatus: 'pending', latestRun: lines[0] };
  }
  return { actionsStatus: 'unknown', latestRun: lines[0] };
}

function parseTagList(tagListText = '') {
  if (!tagListText) return { latestTag: 'none', tags: [] };

  const tags = tagListText.split('\n').filter(l => /^v\d+\.\d+\.\d+/.test(l.trim()));
  if (tags.length === 0) return { latestTag: 'none', tags: [] };

  // Sort semver descending
  const sorted = tags.map(t => t.trim()).sort((a, b) => {
    const pa = a.replace('v', '').split('.').map(Number);
    const pb = b.replace('v', '').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) !== (pb[i] || 0)) return (pb[i] || 0) - (pa[i] || 0);
    }
    return 0;
  });
  return { latestTag: sorted[0] || 'none', tags: sorted };
}

function parseVerifyLog(verifyLogText = '') {
  if (!verifyLogText) return { verifyStatus: 'not_run', passedCount: 0, failedCount: 0 };

  const hasTimeout = /TIMEOUT|timed out|Timeout/i.test(verifyLogText);
  if (hasTimeout) return { verifyStatus: 'timeout', passedCount: 0, failedCount: 0 };

  const failedMatch = verifyLogText.match(/FAIL(?:ED)?:?\s*(\d+)/i);
  const passedMatch = verifyLogText.match(/PASS(?:ED)?:?\s*(\d+)/i);
  const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const passedCount = passedMatch ? parseInt(passedMatch[1], 10) : 0;

  const exitZero = /EXIT:0/.test(verifyLogText);
  const verifyStatus = failedCount > 0 ? 'failed' : (passedCount > 0 || exitZero) ? 'passed' : 'unknown';

  return { verifyStatus, passedCount, failedCount };
}

function classifyRisk(snapshot = {}) {
  const {
    workingTreeClean = true,
    aheadBehind = { ahead: 0, behind: 0 },
    actionsStatus = 'unknown',
    verifyStatus = 'unknown',
    latestTag = 'none'
  } = snapshot;

  if (actionsStatus === 'failed') return RISK_LEVELS.ACTIONS_FAILED;
  if (actionsStatus === 'pending') return RISK_LEVELS.ACTIONS_PENDING;
  if (!workingTreeClean) return RISK_LEVELS.UNCOMMITTED_CHANGES;
  if (aheadBehind.ahead > 0) return RISK_LEVELS.AHEAD_UNPUSHED;
  if (latestTag === 'none') return RISK_LEVELS.TAG_MISSING;

  if (
    workingTreeClean &&
    aheadBehind.ahead === 0 &&
    actionsStatus === 'success' &&
    verifyStatus === 'passed' &&
    latestTag !== 'none'
  ) return RISK_LEVELS.RELEASE_READY;

  if (workingTreeClean && aheadBehind.ahead === 0 && actionsStatus === 'success') {
    return RISK_LEVELS.CLEAN_AND_SYNCED;
  }

  return RISK_LEVELS.DANGEROUS_UNKNOWN;
}

function readRealRepoSnapshot(textInputs = {}) {
  const {
    packageJsonText = '',
    gitStatusText = '',
    gitLogText = '',
    ghRunListText = '',
    tagListText = '',
    verifyLogText = '',
    session_id = ''
  } = textInputs;

  const versionInfo = { currentVersion: parsePackageVersion(packageJsonText) };
  const statusInfo = parseGitStatus(gitStatusText);
  const logInfo = parseGitLog(gitLogText);
  const actionsInfo = parseGhRunList(ghRunListText);
  const tagInfo = parseTagList(tagListText);
  const verifyInfo = parseVerifyLog(verifyLogText);

  const snapshot = {
    currentVersion: versionInfo.currentVersion,
    workingTreeClean: statusInfo.workingTreeClean,
    aheadBehind: statusInfo.aheadBehind,
    uncommittedFiles: statusInfo.uncommittedFiles,
    headCommit: logInfo.headCommit,
    originMainCommit: logInfo.originMainCommit,
    recentCommits: logInfo.recentCommits,
    actionsStatus: actionsInfo.actionsStatus,
    latestRun: actionsInfo.latestRun,
    latestTag: tagInfo.latestTag,
    tags: tagInfo.tags,
    verifyStatus: verifyInfo.verifyStatus,
    passedCount: verifyInfo.passedCount,
    failedCount: verifyInfo.failedCount,
    releaseReady: false
  };

  snapshot.riskLevel = classifyRisk(snapshot);
  snapshot.releaseReady = snapshot.riskLevel === RISK_LEVELS.RELEASE_READY;

  return {
    snapshot_reader: 'kosame-real-repo-snapshot',
    session_id,
    snapshot,
    riskLevel: snapshot.riskLevel,
    releaseReady: snapshot.releaseReady,
    version: SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = {
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
};

if (require.main === module) {
  const result = readRealRepoSnapshot({
    packageJsonText: '{"version":"3.7.0"}',
    gitStatusText: '## main...origin/main\n',
    gitLogText: 'abc1234 feat: v3.7.0 release\ndef5678 (origin/main) feat: v3.6.0 release\n',
    ghRunListText: 'completed\tsuccess\tKOSAME Dev Orchestra Verify\n',
    tagListText: 'v3.6.0\nv3.5.0\nv3.4.0\n',
    verifyLogText: 'PASS: 169 / 169\nEXIT:0\n'
  });
  console.log(JSON.stringify({ riskLevel: result.riskLevel, releaseReady: result.releaseReady, snapshot: result.snapshot }, null, 2));
}
