/**
 * VP Handoff Packet v3.5.0
 *
 * Generates a handoff packet for the next chat session or next operator.
 * Summarizes: current state, what was done, what's next, pending approvals.
 */

function generateVpHandoffPacket(handoffInput = {}) {
  const {
    sessionId = '',
    sessionGoal = '',
    completedActions = [],
    currentState = {},
    pendingApprovals = [],
    nextRecommendedAction = '',
    openIssues = [],
    geminiStatus = 'unknown',
    packageVersion = 'unknown',
    session_id = ''
  } = handoffInput;

  const {
    verifyStatus = 'not_run',
    actionsStatus = 'unknown',
    workingTreeClean = true,
    overallHealth = 'unknown',
    branch = 'main'
  } = currentState;

  const stateLines = [
    `branch: ${branch}`,
    `package: v${packageVersion}`,
    `verifyStatus: ${verifyStatus}`,
    `actionsStatus: ${actionsStatus}`,
    `workingTreeClean: ${workingTreeClean}`,
    `overallHealth: ${overallHealth}`
  ];

  const hasPendingApprovals = pendingApprovals.length > 0;
  const hasOpenIssues = openIssues.length > 0;

  const handoffNote = [
    `## 引継ぎパケット`,
    `**セッションID:** ${sessionId || session_id}`,
    `**目標:** ${sessionGoal || '(未設定)'}`,
    ``,
    `### 現在状態`,
    stateLines.map(l => `- ${l}`).join('\n'),
    ``,
    `### 完了アクション (${completedActions.length}件)`,
    completedActions.length > 0 ? completedActions.map(a => `- ${a}`).join('\n') : '- (なし)',
    ``,
    `### 次推奨アクション`,
    nextRecommendedAction || '(未定)',
    ``,
    `### 未解決事項 (${openIssues.length}件)`,
    openIssues.length > 0 ? openIssues.map(i => `- ${i}`).join('\n') : '- (なし)',
    ``,
    `### 承認待ち (${pendingApprovals.length}件)`,
    hasPendingApprovals ? pendingApprovals.map(p => `- ${p}`).join('\n') : '- (なし)',
    ``,
    `### Gemini状態`,
    geminiStatus
  ].join('\n');

  return {
    packet: 'vp-handoff-packet',
    session_id: sessionId || session_id,
    sessionGoal,
    completedActions,
    currentState,
    pendingApprovals,
    hasPendingApprovals,
    openIssues,
    hasOpenIssues,
    nextRecommendedAction,
    geminiStatus,
    packageVersion,
    handoffNote,
    readyForHandoff: !hasOpenIssues && verifyStatus !== 'failed',
    version: '3.5.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateVpHandoffPacket };

if (require.main === module) {
  const result = generateVpHandoffPacket({
    sessionId: 'session-2026-05-27-001',
    sessionGoal: 'v3.5.0実装',
    completedActions: ['v3.1.0 CLI Entry実装', 'v3.2.0 State Reader実装', 'v3.3.0 Decision Report実装'],
    currentState: { verifyStatus: 'passed', actionsStatus: 'success', workingTreeClean: true, overallHealth: 'healthy', branch: 'main' },
    pendingApprovals: ['git push origin main (じゅんやさんYES待ち)'],
    nextRecommendedAction: 'v3.4.0 Safe Command Generator実装',
    openIssues: [],
    geminiStatus: 'gemini_auth_error',
    packageVersion: '3.5.0'
  });
  console.log(JSON.stringify(result, null, 2));
}
