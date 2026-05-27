/**
 * Smoke Test: Kosame Approval Packet Generator v2.2.0
 */
const { generateApprovalPacket, JUNYA_REQUIRED_OPERATIONS, classifyDangerousActions } = require('../tools/kosame-approval-packet-generator.js');

function runSmokeTest() {
  console.log('Running smoke test: Kosame Approval Packet Generator v2.2.0');

  if (!Array.isArray(JUNYA_REQUIRED_OPERATIONS) || JUNYA_REQUIRED_OPERATIONS.length === 0) {
    throw new Error('JUNYA_REQUIRED_OPERATIONS empty');
  }

  // Valid YES packet
  const packet = generateApprovalPacket({
    recommendation: 'YES',
    reason: 'verify全PASS / node --check OK',
    remaining_risks: ['Gemini quota回復後確認'],
    dangerous_actions: ['git push', 'deploy'],
    junya_operations: ['git commit', 'git push'],
    ai_completed_checks: ['node --check OK', 'npm run verify PASS'],
    next_action: 'commit後GitHub Actions確認',
    task_title: 'v2.2.0実装',
    version_target: '2.2.0'
  });

  if (packet.packet_type !== 'kosame_approval_packet') throw new Error('Wrong packet_type');
  if (packet.recommendation !== 'YES') throw new Error('recommendation mismatch');
  if (!packet.junya_required) throw new Error('junya_required should be true');
  if (!packet.packet_text.includes('推奨：YES')) throw new Error('packet_text missing 推奨：YES');
  if (!packet.packet_text.includes('理由：')) throw new Error('packet_text missing 理由：');
  if (!packet.packet_text.includes('じゅんやさんの操作：')) throw new Error('packet_text missing じゅんやさんの操作：');
  if (packet.version !== '2.2.0') throw new Error('Version mismatch');

  // Invalid recommendation
  let threw = false;
  try { generateApprovalPacket({ recommendation: 'MAYBE' }); } catch { threw = true; }
  if (!threw) throw new Error('Should throw on invalid recommendation');

  // classifyDangerousActions
  const classified = classifyDangerousActions(['git push', 'npm install', 'deploy to cloud']);
  if (!classified.some(c => c.includes('push') || c.includes('deploy'))) {
    throw new Error('classifyDangerousActions should detect push/deploy');
  }

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Kosame Approval Packet Generator Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
