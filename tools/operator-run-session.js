/**
 * Operator Run Session v2.4.0
 *
 * Manages a complete development session: start → progress → verify → commit readiness → handoff.
 */

const SESSION_PHASES = ['start', 'in_progress', 'verify', 'repair', 'commit_ready', 'completed', 'handed_off'];

function createSession(params = {}) {
  const {
    session_id = `session-${Date.now()}`,
    purpose = '',
    target_version = '',
    repo = 'kosame-dev-orchestra',
    branch = 'main',
    head_commit = '',
    package_version = '',
    actions_status = 'unknown'
  } = params;

  return {
    session_id,
    purpose,
    target_version,
    repo,
    branch,
    head_commit,
    package_version,
    actions_status,
    phase: 'start',
    progress_entries: [],
    verify_checkpoints: [],
    repair_checkpoints: [],
    commit_readiness: null,
    handoff_summary: null,
    started_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: '2.4.0',
    dryRun: true
  };
}

function advanceSessionPhase(session, new_phase) {
  if (!SESSION_PHASES.includes(new_phase)) {
    throw new Error(`Invalid phase: ${new_phase}. Valid: ${SESSION_PHASES.join(', ')}`);
  }
  return { ...session, phase: new_phase, updated_at: new Date().toISOString() };
}

function addProgressEntry(session, entry) {
  const newEntry = {
    seq: session.progress_entries.length + 1,
    timestamp: new Date().toISOString(),
    assigned_agent: entry.assigned_agent || 'claude',
    action: entry.action || '',
    status: entry.status || 'in_progress',
    files_touched: entry.files_touched || [],
    blocker: entry.blocker || null,
    fallback_used: entry.fallback_used || false,
    notes: entry.notes || ''
  };
  return { ...session, progress_entries: [...session.progress_entries, newEntry], updated_at: new Date().toISOString() };
}

function getSessionSummary(session) {
  return {
    session_id: session.session_id,
    purpose: session.purpose,
    target_version: session.target_version,
    phase: session.phase,
    progress_count: session.progress_entries.length,
    verify_count: session.verify_checkpoints.length,
    repair_count: session.repair_checkpoints.length,
    commit_ready: session.commit_readiness?.commit_recommendation === 'YES',
    started_at: session.started_at,
    updated_at: session.updated_at
  };
}

module.exports = { createSession, advanceSessionPhase, addProgressEntry, getSessionSummary, SESSION_PHASES };

if (require.main === module) {
  let session = createSession({
    session_id: 'session-v2.4.0-001',
    purpose: 'v2.4.0 Operator Run Session Pack 実装',
    target_version: '2.4.0',
    branch: 'main',
    head_commit: '1c4473f',
    package_version: '2.1.0',
    actions_status: 'success'
  });
  session = advanceSessionPhase(session, 'in_progress');
  session = addProgressEntry(session, {
    assigned_agent: 'claude',
    action: 'Create session tools',
    status: 'completed',
    files_touched: ['tools/operator-run-session.js']
  });
  console.log(JSON.stringify(getSessionSummary(session), null, 2));
}
