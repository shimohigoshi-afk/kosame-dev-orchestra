/**
 * Smoke Test: Session Handoff Summary v2.4.0
 */
const { generateHandoffSummary } = require('../tools/session-handoff-summary.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Handoff Summary v2.4.0');

  const summary = generateHandoffSummary({
    session_id: 'test-session-001',
    purpose: 'v2.4.0 テスト',
    target_version: '2.4.0',
    head_commit: 'abc123',
    package_version: '2.3.0',
    phase: 'in_progress',
    completed_tasks: ['v2.2.0 完了', 'v2.3.0 完了'],
    pending_tasks: ['v2.4.0 完了待ち', 'v2.5.0 未実装'],
    blocker_history: [{ type: 'gemini_auth_error', description: 'metadata server error', resolved: true }],
    fallback_history: [{ from_agent: 'gemini', to_agent: 'claude', reason: 'auth_error' }],
    last_verify_status: 'passed',
    last_actions_status: 'success',
    next_immediate_action: 'v2.5.0 実装'
  });

  if (summary.packet_type !== 'session_handoff_summary') throw new Error('Wrong packet_type');
  if (summary.session_id !== 'test-session-001') throw new Error('session_id mismatch');
  if (summary.completed_tasks.length !== 2) throw new Error('completed_tasks count mismatch');
  if (summary.pending_tasks.length !== 2) throw new Error('pending_tasks count mismatch');
  if (!summary.summary_text.includes('Session Handoff Summary')) throw new Error('summary_text missing title');
  if (!summary.summary_text.includes('完了タスク')) throw new Error('summary_text missing completed tasks section');
  if (!summary.summary_text.includes('残タスク')) throw new Error('summary_text missing pending tasks section');
  if (!summary.summary_text.includes('v2.4.0')) throw new Error('summary_text missing version');
  if (summary.version !== '2.4.0') throw new Error('Version mismatch');
  if (!summary.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Handoff Summary Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
