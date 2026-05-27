/**
 * Session Handoff Summary v2.4.0
 *
 * Generates a handoff summary for chat migration or work interruption.
 * The next Kosame should be able to continue without confusion.
 */

function generateHandoffSummary(params = {}) {
  const {
    session_id,
    purpose = '',
    target_version = '',
    head_commit = '',
    package_version = '',
    phase = 'in_progress',
    completed_tasks = [],
    pending_tasks = [],
    blocker_history = [],
    fallback_history = [],
    last_verify_status = 'unknown',
    last_actions_status = 'unknown',
    next_immediate_action = '',
    notes = ''
  } = params;

  const blockerSummary = blocker_history.map(b =>
    `- ${b.type}: ${b.description || ''} → ${b.resolved ? '解決済み' : '未解決'}`
  ).join('\n') || 'なし';

  const fallbackSummary = fallback_history.map(f =>
    `- ${f.from_agent} → ${f.to_agent}: ${f.reason}`
  ).join('\n') || 'なし';

  const summaryText = [
    `# Session Handoff Summary v2.4.0`,
    '',
    `## セッション概要`,
    `- Session ID: ${session_id}`,
    `- 目的: ${purpose}`,
    `- 対象バージョン: ${target_version}`,
    `- 現在フェーズ: ${phase}`,
    '',
    `## 現在の状態`,
    `- HEAD commit: ${head_commit}`,
    `- package version: ${package_version}`,
    `- 最終verify: ${last_verify_status}`,
    `- 最終Actions: ${last_actions_status}`,
    '',
    `## 完了タスク（${completed_tasks.length}件）`,
    ...completed_tasks.map(t => `- [完了] ${t}`),
    '',
    `## 残タスク（${pending_tasks.length}件）`,
    ...pending_tasks.map(t => `- [未完] ${t}`),
    '',
    `## Blocker履歴`,
    blockerSummary,
    '',
    `## Fallback履歴`,
    fallbackSummary,
    '',
    `## 次のアクション`,
    next_immediate_action || '指示待ち',
    '',
    `## 引き継ぎ注意事項`,
    notes || 'なし'
  ].join('\n');

  return {
    packet_type: 'session_handoff_summary',
    session_id,
    purpose,
    target_version,
    phase,
    completed_tasks,
    pending_tasks,
    blocker_history,
    fallback_history,
    last_verify_status,
    last_actions_status,
    next_immediate_action,
    summary_text: summaryText,
    version: '2.4.0',
    generated_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateHandoffSummary };

if (require.main === module) {
  const summary = generateHandoffSummary({
    session_id: 'session-v2.5.0-001',
    purpose: 'v2.2.0〜v2.5.0 連続実装',
    target_version: '2.5.0',
    head_commit: '1c4473f',
    package_version: '2.4.0',
    phase: 'in_progress',
    completed_tasks: ['v2.2.0 実装完了', 'v2.3.0 実装完了', 'v2.4.0 実装完了'],
    pending_tasks: ['v2.5.0 Semi-Auto Operation Pack 実装', 'npm run verify 実行', 'こさめへ報告'],
    blocker_history: [{ type: 'gemini_auth_error', description: 'metadata server error', resolved: true }],
    fallback_history: [{ from_agent: 'gemini', to_agent: 'claude', reason: 'auth_error' }],
    last_verify_status: 'passed',
    last_actions_status: 'success',
    next_immediate_action: 'v2.5.0 tools/docs/smoke 実装 → npm run verify'
  });
  console.log(summary.summary_text);
}
