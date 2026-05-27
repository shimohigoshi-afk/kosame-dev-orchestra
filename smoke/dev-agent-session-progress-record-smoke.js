/**
 * Smoke Test: Session Progress Record v2.4.0
 */
const { createProgressRecord, recordProgress, recordBlocker, recordFallback, getProgressSummary } = require('../tools/session-progress-record.js');

function runSmokeTest() {
  console.log('Running smoke test: Session Progress Record v2.4.0');

  let rec = createProgressRecord('test-session-001');
  if (rec.record_type !== 'session_progress_record') throw new Error('Wrong record_type');
  if (!Array.isArray(rec.entries)) throw new Error('entries must be array');
  if (rec.version !== '2.4.0') throw new Error('Version mismatch');

  rec = recordBlocker(rec, { type: 'gemini_auth_error', description: 'metadata server error', affected_agent: 'gemini' });
  if (rec.blockers.length !== 1) throw new Error('Should have 1 blocker');

  rec = recordFallback(rec, { from_agent: 'gemini', to_agent: 'claude', reason: 'auth_error', task_id: 'task-001' });
  if (rec.fallback_history.length !== 1) throw new Error('Should have 1 fallback');

  rec = recordProgress(rec, {
    agent: 'claude',
    action: 'Create v2.2.0 tools',
    status: 'completed',
    task_id: 'task-001',
    files_created: ['tools/provider-routing-request-pack.js']
  });
  if (rec.entries.length !== 1) throw new Error('Should have 1 progress entry');
  if (rec.entries[0].seq !== 1) throw new Error('seq should be 1');
  if (!rec.completed_tasks.includes('task-001')) throw new Error('task-001 should be in completed_tasks');

  const summary = getProgressSummary(rec);
  if (summary.total_entries !== 1) throw new Error('total_entries should be 1');
  if (summary.completed_tasks !== 1) throw new Error('completed_tasks should be 1');
  if (summary.blockers !== 1) throw new Error('blockers should be 1');
  if (summary.fallbacks !== 1) throw new Error('fallbacks should be 1');
  if (summary.last_action !== 'Create v2.2.0 tools') throw new Error('last_action mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Session Progress Record Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
