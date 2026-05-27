/**
 * Smoke Test: Claude Main Task Packet v2.2.0
 */
const { generateClaudeTaskPacket } = require('../tools/claude-main-task-packet.js');

function runSmokeTest() {
  console.log('Running smoke test: Claude Main Task Packet v2.2.0');

  const packet = generateClaudeTaskPacket({
    task_id: 'claude-test-001',
    task_title: 'test packet',
    task_description: 'test',
    target_version: '2.2.0',
    target_files: ['tools/test.js'],
    constraints: ['custom constraint'],
    forbidden_actions: ['custom_forbidden'],
    verify_required: true,
    approval_required: false,
    fallback_from: 'gemini_auth_error'
  });

  if (packet.packet_type !== 'claude_main_task_packet') throw new Error('Wrong packet_type');
  if (packet.assigned_to !== 'claude') throw new Error('assigned_to should be claude');
  if (!packet.forbidden_actions.includes('git push')) throw new Error('Missing default forbidden: git push');
  if (!packet.forbidden_actions.includes('deploy')) throw new Error('Missing default forbidden: deploy');
  if (!packet.forbidden_actions.includes('custom_forbidden')) throw new Error('Missing custom forbidden');
  if (!packet.constraints.includes('npm run verify が通ること')) throw new Error('Missing default constraint');
  if (!packet.constraints.includes('custom constraint')) throw new Error('Missing custom constraint');
  if (packet.fallback_from !== 'gemini_auth_error') throw new Error('fallback_from mismatch');
  if (packet.version !== '2.2.0') throw new Error('Version mismatch');
  if (!packet.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Claude Main Task Packet Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
