/**
 * Smoke Test: Dispatch History Record v2.3.0
 */
const { createHistoryRecord, appendHistoryEntry, getHistorySummary, getLastEntry } = require('../tools/dispatch-history-record.js');

function runSmokeTest() {
  console.log('Running smoke test: Dispatch History Record v2.3.0');

  let rec = createHistoryRecord();
  if (!Array.isArray(rec.history)) throw new Error('history should be array');
  if (rec.version !== '2.3.0') throw new Error('Version mismatch');

  rec = appendHistoryEntry(rec, {
    request_id: 'dr-001',
    task_id: 'task-001',
    task_title: 'v2.2.0 実装 (Gemini attempt)',
    assigned_agent: 'gemini',
    status: 'failed',
    failure_reason: 'gemini_auth_error',
    fallback_used: true,
    fallback_to: 'claude'
  });
  rec = appendHistoryEntry(rec, {
    request_id: 'dr-002',
    task_id: 'task-001',
    task_title: 'v2.2.0 実装 (Claude fallback)',
    assigned_agent: 'claude',
    status: 'success',
    verify_status: 'passed'
  });

  if (rec.history.length !== 2) throw new Error('Should have 2 history entries');
  if (rec.history[0].seq !== 1) throw new Error('First entry seq should be 1');
  if (rec.history[1].seq !== 2) throw new Error('Second entry seq should be 2');
  if (!rec.history[0].fallback_used) throw new Error('First entry should have fallback_used');

  const summary = getHistorySummary(rec);
  if (summary.total_dispatches !== 2) throw new Error('total_dispatches should be 2');
  if (summary.by_agent.gemini !== 1) throw new Error('gemini count should be 1');
  if (summary.by_agent.claude !== 1) throw new Error('claude count should be 1');
  if (summary.by_status.success !== 1) throw new Error('success count should be 1');
  if (summary.by_status.failed !== 1) throw new Error('failed count should be 1');
  if (summary.fallback_count !== 1) throw new Error('fallback_count should be 1');
  if (summary.success_rate !== 50) throw new Error(`success_rate should be 50, got: ${summary.success_rate}`);

  const last = getLastEntry(rec);
  if (!last || last.assigned_agent !== 'claude') throw new Error('Last entry should be claude');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Dispatch History Record Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
