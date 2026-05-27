/**
 * Session Verify Checkpoint v2.4.0
 *
 * Records node --check, npm run verify, GitHub Actions, and diff check results.
 */

const CHECKPOINT_STATUSES = ['passed', 'failed', 'partial', 'not_run', 'pending'];

function createVerifyCheckpoint(params = {}) {
  const {
    session_id,
    checkpoint_id = `chk-${Date.now()}`,
    node_check_status = 'not_run',
    node_check_files = [],
    node_check_errors = [],
    verify_status = 'not_run',
    verify_passed = 0,
    verify_failed = 0,
    verify_error_detail = '',
    actions_status = 'not_run',
    actions_url = '',
    diff_files = [],
    diff_unexpected_files = [],
    notes = ''
  } = params;

  const overall = deriveOverallStatus({
    node_check_status,
    verify_status,
    verify_failed,
    actions_status
  });

  return {
    checkpoint_type: 'session_verify_checkpoint',
    session_id,
    checkpoint_id,
    node_check: {
      status: node_check_status,
      checked_files: node_check_files,
      errors: node_check_errors
    },
    verify: {
      status: verify_status,
      passed: verify_passed,
      failed: verify_failed,
      error_detail: verify_error_detail
    },
    github_actions: {
      status: actions_status,
      url: actions_url
    },
    diff: {
      files_changed: diff_files,
      unexpected_files: diff_unexpected_files,
      unexpected_count: diff_unexpected_files.length
    },
    overall_status: overall,
    commit_proceed: overall === 'passed',
    repair_required: overall === 'failed',
    notes,
    version: '2.4.0',
    checked_at: new Date().toISOString(),
    dryRun: true
  };
}

function deriveOverallStatus({ node_check_status, verify_status, verify_failed, actions_status }) {
  if (node_check_status === 'failed' || verify_failed > 0 || verify_status === 'failed') return 'failed';
  if (actions_status === 'failed') return 'failed';
  if (node_check_status === 'passed' && verify_status === 'passed') return 'passed';
  if (node_check_status === 'not_run' || verify_status === 'not_run') return 'not_run';
  return 'partial';
}

module.exports = { createVerifyCheckpoint, deriveOverallStatus, CHECKPOINT_STATUSES };

if (require.main === module) {
  const chk = createVerifyCheckpoint({
    session_id: 'session-v2.4.0-001',
    node_check_status: 'passed',
    node_check_files: ['tools/operator-run-session.js'],
    verify_status: 'passed',
    verify_passed: 56,
    verify_failed: 0,
    actions_status: 'success',
    diff_files: ['tools/operator-run-session.js', 'package.json'],
    diff_unexpected_files: []
  });
  console.log(JSON.stringify(chk, null, 2));
}
