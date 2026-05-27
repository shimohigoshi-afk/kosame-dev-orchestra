/**
 * Smoke Test: Actions to Release Readiness Flow v2.5.0
 */
const { runActionsToReleaseFlow, RELEASE_FLOW_STEPS } = require('../tools/actions-to-release-readiness-flow.js');

function runSmokeTest() {
  console.log('Running smoke test: Actions to Release Readiness Flow v2.5.0');

  if (!Array.isArray(RELEASE_FLOW_STEPS) || RELEASE_FLOW_STEPS.length === 0) throw new Error('RELEASE_FLOW_STEPS empty');

  // All passing
  const r1 = runActionsToReleaseFlow({
    session_id: 'test-001',
    target_version: '2.5.0',
    actions_status: 'success',
    verify_passed: 80,
    verify_failed: 0,
    package_version: '2.5.0',
    expected_package_version: '2.5.0',
    release_docs_exist: true,
    risk_level: 'Low'
  });
  if (r1.flow_type !== 'actions_to_release_readiness_flow') throw new Error('Wrong flow_type');
  if (!r1.flow_passed) throw new Error('All conditions met: flow should pass');
  if (r1.release_recommendation !== 'YES') throw new Error('Should recommend YES');
  if (!r1.human_approval_required) throw new Error('Release always requires human approval');
  if (r1.version !== '2.5.0') throw new Error('Version mismatch');

  // Actions failed → not ready
  const r2 = runActionsToReleaseFlow({
    session_id: 'test-002',
    target_version: '2.5.0',
    actions_status: 'failed',
    verify_passed: 80,
    verify_failed: 0,
    package_version: '2.5.0',
    release_docs_exist: true
  });
  if (r2.flow_passed) throw new Error('Actions failed: flow should not pass');
  if (r2.release_recommendation !== 'HOLD') throw new Error('Actions fail should be HOLD');

  // Version mismatch → not ready
  const r3 = runActionsToReleaseFlow({
    session_id: 'test-003',
    target_version: '2.5.0',
    actions_status: 'success',
    verify_passed: 80,
    verify_failed: 0,
    package_version: '2.4.0',
    expected_package_version: '2.5.0',
    release_docs_exist: true
  });
  if (r3.flow_passed) throw new Error('Version mismatch: flow should not pass');

  // Missing release docs → not ready
  const r4 = runActionsToReleaseFlow({
    session_id: 'test-004',
    target_version: '2.5.0',
    actions_status: 'success',
    verify_passed: 80,
    verify_failed: 0,
    package_version: '2.5.0',
    expected_package_version: '2.5.0',
    release_docs_exist: false
  });
  if (r4.flow_passed) throw new Error('Missing release docs: flow should not pass');

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Actions to Release Readiness Flow Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
