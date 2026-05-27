/**
 * Smoke Test: Verify to Commit Readiness Flow v2.5.0
 */
const { runVerifyToCommitFlow, FLOW_STEPS } = require('../tools/verify-to-commit-readiness-flow.js');

function runSmokeTest() {
  console.log('Running smoke test: Verify to Commit Readiness Flow v2.5.0');

  if (!Array.isArray(FLOW_STEPS) || FLOW_STEPS.length === 0) throw new Error('FLOW_STEPS empty');

  // All passing
  const r1 = runVerifyToCommitFlow({
    session_id: 'test-001',
    node_check_results: { status: 'passed', errors: [] },
    verify_results: { status: 'passed', passed: 80, failed: 0 },
    diff_results: { actual: ['tools/foo.js', 'package.json'] },
    risk_level: 'Low',
    intended_files: ['tools/foo.js', 'package.json'],
    dangerous_actions: ['git push']
  });

  if (r1.flow_type !== 'verify_to_commit_readiness_flow') throw new Error('Wrong flow_type');
  if (!r1.flow_passed) throw new Error('All conditions met: flow should pass');
  if (r1.commit_recommendation !== 'YES') throw new Error('Should recommend YES');
  if (r1.steps_failed.length !== 0) throw new Error('No steps should fail');
  if (r1.version !== '2.5.0') throw new Error('Version mismatch');

  // node_check failed → flow fails
  const r2 = runVerifyToCommitFlow({
    session_id: 'test-002',
    node_check_results: { status: 'failed', errors: ['SyntaxError'] },
    verify_results: { status: 'passed', passed: 80, failed: 0 },
    diff_results: { actual: ['tools/foo.js'] },
    intended_files: ['tools/foo.js'],
    risk_level: 'Low'
  });
  if (r2.flow_passed) throw new Error('node_check failed: flow should not pass');
  if (r2.commit_recommendation !== 'NO') throw new Error('node_check fail should be NO');

  // unexpected files → flow fails
  const r3 = runVerifyToCommitFlow({
    session_id: 'test-003',
    node_check_results: { status: 'passed' },
    verify_results: { status: 'passed', passed: 80, failed: 0 },
    diff_results: { actual: ['tools/foo.js', 'tools/surprise.js'] },
    intended_files: ['tools/foo.js'],
    risk_level: 'Low'
  });
  if (r3.flow_passed) throw new Error('Unexpected files: flow should not pass');
  if (r3.steps_failed.some(s => s.step === 'check_diff') === false) throw new Error('check_diff should fail');

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Verify to Commit Readiness Flow Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
