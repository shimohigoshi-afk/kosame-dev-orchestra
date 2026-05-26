/**
 * Operator Handoff Complete Pack v1.3.1
 *
 * Generates the final handoff document for Local Operator Console completion.
 */

function generateFinalHandoff(options = {}) {
  const version = options.version || '2.0.0';
  const completedWork = options.completedWork || [
    'v1.2.1 Operator Unified CLI Pack',
    'v1.2.2 Operator Console Bundle Pack',
    'v1.2.3 Operator Completion Checklist Pack',
    'v1.2.4 Operator Safety Contract Pack',
    'v1.2.5 Operator Smoke Registry Pack',
    'v1.3.0 Operator Self Review Pack',
    'v1.3.1 Operator Handoff Complete Pack',
    'v1.3.2 Operator Claude Emotional Escalation Complete Pack',
    'v1.3.3 Operator Gemini Work Complete Pack',
    'v1.4.0 Operator Local Console Complete Pack',
    'v1.5.0 Operator Console Complete Release Pack',
    'v2.0.0 KOSAME Dev Orchestra Local Operator Complete Pack'
  ];

  const handoff = {
    version,
    timestamp: new Date().toISOString(),
    title: `KOSAME Dev Orchestra v${version} Handoff`,
    status: 'COMPLETE',
    milestone: 'Local Operator Console Complete',
    completedWork,
    nextSteps: options.nextSteps || ['Human approval for git commit and tag', 'GitHub Actions verification', 'Cloud Run UI planning'],
    approvalRequired: true,
    approver: 'じゅんやさん',
    dryRun: true
  };

  return handoff;
}

function renderHandoffMarkdown(handoff) {
  const lines = [
    `# Operator Handoff - ${handoff.version}`,
    '',
    '## 状況',
    `- **Status**: ${handoff.status}`,
    `- **Milestone**: ${handoff.milestone}`,
    `- **Timestamp**: ${handoff.timestamp}`,
    '',
    '## 完了した作業',
    ...handoff.completedWork.map(w => `- ${w}`),
    '',
    '## 次のアクション',
    ...handoff.nextSteps.map((s, i) => `${i + 1}. ${s}`),
    '',
    '## 承認ゲート',
    `- 承認者: ${handoff.approver}`,
    '- git commit / push / tag は Human Approval 後のみ実行',
    '',
    '---',
    `Generated at: ${handoff.timestamp}`
  ];
  return lines.join('\n');
}

module.exports = { generateFinalHandoff, renderHandoffMarkdown };

if (require.main === module) {
  const handoff = generateFinalHandoff();
  console.log(renderHandoffMarkdown(handoff));
}
