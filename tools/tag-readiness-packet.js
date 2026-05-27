/**
 * Tag Readiness Packet v2.9.0
 *
 * Generates a complete tag readiness packet for じゅんやさん approval.
 * Summarizes what will happen when the tag is created.
 */

function generateTagReadinessPacket(packetInput = {}) {
  const {
    targetVersion = '',
    packageVersion = '',
    headCommit = '',
    actionsStatus = 'unknown',
    verifyPassed = 0,
    verifyFailed = 0,
    releaseDocsPath = '',
    releaseNotesUrl = '',
    session_id = ''
  } = packetInput;

  const versionMatch = !!targetVersion && targetVersion === packageVersion;
  const actionsOk = actionsStatus === 'success';
  const verifyOk = verifyFailed === 0 && verifyPassed > 0;

  const readyForTag = versionMatch && actionsOk && verifyOk;

  const tagCommands = readyForTag ? [
    `git tag v${targetVersion}`,
    `git push origin v${targetVersion}`
  ] : [];

  const summary = [
    `## Tag Readiness: v${targetVersion}`,
    ``,
    `| Check | Status |`,
    `|-------|--------|`,
    `| GitHub Actions | ${actionsOk ? '✓ success' : `✗ ${actionsStatus}`} |`,
    `| Verify | ${verifyOk ? `✓ ${verifyPassed} passed` : `✗ ${verifyFailed} failed`} |`,
    `| Version match | ${versionMatch ? `✓ ${packageVersion}` : `✗ package=${packageVersion}, target=${targetVersion}`} |`,
    ``,
    `**Commit:** ${headCommit ? headCommit.slice(0, 7) : 'unknown'}`,
    releaseDocsPath ? `**Release doc:** ${releaseDocsPath}` : '',
    releaseNotesUrl ? `**Release notes:** ${releaseNotesUrl}` : '',
    ``,
    readyForTag
      ? `### Commands (じゅんやさんYES後に実行)\n${tagCommands.map(c => `\`${c}\``).join('\n')}`
      : `### ブロッカーあり — タグ作成不可`
  ].filter(l => l !== '').join('\n');

  return {
    packet: 'tag-readiness-packet',
    session_id,
    targetVersion,
    packageVersion,
    headCommit: headCommit.slice(0, 7) || 'unknown',
    actionsStatus,
    verifyPassed,
    verifyFailed,
    readyForTag,
    tagCommands,
    summary,
    humanApprovalRequired: true,
    gate_required: true,
    gate_reason: 'git tag / push は必ずじゅんやさんの最終YES後のみ実行。',
    version: '2.9.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateTagReadinessPacket };

if (require.main === module) {
  const result = generateTagReadinessPacket({
    targetVersion: '2.9.0',
    packageVersion: '2.9.0',
    headCommit: 'abc1234def',
    actionsStatus: 'success',
    verifyPassed: 94,
    verifyFailed: 0,
    releaseDocsPath: 'docs/ai-dev-team/kosame-dev-orchestra-v2.9.0-release-record.md'
  });
  console.log(JSON.stringify(result, null, 2));
}
