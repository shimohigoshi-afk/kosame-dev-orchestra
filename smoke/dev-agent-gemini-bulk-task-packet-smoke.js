/**
 * Smoke Test: Gemini Bulk Task Packet v2.2.0
 */
const { generateGeminiBulkTaskPacket } = require('../tools/gemini-bulk-task-packet.js');

function runSmokeTest() {
  console.log('Running smoke test: Gemini Bulk Task Packet v2.2.0');

  const packet = generateGeminiBulkTaskPacket({
    task_id: 'gemini-test-001',
    task_title: 'bulk test',
    task_description: 'test bulk generation',
    target_version: '2.3.0',
    target_files: ['docs/ai-dev-team/test.md'],
    fallback_to_claude_on_failure: true
  });

  if (packet.packet_type !== 'gemini_bulk_task_packet') throw new Error('Wrong packet_type');
  if (packet.assigned_to !== 'gemini') throw new Error('assigned_to should be gemini');

  // Verify hard rules
  const rules = packet.gemini_hard_rules;
  if (!rules.shell_execution.includes('FORBIDDEN')) throw new Error('shell_execution rule missing FORBIDDEN');
  if (!rules.confirmation_stops.includes('FORBIDDEN')) throw new Error('confirmation_stops rule missing FORBIDDEN');
  if (!rules.commit.includes('FORBIDDEN')) throw new Error('commit rule missing FORBIDDEN');
  if (!rules.push.includes('FORBIDDEN')) throw new Error('push rule missing FORBIDDEN');
  if (!rules.deploy.includes('FORBIDDEN')) throw new Error('deploy rule missing FORBIDDEN');

  if (!packet.completion_report_required) throw new Error('completion_report_required should be true');
  if (!packet.fallback_to_claude_on_failure) throw new Error('fallback_to_claude_on_failure should be true');
  if (!Array.isArray(packet.fallback_triggers)) throw new Error('fallback_triggers must be array');
  if (!packet.fallback_triggers.includes('auth_error')) throw new Error('Missing auth_error trigger');
  if (packet.version !== '2.2.0') throw new Error('Version mismatch');
  if (!packet.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Gemini Bulk Task Packet Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
