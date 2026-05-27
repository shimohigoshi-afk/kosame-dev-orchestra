/**
 * Dispatch History Record v2.3.0
 *
 * Records the history of tasks dispatched to AI agents.
 */

function createHistoryRecord() {
  return {
    history: [],
    version: '2.3.0',
    created_at: new Date().toISOString(),
    dryRun: true
  };
}

function appendHistoryEntry(record, entry) {
  const historyEntry = {
    seq: record.history.length + 1,
    request_id: entry.request_id || `dr-${Date.now()}`,
    task_id: entry.task_id,
    task_title: entry.task_title || '',
    assigned_agent: entry.assigned_agent,
    status: entry.status,
    started_at: entry.started_at || new Date().toISOString(),
    completed_at: entry.completed_at || null,
    files_modified: entry.files_modified || [],
    failure_reason: entry.failure_reason || null,
    fallback_used: entry.fallback_used || false,
    fallback_to: entry.fallback_to || null,
    verify_status: entry.verify_status || 'not_run',
    notes: entry.notes || ''
  };
  return { ...record, history: [...record.history, historyEntry] };
}

function getHistorySummary(record) {
  const h = record.history;
  const byAgent = {};
  const byStatus = { success: 0, failed: 0, partial: 0, timeout: 0 };

  h.forEach(e => {
    byAgent[e.assigned_agent] = (byAgent[e.assigned_agent] || 0) + 1;
    if (byStatus[e.status] !== undefined) byStatus[e.status]++;
  });

  const fallbackCount = h.filter(e => e.fallback_used).length;

  return {
    total_dispatches: h.length,
    by_agent: byAgent,
    by_status: byStatus,
    fallback_count: fallbackCount,
    success_rate: h.length > 0 ? Math.round((byStatus.success / h.length) * 100) : 0
  };
}

function getLastEntry(record) {
  return record.history.length > 0 ? record.history[record.history.length - 1] : null;
}

module.exports = { createHistoryRecord, appendHistoryEntry, getHistorySummary, getLastEntry };

if (require.main === module) {
  let record = createHistoryRecord();
  record = appendHistoryEntry(record, {
    request_id: 'dr-001',
    task_id: 'task-001',
    task_title: 'v2.2.0 実装',
    assigned_agent: 'gemini',
    status: 'failed',
    failure_reason: 'gemini_auth_error',
    fallback_used: true,
    fallback_to: 'claude'
  });
  record = appendHistoryEntry(record, {
    request_id: 'dr-002',
    task_id: 'task-001',
    task_title: 'v2.2.0 実装 (Claude fallback)',
    assigned_agent: 'claude',
    status: 'success',
    files_modified: ['tools/provider-routing-request-pack.js'],
    verify_status: 'passed'
  });
  const summary = getHistorySummary(record);
  console.log(JSON.stringify({ history: record.history, summary }, null, 2));
}
