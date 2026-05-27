/**
 * Human Approval Summary Generator v2.8.0
 *
 * Generates a concise approval summary for じゅんやさん social contract.
 * Presents what needs YES/NO, why, and what happens next.
 */

function generateHumanApprovalSummary(approvalInput = {}) {
  const {
    actionTitle = 'Unknown Action',
    actionType = 'general',
    requestedBy = 'こさめ副社長',
    dangerousCommands = [],
    riskLevel = 'High',
    recommendation = 'YES',
    reason = '',
    consequences = [],
    alternativeIfNo = '',
    session_id = ''
  } = approvalInput;

  const APPROVAL_REQUIRED_TYPES = ['git_push', 'git_tag', 'deploy', 'cloud_run', 'secret_change', 'billing'];
  const requiresApproval = APPROVAL_REQUIRED_TYPES.includes(actionType) || riskLevel === 'Critical' || riskLevel === 'High';

  const summary = [
    `## じゅんやさん承認リクエスト`,
    ``,
    `**アクション:** ${actionTitle}`,
    `**リスクレベル:** ${riskLevel}`,
    `**リクエスト元:** ${requestedBy}`,
    `**推奨:** ${recommendation}`,
    ``,
    `### 理由`,
    reason || '(理由未記載)',
    ``,
    `### 実行されるコマンド`,
    dangerousCommands.length > 0
      ? dangerousCommands.map(c => `\`${c}\``).join('\n')
      : '(危険コマンドなし)',
    ``,
    `### 実行後の影響`,
    consequences.length > 0 ? consequences.map(c => `- ${c}`).join('\n') : '- (影響記載なし)',
    ``,
    `### NOと答えた場合`,
    alternativeIfNo || '操作をキャンセルします。',
    ``,
    `---`,
    `**じゅんやさんのYES/NOをお願いします。**`
  ].join('\n');

  return {
    generator: 'human-approval-summary-generator',
    session_id,
    actionTitle,
    actionType,
    requestedBy,
    recommendation,
    riskLevel,
    requiresApproval,
    summary,
    dangerousCommands,
    consequences,
    alternativeIfNo: alternativeIfNo || '操作をキャンセルします。',
    approvalGate: {
      gate_required: requiresApproval,
      gate_reason: 'じゅんやさんの最終YES必要。',
      waiting_for: 'human_yes_no'
    },
    version: '2.8.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateHumanApprovalSummary };

if (require.main === module) {
  const result = generateHumanApprovalSummary({
    actionTitle: 'v2.8.0 tag & push',
    actionType: 'git_tag',
    requestedBy: 'こさめ副社長',
    dangerousCommands: ['git tag v2.8.0', 'git push origin v2.8.0'],
    riskLevel: 'High',
    recommendation: 'YES',
    reason: 'GitHub Actions PASS / verify全通過(94) / release docs存在',
    consequences: ['v2.8.0タグがremoteに作成される', 'GitHub Releasesに表示される'],
    alternativeIfNo: 'タグ作成をキャンセル。ブランチは現状維持。'
  });
  console.log(JSON.stringify(result, null, 2));
}
