/**
 * Release Handoff Packet v2.9.0
 *
 * Generates a handoff summary after a release is approved and completed.
 * Documents what was released, what's next, and what to monitor.
 */

function generateReleaseHandoffPacket(handoffInput = {}) {
  const {
    releasedVersion = '',
    previousVersion = '',
    tagCreated = false,
    pushedToRemote = false,
    releaseDocsPath = '',
    newToolCount = 0,
    newSmokeCount = 0,
    totalSmokePassed = 0,
    nextMilestone = '',
    monitoringNotes = [],
    session_id = ''
  } = handoffInput;

  const releaseComplete = tagCreated && pushedToRemote;

  const handoffItems = [
    tagCreated ? `v${releasedVersion} タグ作成 ✓` : `v${releasedVersion} タグ未作成`,
    pushedToRemote ? `remote push 完了 ✓` : 'remote push 未実施',
    releaseDocsPath ? `release doc: ${releaseDocsPath} ✓` : 'release doc 未確認',
    `新規ツール: ${newToolCount}件`,
    `新規smoke: ${newSmokeCount}件`,
    `smoke全通過: ${totalSmokePassed}件`
  ];

  const nextSteps = [];
  if (!tagCreated) nextSteps.push(`git tag v${releasedVersion} を実行 (じゅんやさんYES必要)`);
  if (!pushedToRemote) nextSteps.push(`git push origin v${releasedVersion} (じゅんやさんYES必要)`);
  if (nextMilestone) nextSteps.push(`次のマイルストーン: ${nextMilestone}`);

  return {
    packet: 'release-handoff-packet',
    session_id,
    releasedVersion,
    previousVersion,
    releaseComplete,
    tagCreated,
    pushedToRemote,
    handoffItems,
    nextSteps,
    monitoringNotes: monitoringNotes.length > 0 ? monitoringNotes : ['GitHub Actions を確認', 'smoke verify を定期実行'],
    summary: `v${releasedVersion} release ${releaseComplete ? '完了' : '進行中'}。${newToolCount}ツール / ${newSmokeCount}smoke / verify ${totalSmokePassed}通過。`,
    humanApprovalRequired: !releaseComplete,
    version: '2.9.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateReleaseHandoffPacket };

if (require.main === module) {
  const result = generateReleaseHandoffPacket({
    releasedVersion: '2.9.0',
    previousVersion: '2.8.0',
    tagCreated: false,
    pushedToRemote: false,
    releaseDocsPath: 'docs/ai-dev-team/kosame-dev-orchestra-v2.9.0-release-record.md',
    newToolCount: 4,
    newSmokeCount: 5,
    totalSmokePassed: 94,
    nextMilestone: 'v3.0.0 Operating Console Foundation'
  });
  console.log(JSON.stringify(result, null, 2));
}
