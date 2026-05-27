/**
 * Session Commit Readiness Packet v2.4.0
 *
 * Determines whether a session is ready for commit.
 * Contains: intended_files, unexpected_files, verify_status,
 * node_check_status, risk_level, dangerous_actions,
 * commit_recommendation, push_gate.
 */

function createCommitReadinessPacket(params = {}) {
  const {
    session_id,
    intended_files = [],
    actual_changed_files = [],
    verify_status = 'not_run',
    verify_passed = 0,
    verify_failed = 0,
    node_check_status = 'not_run',
    node_check_errors = [],
    risk_level = 'Low',
    dangerous_actions = [],
    notes = ''
  } = params;

  const PUSH_REQUIRED_OPERATIONS = ['git push', 'git tag', 'deploy'];
  const unexpected_files = actual_changed_files.filter(f => !intended_files.includes(f));
  const missing_intended = intended_files.filter(f => !actual_changed_files.includes(f));

  const has_dangerous = dangerous_actions.length > 0;
  const push_gate_required = dangerous_actions.some(a =>
    PUSH_REQUIRED_OPERATIONS.some(op => a.includes(op))
  );

  let commit_recommendation = 'NO';
  let commit_reason = '';

  if (verify_status !== 'passed' || verify_failed > 0) {
    commit_reason = 'verify未PASS';
  } else if (node_check_status !== 'passed') {
    commit_reason = 'node --check未PASS';
  } else if (unexpected_files.length > 0) {
    commit_reason = `意図しないファイルが含まれています: ${unexpected_files.join(', ')}`;
  } else if (risk_level === 'Critical') {
    commit_reason = 'Criticalリスク: 人間承認が必要';
  } else {
    commit_recommendation = 'YES';
    commit_reason = 'verify PASS / node --check PASS / 差分が意図通り';
  }

  return {
    packet_type: 'session_commit_readiness_packet',
    session_id,
    intended_files,
    actual_changed_files,
    unexpected_files,
    missing_intended,
    verify_status,
    verify_passed,
    verify_failed,
    node_check_status,
    node_check_errors,
    risk_level,
    dangerous_actions,
    has_dangerous,
    push_gate_required,
    commit_recommendation,
    commit_reason,
    push_gate: push_gate_required ? 'じゅんやさん最終YES必要' : 'AI側で完結可能',
    notes,
    version: '2.4.0',
    evaluated_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { createCommitReadinessPacket };

if (require.main === module) {
  const packet = createCommitReadinessPacket({
    session_id: 'session-v2.4.0-001',
    intended_files: ['tools/operator-run-session.js', 'package.json'],
    actual_changed_files: ['tools/operator-run-session.js', 'package.json'],
    verify_status: 'passed',
    verify_passed: 64,
    verify_failed: 0,
    node_check_status: 'passed',
    risk_level: 'Low',
    dangerous_actions: ['git push', 'git tag v2.4.0']
  });
  console.log(JSON.stringify(packet, null, 2));
}
