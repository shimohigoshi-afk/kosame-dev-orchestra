/**
 * Kosame Approval Packet Generator v2.2.0
 *
 * Generates a standard approval packet (v2.1.0 format) from structured input.
 * Kosame prepares this; じゅんやさん only needs to YES/NO.
 */

const JUNYA_REQUIRED_OPERATIONS = [
  'git push',
  'git tag',
  'deploy',
  'cloud_run_deploy',
  'secret_change',
  'api_key_change',
  'billing_api',
  'customer_data',
  'destructive_delete',
  'production_change'
];

function classifyDangerousActions(actions = []) {
  return actions.filter(a =>
    JUNYA_REQUIRED_OPERATIONS.some(op => a.toLowerCase().includes(op.replace('_', ' ')))
  );
}

function generateApprovalPacket(params = {}) {
  const {
    recommendation = 'YES',
    reason = '',
    remaining_risks = [],
    dangerous_actions = [],
    junya_operations = [],
    ai_completed_checks = [],
    next_action = '',
    task_title = '',
    task_id = '',
    version_target = ''
  } = params;

  if (!['YES', 'NO', 'HOLD'].includes(recommendation)) {
    throw new Error(`Invalid recommendation: ${recommendation}. Must be YES, NO, or HOLD.`);
  }

  const classifiedDangerous = classifyDangerousActions(dangerous_actions);

  const packetText = [
    `## Approval Packet v2.2.0`,
    '',
    `**Task**: ${task_title} ${version_target ? `(${version_target})` : ''}`,
    `**Task ID**: ${task_id || 'N/A'}`,
    '',
    `- 推奨：${recommendation}`,
    `- 理由：${reason}`,
    `- 残リスク：${remaining_risks.length > 0 ? remaining_risks.join(' / ') : 'なし'}`,
    `- 危険操作：${classifiedDangerous.length > 0 ? classifiedDangerous.join(', ') : 'なし'}`,
    `- じゅんやさんの操作：${junya_operations.length > 0 ? junya_operations.join(' → ') : 'なし（AI側で完結）'}`,
    `- AI側で完了済みの確認：`,
    ...ai_completed_checks.map(c => `  - ${c}`),
    `- 次アクション：${next_action}`
  ].join('\n');

  return {
    packet_type: 'kosame_approval_packet',
    task_id,
    task_title,
    version_target,
    recommendation,
    reason,
    remaining_risks,
    dangerous_actions: classifiedDangerous,
    junya_operations,
    ai_completed_checks,
    next_action,
    packet_text: packetText,
    junya_required: junya_operations.length > 0,
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateApprovalPacket, JUNYA_REQUIRED_OPERATIONS, classifyDangerousActions };

if (require.main === module) {
  const packet = generateApprovalPacket({
    recommendation: 'YES',
    reason: 'Claude係長がv2.2.0を実装完了。npm run verify 全PASS。node --check OK。',
    remaining_risks: ['Gemini quota回復後の再統合が必要になる可能性あり（実装に影響なし）'],
    dangerous_actions: [],
    junya_operations: ['git commit', 'git push', 'git tag v2.2.0'],
    ai_completed_checks: [
      'node --check: 全新規JSファイル OK',
      'npm run verify: 全smoke PASS',
      'git status: 差分が意図通り'
    ],
    next_action: 'commit後にGitHub Actions確認',
    task_title: 'v2.2.0 Provider Router Practical Pack',
    version_target: '2.2.0'
  });
  console.log(packet.packet_text);
}
