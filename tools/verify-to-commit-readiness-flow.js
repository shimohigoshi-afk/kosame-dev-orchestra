/**
 * Verify to Commit Readiness Flow v2.5.0
 *
 * Standard flow: verify success → commit candidate decision.
 */

const { createCommitReadinessPacket } = require('./session-commit-readiness-packet.js');

const FLOW_STEPS = [
  'run_node_check',
  'run_verify',
  'check_diff',
  'evaluate_risk',
  'generate_commit_readiness',
  'submit_approval_packet'
];

function runVerifyToCommitFlow(flowInput) {
  const {
    session_id,
    node_check_results = {},
    verify_results = {},
    diff_results = {},
    risk_level = 'Low',
    intended_files = [],
    dangerous_actions = []
  } = flowInput;

  const steps_completed = [];
  const steps_failed = [];

  // Step 1: node --check
  const node_ok = node_check_results.status === 'passed';
  if (node_ok) steps_completed.push('run_node_check');
  else steps_failed.push({ step: 'run_node_check', reason: 'node --check failed' });

  // Step 2: verify
  const verify_ok = verify_results.status === 'passed' && (verify_results.failed || 0) === 0;
  if (verify_ok) steps_completed.push('run_verify');
  else if (!node_ok); // skip if node failed
  else steps_failed.push({ step: 'run_verify', reason: `verify failed: ${verify_results.failed || 0} failures` });

  // Step 3: diff check
  const unexpected = (diff_results.actual || []).filter(f => !intended_files.includes(f));
  const diff_ok = unexpected.length === 0;
  if (diff_ok) steps_completed.push('check_diff');
  else steps_failed.push({ step: 'check_diff', reason: `Unexpected files: ${unexpected.join(', ')}` });

  // Step 4: risk
  const risk_ok = risk_level !== 'Critical';
  if (risk_ok) steps_completed.push('evaluate_risk');
  else steps_failed.push({ step: 'evaluate_risk', reason: 'Critical risk requires human approval' });

  // Step 5: generate packet
  const all_ok = node_ok && verify_ok && diff_ok && risk_ok;

  const readiness = createCommitReadinessPacket({
    session_id,
    intended_files,
    actual_changed_files: diff_results.actual || [],
    verify_status: verify_results.status || 'not_run',
    verify_passed: verify_results.passed || 0,
    verify_failed: verify_results.failed || 0,
    node_check_status: node_check_results.status || 'not_run',
    node_check_errors: node_check_results.errors || [],
    risk_level,
    dangerous_actions
  });

  if (all_ok) steps_completed.push('generate_commit_readiness');

  return {
    flow_type: 'verify_to_commit_readiness_flow',
    session_id,
    steps_completed,
    steps_failed,
    flow_passed: all_ok,
    commit_recommendation: readiness.commit_recommendation,
    commit_reason: readiness.commit_reason,
    commit_readiness_packet: readiness,
    next_step: all_ok ? 'submit_approval_packet_to_junya' : `fix_step: ${steps_failed[0]?.step || 'unknown'}`,
    version: '2.5.0',
    evaluated_at: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { runVerifyToCommitFlow, FLOW_STEPS };

if (require.main === module) {
  const result = runVerifyToCommitFlow({
    session_id: 'session-v2.5.0-001',
    node_check_results: { status: 'passed', errors: [] },
    verify_results: { status: 'passed', passed: 80, failed: 0 },
    diff_results: { actual: ['tools/verify-to-commit-readiness-flow.js', 'package.json'] },
    risk_level: 'Low',
    intended_files: ['tools/verify-to-commit-readiness-flow.js', 'package.json'],
    dangerous_actions: ['git push', 'git tag v2.5.0']
  });
  console.log(`Flow: ${result.flow_passed ? 'PASSED' : 'FAILED'} → ${result.commit_recommendation} → ${result.next_step}`);
}
