/**
 * Smoke Test: Session Commit Readiness Packet v2.4.0
 */
const { createCommitReadinessPacket } = require('../tools/session-commit-readiness-packet.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Commit Readiness Packet v2.4.0');

  // YES case: intended = actual, verify passed
  const p1 = createCommitReadinessPacket({
    session_id: 'test-session-001',
    intended_files: ['tools/foo.js', 'package.json'],
    actual_changed_files: ['tools/foo.js', 'package.json'],
    verify_status: 'passed',
    verify_passed: 56,
    verify_failed: 0,
    node_check_status: 'passed',
    risk_level: 'Low',
    dangerous_actions: ['git push', 'git tag v2.4.0']
  });

  if (p1.packet_type !== 'session_commit_readiness_packet') throw new Error('Wrong packet_type');
  if (p1.commit_recommendation !== 'YES') throw new Error(`Should be YES, got: ${p1.commit_recommendation}`);
  if (p1.unexpected_files.length !== 0) throw new Error('Should have no unexpected files');
  if (!p1.push_gate_required) throw new Error('push_gate should be required (git push in dangerous_actions)');
  if (p1.version !== '2.4.0') throw new Error('Version mismatch');

  // NO case: verify failed
  const p2 = createCommitReadinessPacket({
    session_id: 'test-session-001',
    intended_files: ['tools/foo.js'],
    actual_changed_files: ['tools/foo.js'],
    verify_status: 'failed',
    verify_failed: 3,
    node_check_status: 'passed',
    risk_level: 'Low'
  });
  if (p2.commit_recommendation !== 'NO') throw new Error(`Failed verify should be NO, got: ${p2.commit_recommendation}`);

  // NO case: unexpected files
  const p3 = createCommitReadinessPacket({
    session_id: 'test-session-001',
    intended_files: ['tools/foo.js'],
    actual_changed_files: ['tools/foo.js', 'tools/unexpected.js'],
    verify_status: 'passed',
    verify_failed: 0,
    node_check_status: 'passed',
    risk_level: 'Low'
  });
  if (p3.commit_recommendation !== 'NO') throw new Error('Unexpected files should make it NO');
  if (p3.unexpected_files.length !== 1) throw new Error('Should have 1 unexpected file');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Commit Readiness Packet Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
