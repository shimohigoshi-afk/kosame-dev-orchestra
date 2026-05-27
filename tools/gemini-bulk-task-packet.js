/**
 * Gemini Bulk Task Packet v2.2.0
 *
 * Generates a standard bulk task packet for Gemini 課長.
 * Shell execution, confirmation stops, and commit/push are explicitly forbidden.
 */

function generateGeminiBulkTaskPacket(params = {}) {
  const {
    task_id = `gemini-task-${Date.now()}`,
    task_title = '',
    task_description = '',
    target_version = '',
    target_files = [],
    constraints = [],
    context = {},
    fallback_to_claude_on_failure = true
  } = params;

  return {
    packet_type: 'gemini_bulk_task_packet',
    task_id,
    task_title,
    task_description,
    target_version,
    target_files,
    assigned_to: 'gemini',
    gemini_hard_rules: {
      shell_execution: 'FORBIDDEN — シェルコマンドを実行しない',
      confirmation_stops: 'FORBIDDEN — 確認質問で停止しない。判断が必要な場合はskipして続行する',
      commit: 'FORBIDDEN — git commitしない',
      push: 'FORBIDDEN — git pushしない',
      deploy: 'FORBIDDEN — deployしない',
      secret_access: 'FORBIDDEN — Secret/.env/APIkeyを読まない',
      destructive: 'FORBIDDEN — rm -rf / git reset --hard / git cleanしない',
      external_api: 'FORBIDDEN — 外部APIを実行しない'
    },
    constraints: [
      '既存構造を壊さない',
      '完走後に完走報告をすること（報告なしはfailureとみなす）',
      'package.json versionを更新すること',
      ...constraints
    ],
    completion_report_required: true,
    required_output: [
      '追加・変更したファイル一覧',
      'package version 更新確認',
      '構文エラーの有無'
    ],
    fallback_to_claude_on_failure,
    fallback_triggers: [
      'QUOTA_EXHAUSTED',
      'auth_error',
      'timeout',
      'confirmation_stopped',
      'no_completion_report',
      '10min_no_response'
    ],
    context,
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateGeminiBulkTaskPacket };

if (require.main === module) {
  const packet = generateGeminiBulkTaskPacket({
    task_id: 'gemini-v2.3.0-001',
    task_title: 'v2.3.0 Agent Dispatch Execution Pack 実装',
    task_description: 'Dispatch request/queue/result/priority/blockerのtools・docs・smokeを追加する',
    target_version: '2.3.0',
    target_files: [
      'docs/ai-dev-team/agent-dispatch-request-v2.3.0.md',
      'tools/agent-dispatch-request-pack.js',
      'smoke/dev-agent-agent-dispatch-request-smoke.js'
    ]
  });
  console.log(JSON.stringify(packet, null, 2));
}
