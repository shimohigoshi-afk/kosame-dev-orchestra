/**
 * Actions to Release Readiness Flow v2.5.0
 *
 * Standard flow: GitHub Actions success → release/tag candidate decision.
 */

const RELEASE_FLOW_STEPS = [
  'check_actions_result',
  'verify_smoke_coverage',
  'check_package_version',
  'check_release_docs',
  'generate_release_readiness',
  'submit_release_approval'
];

function runActionsToReleaseFlow(flowInput) {
  const {
    session_id,
    target_version = '',
    actions_status = 'unknown',
    actions_jobs = [],
    verify_passed = 0,
    verify_failed = 0,
    package_version = '',
    expected_package_version = '',
    release_docs_exist = false,
    risk_level = 'Low'
  } = flowInput;

  const steps_completed = [];
  const steps_failed = [];

  // Step 1: Actions success check
  const actions_ok = actions_status === 'success';
  if (actions_ok) steps_completed.push('check_actions_result');
  else steps_failed.push({ step: 'check_actions_result', reason: `Actions status: ${actions_status}` });

  // Step 2: Smoke coverage
  const smoke_ok = verify_failed === 0 && verify_passed > 0;
  if (smoke_ok) steps_completed.push('verify_smoke_coverage');
  else if (actions_ok) steps_failed.push({ step: 'verify_smoke_coverage', reason: `${verify_failed} smoke failures` });

  // Step 3: Package version
  const version_ok = !expected_package_version || package_version === expected_package_version;
  if (version_ok) steps_completed.push('check_package_version');
  else if (actions_ok && smoke_ok) steps_failed.push({
    step: 'check_package_version',
    reason: `Version mismatch: got ${package_version}, expected ${expected_package_version}`
  });

  // Step 4: Release docs
  if (release_docs_exist) steps_completed.push('check_release_docs');
  else if (actions_ok && smoke_ok && version_ok) steps_failed.push({ step: 'check_release_docs', reason: 'Release record doc missing' });

  // Step 5: Overall readiness
  const all_ok = actions_ok && smoke_ok && version_ok && release_docs_exist;

  const release_recommendation = all_ok ? 'YES' : 'HOLD';
  const release_reason = all_ok
    ? `Actions PASS / smoke全通過 (${verify_passed}) / version ${package_version} / release docs存在`
    : `未通過: ${steps_failed.map(s => s.step).join(', ')}`;

  if (all_ok) steps_completed.push('generate_release_readiness');

  return {
    flow_type: 'actions_to_release_readiness_flow',
    session_id,
    target_version,
    steps_completed,
    steps_failed,
    flow_passed: all_ok,
    release_recommendation,
    release_reason,
    gate_required_actions: ['git tag', `git tag v${target_version}`, 'git push --tags'],
    human_approval_required: true,
    next_step: all_ok
      ? 'submit_release_approval_packet_to_junya'
      : `fix_step: ${steps_failed[0]?.step || 'unknown'}`,
    version: '2.5.0',
    evaluated_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { runActionsToReleaseFlow, RELEASE_FLOW_STEPS };

if (require.main === module) {
  const result = runActionsToReleaseFlow({
    session_id: 'session-v2.5.0-001',
    target_version: '2.5.0',
    actions_status: 'success',
    verify_passed: 80,
    verify_failed: 0,
    package_version: '2.5.0',
    expected_package_version: '2.5.0',
    release_docs_exist: true,
    risk_level: 'Low'
  });
  console.log(`Release flow: ${result.flow_passed ? 'READY' : 'NOT READY'} → ${result.release_recommendation}`);
  console.log(`Reason: ${result.release_reason}`);
}
