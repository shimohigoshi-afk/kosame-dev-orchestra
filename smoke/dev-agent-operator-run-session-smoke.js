/**
 * Smoke Test: Operator Run Session v2.4.0
 */
const { createSession, advanceSessionPhase, addProgressEntry, getSessionSummary, SESSION_PHASES } = require('../tools/operator-run-session.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Run Session v2.4.0');

  if (!Array.isArray(SESSION_PHASES) || !SESSION_PHASES.includes('start')) throw new Error('SESSION_PHASES missing');

  let session = createSession({
    session_id: 'test-session-001',
    purpose: 'test',
    target_version: '2.4.0',
    head_commit: 'abc123',
    package_version: '2.3.0',
    actions_status: 'success'
  });

  if (session.phase !== 'start') throw new Error('Initial phase should be start');
  if (session.version !== '2.4.0') throw new Error('Version mismatch');
  if (!session.dryRun) throw new Error('dryRun missing');

  session = advanceSessionPhase(session, 'in_progress');
  if (session.phase !== 'in_progress') throw new Error('Phase should be in_progress');

  session = addProgressEntry(session, {
    assigned_agent: 'claude',
    action: 'Create session tools',
    status: 'completed',
    files_touched: ['tools/operator-run-session.js']
  });
  if (session.progress_entries.length !== 1) throw new Error('Should have 1 progress entry');
  if (session.progress_entries[0].seq !== 1) throw new Error('seq should be 1');

  const summary = getSessionSummary(session);
  if (summary.session_id !== 'test-session-001') throw new Error('session_id mismatch');
  if (summary.phase !== 'in_progress') throw new Error('phase mismatch in summary');
  if (summary.progress_count !== 1) throw new Error('progress_count should be 1');

  let threw = false;
  try { advanceSessionPhase(session, 'invalid_phase'); } catch { threw = true; }
  if (!threw) throw new Error('Should throw on invalid phase');

  console.log('Smoke test PASSED');
  return { version: '2.4.0', purpose: 'Operator Run Session Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
