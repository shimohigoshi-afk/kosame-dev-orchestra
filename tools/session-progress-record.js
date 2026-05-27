/**
 * Session Progress Record v2.4.0
 *
 * Tracks mid-session state: assigned agents, completed/pending work,
 * blockers, and fallback history.
 */

function createProgressRecord(session_id) {
  return {
    record_type: 'session_progress_record',
    session_id,
    entries: [],
    blockers: [],
    fallback_history: [],
    completed_tasks: [],
    pending_tasks: [],
    version: '2.4.0',
    updated_at: new Date().toISOString(),
    dryRun: true
  };
}

function recordProgress(record, entry) {
  const newEntry = {
    seq: record.entries.length + 1,
    timestamp: new Date().toISOString(),
    agent: entry.agent || 'claude',
    action: entry.action || '',
    status: entry.status || 'completed',
    files_created: entry.files_created || [],
    files_modified: entry.files_modified || [],
    notes: entry.notes || ''
  };

  let updated = { ...record, entries: [...record.entries, newEntry] };

  if (entry.status === 'completed' && entry.task_id) {
    updated = { ...updated, completed_tasks: [...updated.completed_tasks, entry.task_id] };
    updated = { ...updated, pending_tasks: updated.pending_tasks.filter(t => t !== entry.task_id) };
  }

  return { ...updated, updated_at: new Date().toISOString() };
}

function recordBlocker(record, blocker) {
  const newBlocker = {
    seq: record.blockers.length + 1,
    timestamp: new Date().toISOString(),
    type: blocker.type || 'unknown',
    description: blocker.description || '',
    affected_agent: blocker.affected_agent || 'unknown',
    resolved: false,
    resolution: null
  };
  return { ...record, blockers: [...record.blockers, newBlocker], updated_at: new Date().toISOString() };
}

function recordFallback(record, fallback) {
  const newFallback = {
    seq: record.fallback_history.length + 1,
    timestamp: new Date().toISOString(),
    from_agent: fallback.from_agent,
    to_agent: fallback.to_agent,
    reason: fallback.reason || '',
    task_id: fallback.task_id || ''
  };
  return { ...record, fallback_history: [...record.fallback_history, newFallback], updated_at: new Date().toISOString() };
}

function getProgressSummary(record) {
  return {
    session_id: record.session_id,
    total_entries: record.entries.length,
    completed_tasks: record.completed_tasks.length,
    pending_tasks: record.pending_tasks.length,
    blockers: record.blockers.length,
    fallbacks: record.fallback_history.length,
    last_action: record.entries.length > 0 ? record.entries[record.entries.length - 1].action : null
  };
}

module.exports = { createProgressRecord, recordProgress, recordBlocker, recordFallback, getProgressSummary };

if (require.main === module) {
  let rec = createProgressRecord('session-v2.4.0-001');
  rec = recordBlocker(rec, { type: 'gemini_auth_error', description: 'metadata server error', affected_agent: 'gemini' });
  rec = recordFallback(rec, { from_agent: 'gemini', to_agent: 'claude', reason: 'auth_error', task_id: 'task-001' });
  rec = recordProgress(rec, { agent: 'claude', action: 'Implement v2.2.0 tools', status: 'completed', task_id: 'task-001', files_created: ['tools/provider-routing-request-pack.js'] });
  console.log(JSON.stringify(getProgressSummary(rec), null, 2));
}
