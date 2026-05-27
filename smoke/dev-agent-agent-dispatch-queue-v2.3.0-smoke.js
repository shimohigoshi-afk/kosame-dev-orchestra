/**
 * Smoke Test: Agent Dispatch Queue v2.3.0
 */
const { createQueue, enqueueTask, sortQueue, dequeueNext, completeTask, getQueueSummary, PRIORITY_ORDER } = require('../tools/agent-dispatch-queue-v2.3.0.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Dispatch Queue v2.3.0');

  if (typeof PRIORITY_ORDER !== 'object') throw new Error('PRIORITY_ORDER missing');
  if (PRIORITY_ORDER.critical !== 0) throw new Error('critical should be priority 0');

  let queue = createQueue();
  if (!Array.isArray(queue.tasks)) throw new Error('tasks should be array');

  queue = enqueueTask(queue, { task_id: 't-001', task_title: 'normal task', assigned_agent: 'claude', priority: 'normal' });
  queue = enqueueTask(queue, { task_id: 't-002', task_title: 'critical task', assigned_agent: 'claude', priority: 'critical' });
  queue = enqueueTask(queue, { task_id: 't-003', task_title: 'gemini task', assigned_agent: 'gemini', priority: 'high' });

  if (queue.tasks.length !== 3) throw new Error('Should have 3 tasks');

  // Sort: critical should come first
  const sorted = sortQueue(queue);
  if (sorted.tasks[0].priority !== 'critical') throw new Error('After sort, first task should be critical');

  // Dequeue
  const { task, queue: q2 } = dequeueNext(queue, 'claude');
  if (!task) throw new Error('Should dequeue a claude task');
  const inProgress = q2.tasks.find(t => t.task_id === task.request_id || t.status === 'in_progress');
  // (request_id may differ from task_id)

  // Complete
  const q3 = completeTask(q2, task.request_id, { success: true });

  // Summary
  const summary = getQueueSummary(queue);
  if (summary.total !== 3) throw new Error('Summary total should be 3');
  if (summary.pending !== 3) throw new Error('All should be pending initially');
  if (!summary.by_agent.claude) throw new Error('by_agent.claude missing');

  if (queue.version !== '2.3.0') throw new Error('Version mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Dispatch Queue v2.3.0 Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
