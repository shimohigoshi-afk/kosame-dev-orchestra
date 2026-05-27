/**
 * Smoke Test: Agent Task Priority Rules v2.3.0
 */
const { classifyTaskPriority, sortTasksByPriority } = require('../tools/agent-task-priority-rules.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Task Priority Rules v2.3.0');

  // Critical urgency → critical priority
  const r1 = classifyTaskPriority({ task_id: 't-001', urgency: 'critical', risk_level: 'Low' });
  if (r1.priority !== 'critical') throw new Error(`critical urgency should be critical priority, got: ${r1.priority}`);
  if (r1.version !== '2.3.0') throw new Error('Version mismatch');

  // High risk + human approval → high+ priority
  const r2 = classifyTaskPriority({ task_id: 't-002', urgency: 'normal', risk_level: 'High', needs_human_approval: true });
  if (!['high', 'critical'].includes(r2.priority)) throw new Error(`High risk should be high+ priority, got: ${r2.priority}`);
  if (r2.preferred_agent !== 'human') throw new Error('High risk should prefer human');

  // needs_bulk → gemini
  const r3 = classifyTaskPriority({ task_id: 't-003', urgency: 'normal', risk_level: 'Low', needs_bulk: true });
  if (r3.preferred_agent !== 'gemini') throw new Error('bulk should prefer gemini');

  // needs_repair → claude
  const r4 = classifyTaskPriority({ task_id: 't-004', urgency: 'low', risk_level: 'Low', needs_repair: true });
  if (r4.preferred_agent !== 'claude') throw new Error('repair should prefer claude');

  // sortTasksByPriority: critical first
  const sorted = sortTasksByPriority([
    { task_id: 'a', urgency: 'low', risk_level: 'Low' },
    { task_id: 'b', urgency: 'critical', risk_level: 'Low', is_blocking_release: true },
    { task_id: 'c', urgency: 'normal', risk_level: 'Low' }
  ]);
  if (sorted[0].task_id !== 'b') throw new Error(`Critical task should be first, got: ${sorted[0].task_id}`);

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Task Priority Rules Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
