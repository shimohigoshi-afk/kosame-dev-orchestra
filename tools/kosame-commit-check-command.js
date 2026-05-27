/**
 * Kosame Commit-Check Command v2.6.0
 *
 * Determines whether commit is safe.
 * Returns: recommendation (YES/NO/HOLD), reason, and detailed check items.
 */

function executeCommitCheckCommand(checkInput = {}) {
  const {
    intended_files = [],
    actual_changed_files = [],
    verify_status = 'not_run',
    verify_passed = 0,
    verify_failed = 0,
    node_check_status = 'not_run',
    node_check_errors = [],
    dangerous_actions = [],
    risk_level = 'Low',
    session_id = ''
  } = checkInput;

  const PUSH_TRIGGER_ACTIONS = ['git push', 'git tag', 'deploy', 'cloud_run'];
  const unexpected_files = actual_changed_files.filter(f => !intended_files.includes(f));
  const missing_intended = intended_files.filter(f => !actual_changed_files.includes(f));
  const has_push_trigger = dangerous_actions.some(a =>
    PUSH_TRIGGER_ACTIONS.some(pt => a.toLowerCase().includes(pt.replace('_', ' ')))
  );

  let recommendation = 'NO';
  const failure_reasons = [];

  if (verify_status !== 'passed' || verify_failed > 0) failure_reasons.push('verify 未PASS');
  if (node_check_status !== 'passed') failure_reasons.push('node --check 未PASS');
  if (node_check_errors.length > 0) failure_reasons.push(`node --check errors: ${node_check_errors.join(', ')}`);
  if (unexpected_files.length > 0) failure_reasons.push(`意図しないファイル: ${unexpected_files.join(', ')}`);
  if (risk_level === 'Critical') failure_reasons.push('Criticalリスク: 人間承認必要');

  if (failure_reasons.length === 0) {
    recommendation = 'YES';
  } else if (verify_status === 'not_run') {
    recommendation = 'HOLD';
    failure_reasons.length = 0;
    failure_reasons.push('verify未実行。npm run verify を先に実行してください。');
  }

  const human_approval_required = has_push_trigger || risk_level === 'High' || risk_level === 'Critical';

  return {
    command: 'kosame commit-check',
    session_id,
    recommendation,
    reason: failure_reasons.length > 0 ? failure_reasons.join(' / ') : 'verify PASS / node --check PASS / 差分が意図通り',
    intended_files,
    actual_changed_files,
    unexpected_files,
    missing_intended,
    verify_status,
    verify_passed,
    verify_failed,
    node_check_status,
    node_check_errors,
    dangerous_actions,
    has_push_trigger,
    risk_level,
    human_approval_required,
    next_action: recommendation === 'YES'
      ? (human_approval_required ? 'generate_approval_packet_then_commit' : 'safe_to_commit')
      : 'fix_issues_before_commit',
    version: '2.6.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { executeCommitCheckCommand };

if (require.main === module) {
  const result = executeCommitCheckCommand({
    intended_files: ['tools/kosame-status-command.js', 'package.json'],
    actual_changed_files: ['tools/kosame-status-command.js', 'package.json'],
    verify_status: 'passed',
    verify_passed: 87,
    verify_failed: 0,
    node_check_status: 'passed',
    dangerous_actions: [],
    risk_level: 'Low'
  });
  console.log(JSON.stringify(result, null, 2));
}
