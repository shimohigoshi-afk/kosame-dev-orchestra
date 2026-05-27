/**
 * Smoke Test: Session Start Packet v2.4.0
 */
const { createSessionStartPacket, addSessionGoal } = require('../tools/session-start-packet.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Start Packet v2.4.0');

  let packet = createSessionStartPacket({
    session_id: 'test-session-001',
    purpose: 'v2.4.0 テスト',
    target_version: '2.4.0',
    head_commit: 'abc123',
    package_version: '2.3.0',
    actions_status: 'success',
    active_agent: 'claude',
    known_blockers: ['gemini_auth_error']
  });

  if (packet.packet_type !== 'session_start_packet') throw new Error('Wrong packet_type');
  if (packet.active_agent !== 'claude') throw new Error('active_agent mismatch');
  if (!Array.isArray(packet.safety_rules)) throw new Error('safety_rules must be array');
  if (!packet.safety_rules.some(r => r.includes('git push'))) throw new Error('Missing git push safety rule');
  if (!packet.safety_rules.some(r => r.includes('deploy'))) throw new Error('Missing deploy safety rule');
  if (!packet.known_blockers.includes('gemini_auth_error')) throw new Error('known_blockers missing');
  if (packet.version !== '2.4.0') throw new Error('Version mismatch');
  if (!packet.dryRun) throw new Error('dryRun missing');

  packet = addSessionGoal(packet, 'v2.4.0 session tools実装');
  if (packet.session_goals.length !== 1) throw new Error('session_goals should have 1 entry');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Start Packet Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
