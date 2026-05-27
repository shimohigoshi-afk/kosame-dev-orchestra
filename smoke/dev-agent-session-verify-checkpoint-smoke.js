/**
 * Smoke Test: Session Verify Checkpoint v2.4.0
 */
const { createVerifyCheckpoint, deriveOverallStatus } = require('../tools/session-verify-checkpoint.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Verify Checkpoint v2.4.0');

  // All passing
  const chk1 = createVerifyCheckpoint({
    session_id: 'test-session-001',
    node_check_status: 'passed',
    node_check_files: ['tools/foo.js'],
    verify_status: 'passed',
    verify_passed: 56,
    verify_failed: 0,
    actions_status: 'success',
    diff_files: ['tools/foo.js'],
    diff_unexpected_files: []
  });

  if (chk1.checkpoint_type !== 'session_verify_checkpoint') throw new Error('Wrong checkpoint_type');
  if (chk1.overall_status !== 'passed') throw new Error('Should be passed overall');
  if (!chk1.commit_proceed) throw new Error('commit_proceed should be true');
  if (chk1.repair_required) throw new Error('repair_required should be false');
  if (chk1.version !== '2.4.0') throw new Error('Version mismatch');

  // Verify failure
  const chk2 = createVerifyCheckpoint({
    session_id: 'test-session-001',
    node_check_status: 'passed',
    verify_status: 'failed',
    verify_failed: 3
  });
  if (chk2.overall_status !== 'failed') throw new Error('Should be failed overall');
  if (!chk2.repair_required) throw new Error('repair_required should be true');
  if (chk2.commit_proceed) throw new Error('commit_proceed should be false');

  // deriveOverallStatus
  if (deriveOverallStatus({ node_check_status: 'passed', verify_status: 'passed', verify_failed: 0, actions_status: 'success' }) !== 'passed') {
    throw new Error('All pass should be passed');
  }
  if (deriveOverallStatus({ node_check_status: 'failed', verify_status: 'not_run', verify_failed: 0, actions_status: 'unknown' }) !== 'failed') {
    throw new Error('node_check failed should be failed');
  }

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Verify Checkpoint Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
