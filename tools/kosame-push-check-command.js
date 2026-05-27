/**
 * Kosame Push-Check Command v2.6.0
 *
 * Determines whether push is safe to request.
 * Push ALWAYS requires じゅんやさんの最終YES — gate is always required.
 */

function executePushCheckCommand(pushInput = {}) {
  const {
    headCommit = '',
    originCommit = '',
    branch = 'main',
    package_version = '',
    verify_status = 'not_run',
    verify_failed = 0,
    actions_status = 'unknown',
    commit_ready = false,
    working_tree_clean = true,
    session_id = ''
  } = pushInput;

  const is_ahead = headCommit !== originCommit && headCommit !== '';
  const push_prerequisites = [];
  const blockers = [];

  if (!working_tree_clean) blockers.push('uncommitted changes exist — commit first');
  if (verify_status !== 'passed' || verify_failed > 0) blockers.push('verify not passed');
  if (!commit_ready) push_prerequisites.push('commit-check must be YES first');

  let recommendation = 'HOLD';
  let reason = '';

  if (blockers.length > 0) {
    recommendation = 'NO';
    reason = blockers.join(' / ');
  } else if (!is_ahead) {
    recommendation = 'HOLD';
    reason = 'No commits ahead of origin. Nothing to push.';
  } else if (verify_status === 'passed' && working_tree_clean && commit_ready) {
    recommendation = 'YES';
    reason = 'Commit ready, working tree clean, verify passed. じゅんやさんのYES後に実行。';
  } else {
    reason = push_prerequisites.join(' / ') || 'Prerequisites not met.';
  }

  return {
    command: 'kosame push-check',
    session_id,
    recommendation,
    reason,
    branch,
    headCommit: headCommit.slice(0, 7) || 'unknown',
    originCommit: originCommit.slice(0, 7) || 'unknown',
    is_ahead,
    package_version,
    verify_status,
    verify_failed,
    actions_status,
    commit_ready,
    working_tree_clean,
    blockers,
    // Push ALWAYS requires human approval — hardcoded
    human_approval_required: true,
    gate_required: true,
    gate_reason: 'git push は必ずじゅんやさんの最終YES後のみ実行。',
    junya_operation: `git push origin ${branch}`,
    next_action: recommendation === 'YES'
      ? 'generate_approval_packet_for_push'
      : 'resolve_blockers_first',
    version: '2.6.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { executePushCheckCommand };

if (require.main === module) {
  const result = executePushCheckCommand({
    headCommit: 'abc1234',
    originCommit: 'b9b02ee',
    branch: 'main',
    package_version: '2.6.0',
    verify_status: 'passed',
    actions_status: 'success',
    commit_ready: true,
    working_tree_clean: true
  });
  console.log(JSON.stringify(result, null, 2));
}
