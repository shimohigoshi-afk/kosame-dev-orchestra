/**
 * Claude Main Task Packet v2.2.0
 *
 * Generates a standard task packet for Claude 係長.
 */

function generateClaudeTaskPacket(params = {}) {
  const {
    task_id = `claude-task-${Date.now()}`,
    task_title = '',
    task_description = '',
    target_version = '',
    target_files = [],
    constraints = [],
    forbidden_actions = [],
    verify_required = true,
    approval_required = false,
    fallback_from = null,
    context = {}
  } = params;

  const defaultForbidden = [
    'git push',
    'git tag',
    'deploy',
    'docker build',
    'gcloud deploy',
    'rm -rf',
    'git reset --hard',
    'git clean',
    'Secret / .env / API key 読み取り',
    '外部API実行',
    '課金API実行'
  ];

  const allForbidden = [...new Set([...defaultForbidden, ...forbidden_actions])];

  return {
    packet_type: 'claude_main_task_packet',
    task_id,
    task_title,
    task_description,
    target_version,
    target_files,
    assigned_to: 'claude',
    constraints: [
      '既存構造を壊さない',
      'npm run verify が通ること',
      'node --check が通ること',
      ...constraints
    ],
    forbidden_actions: allForbidden,
    required_checks: ['node --check', 'npm run verify'],
    verify_required,
    approval_required,
    fallback_from,
    context,
    completion_criteria: {
      node_check: 'pass',
      verify: 'pass',
      git_status_clean: false,
      commit_ready: true
    },
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateClaudeTaskPacket };

if (require.main === module) {
  const packet = generateClaudeTaskPacket({
    task_id: 'claude-v2.2.0-001',
    task_title: 'v2.2.0 Provider Router Practical Pack 実装',
    task_description: 'Provider routing request/result/fallback toolsを実装する',
    target_version: '2.2.0',
    target_files: [
      'tools/provider-routing-request-pack.js',
      'tools/provider-routing-result-pack.js',
      'tools/provider-fallback-escalation-pack.js'
    ],
    fallback_from: 'gemini_auth_error'
  });
  console.log(JSON.stringify(packet, null, 2));
}
