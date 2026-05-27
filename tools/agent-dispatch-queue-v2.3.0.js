/**
 * Agent Dispatch Queue v2.3.0
 *
 * Multi-task queue with priority, risk, agent, and verify-required sorting.
 * Successor to agent-dispatch-queue-pack.js (v0.5.2).
 */

const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };

function createQueue(initial_tasks = []) {
  const tasks = initial_tasks.map(t => ({
    ...t,
    status: t.status || 'pending',
    added_at: t.added_at || new Date().toISOString()
  }));

  return {
    tasks,
    version: '2.3.0',
    dryRun: true
  };
}

function enqueueTask(queue, task) {
  const newTask = {
    request_id: task.request_id || `dr-${Date.now()}`,
    task_id: task.task_id,
    task_title: task.task_title || '',
    assigned_agent: task.assigned_agent || 'claude',
    priority: task.priority || 'normal',
    risk_level: task.risk_level || 'Low',
    requires_verify: task.requires_verify !== false,
    requires_human_approval: task.requires_human_approval || false,
    status: 'pending',
    added_at: new Date().toISOString()
  };
  return { ...queue, tasks: [...queue.tasks, newTask] };
}

function sortQueue(queue) {
  const sorted = [...queue.tasks].sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 2;
    const pb = PRIORITY_ORDER[b.priority] ?? 2;
    if (pa !== pb) return pa - pb;

    // Within same priority: High/Critical risk first (needs human approval)
    const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
    return (riskOrder[a.risk_level] ?? 3) - (riskOrder[b.risk_level] ?? 3);
  });
  return { ...queue, tasks: sorted };
}

function dequeueNext(queue, agent_filter = null) {
  const pending = queue.tasks.filter(t =>
    t.status === 'pending' &&
    (!agent_filter || t.assigned_agent === agent_filter)
  );
  if (pending.length === 0) return { task: null, queue };
  const sorted = [...pending].sort((a, b) =>
    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  );
  const next = sorted[0];
  const updated = queue.tasks.map(t =>
    t.request_id === next.request_id ? { ...t, status: 'in_progress' } : t
  );
  return { task: next, queue: { ...queue, tasks: updated } };
}

function completeTask(queue, request_id, result = {}) {
  const updated = queue.tasks.map(t =>
    t.request_id === request_id
      ? { ...t, status: result.failed ? 'failed' : 'completed', completed_at: new Date().toISOString(), result }
      : t
  );
  return { ...queue, tasks: updated };
}

function getQueueSummary(queue) {
  const counts = { pending: 0, in_progress: 0, completed: 0, failed: 0 };
  queue.tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++; });
  return {
    total: queue.tasks.length,
    ...counts,
    by_agent: DISPATCH_AGENTS_SUMMARY(queue.tasks)
  };
}

function DISPATCH_AGENTS_SUMMARY(tasks) {
  const agents = {};
  tasks.forEach(t => {
    agents[t.assigned_agent] = (agents[t.assigned_agent] || 0) + 1;
  });
  return agents;
}

module.exports = { createQueue, enqueueTask, sortQueue, dequeueNext, completeTask, getQueueSummary, PRIORITY_ORDER };

if (require.main === module) {
  let queue = createQueue();
  queue = enqueueTask(queue, { task_id: 't-001', task_title: 'docs更新', assigned_agent: 'claude', priority: 'normal' });
  queue = enqueueTask(queue, { task_id: 't-002', task_title: '緊急修正', assigned_agent: 'claude', priority: 'critical' });
  queue = sortQueue(queue);
  const summary = getQueueSummary(queue);
  console.log(JSON.stringify({ queue: queue.tasks.map(t => ({ ...t })), summary }, null, 2));
}
