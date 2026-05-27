/**
 * Session Start Packet v2.4.0
 *
 * Records the initial state at session start:
 * repo, branch, HEAD, package version, Actions status, and work purpose.
 */

function createSessionStartPacket(params = {}) {
  const {
    session_id = `session-${Date.now()}`,
    purpose = '',
    target_version = '',
    repo = 'kosame-dev-orchestra',
    repo_path = '/home/shimohigoshi/kosame-dev-orchestra',
    branch = 'main',
    head_commit = '',
    package_version = '',
    actions_status = 'unknown',
    active_agent = 'claude',
    previous_version = '',
    known_blockers = [],
    safety_rules = []
  } = params;

  const defaultSafetyRules = [
    'git push禁止（じゅんやさん最終YES後のみ）',
    'git tag禁止（じゅんやさん最終YES後のみ）',
    'deploy禁止',
    'rm -rf禁止',
    'Secret/.env/APIkey読み取り禁止',
    '外部API・課金API実行禁止',
    'ANESTY Board本体触禁止'
  ];

  return {
    packet_type: 'session_start_packet',
    session_id,
    purpose,
    target_version,
    previous_version,
    repo,
    repo_path,
    branch,
    head_commit,
    package_version,
    actions_status,
    active_agent,
    known_blockers,
    safety_rules: [...defaultSafetyRules, ...safety_rules],
    session_goals: [],
    version: '2.4.0',
    started_at: new Date().toISOString(),
    dryRun: true
  };
}

function addSessionGoal(packet, goal) {
  return { ...packet, session_goals: [...packet.session_goals, goal] };
}

module.exports = { createSessionStartPacket, addSessionGoal };

if (require.main === module) {
  let packet = createSessionStartPacket({
    session_id: 'session-v2.4.0-001',
    purpose: 'v2.2.0〜v2.5.0 連続実装',
    target_version: '2.5.0',
    head_commit: '1c4473f',
    package_version: '2.1.0',
    actions_status: 'success',
    active_agent: 'claude',
    previous_version: '2.1.0',
    known_blockers: ['gemini_auth_error']
  });
  packet = addSessionGoal(packet, 'v2.2.0 Provider Router Practical Pack');
  packet = addSessionGoal(packet, 'v2.3.0 Agent Dispatch Execution Pack');
  packet = addSessionGoal(packet, 'v2.4.0 Operator Run Session Pack');
  packet = addSessionGoal(packet, 'v2.5.0 Dev Orchestra Semi-Auto Operation Pack');
  console.log(JSON.stringify(packet, null, 2));
}
