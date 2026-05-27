/**
 * Kosame Release-Check Command v2.6.0
 *
 * Determines whether tag/release is ready.
 * YES only if GitHub Actions succeeded.
 * Release always requires じゅんやさんの最終YES.
 */

function executeReleaseCheckCommand(releaseInput = {}) {
  const {
    target_version = '',
    package_version = '',
    actions_status = 'unknown',
    verify_status = 'not_run',
    verify_passed = 0,
    verify_failed = 0,
    working_tree_clean = true,
    head_commit = '',
    release_docs_exist = false,
    session_id = ''
  } = releaseInput;

  const checks = {
    actions_success: actions_status === 'success',
    verify_passed: verify_status === 'passed' && verify_failed === 0,
    version_set: !!package_version && package_version === target_version,
    working_tree_clean,
    release_docs: release_docs_exist
  };

  const failures = [];
  if (!checks.actions_success) failures.push(`GitHub Actions: ${actions_status} (must be success)`);
  if (!checks.verify_passed) failures.push(`verify: ${verify_status} / failed: ${verify_failed}`);
  if (!checks.version_set) failures.push(`version mismatch: package=${package_version}, target=${target_version}`);
  if (!checks.working_tree_clean) failures.push('working tree has uncommitted changes');
  if (!checks.release_docs) failures.push('release record doc missing');

  const all_ok = failures.length === 0;
  const recommendation = all_ok ? 'YES' : (actions_status === 'pending' ? 'HOLD' : 'NO');
  const reason = all_ok
    ? `Actions PASS / verify全通過 (${verify_passed}) / version ${package_version} / release docs存在`
    : failures.join(' / ');

  return {
    command: 'kosame release-check',
    session_id,
    recommendation,
    reason,
    target_version,
    package_version,
    head_commit: head_commit.slice(0, 7) || 'unknown',
    checks,
    failures,
    // Release always requires human approval
    human_approval_required: true,
    gate_required: true,
    gate_reason: 'git tag / release は必ずじゅんやさんの最終YES後のみ実行。',
    junya_operations: recommendation === 'YES'
      ? [`git tag v${target_version}`, `git push origin v${target_version}`]
      : [],
    next_action: all_ok
      ? 'generate_tag_readiness_packet'
      : (actions_status === 'pending' ? 'wait_for_actions' : 'fix_release_blockers'),
    version: '2.6.0',
    generatedAt: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { executeReleaseCheckCommand };

if (require.main === module) {
  const result = executeReleaseCheckCommand({
    target_version: '2.6.0',
    package_version: '2.6.0',
    actions_status: 'success',
    verify_status: 'passed',
    verify_passed: 94,
    verify_failed: 0,
    working_tree_clean: true,
    head_commit: 'abc1234',
    release_docs_exist: true
  });
  console.log(JSON.stringify(result, null, 2));
}
