/**
 * Agent Task Priority Rules v2.3.0
 *
 * Determines task priority based on urgency, impact, dangerous operations,
 * and agent suitability (Gemini-suited vs Claude-suited).
 */

function classifyTaskPriority(task) {
  const {
    urgency = 'normal',
    risk_level = 'Low',
    has_dangerous_operations = false,
    is_blocking_release = false,
    is_blocking_verify = false,
    needs_bulk = false,
    needs_repair = false,
    needs_human_approval = false
  } = task;

  let priority = 'normal';
  let priority_score = 50;
  const reasons = [];

  // Urgency contribution
  const urgencyScores = { critical: 100, high: 75, normal: 50, low: 25 };
  priority_score = urgencyScores[urgency] || 50;
  if (urgency === 'critical') reasons.push('Critical urgency');
  if (urgency === 'high') reasons.push('High urgency');

  // Blocking factors
  if (is_blocking_release) { priority_score += 30; reasons.push('Blocking release'); }
  if (is_blocking_verify) { priority_score += 20; reasons.push('Blocking verify'); }

  // Dangerous operations → bump priority for human awareness
  if (has_dangerous_operations || needs_human_approval) {
    priority_score += 15;
    reasons.push('Requires human approval');
  }

  // Risk level
  const riskScores = { Critical: 20, High: 15, Medium: 5, Low: 0 };
  priority_score += riskScores[risk_level] || 0;

  // Determine priority level
  if (priority_score >= 100) priority = 'critical';
  else if (priority_score >= 70) priority = 'high';
  else if (priority_score >= 40) priority = 'normal';
  else priority = 'low';

  // Agent suitability
  let preferred_agent = 'claude';
  let agent_reason = '';
  if (needs_bulk && !has_dangerous_operations) {
    preferred_agent = 'gemini';
    agent_reason = 'Bulk generation → Gemini preferred';
  } else if (needs_repair) {
    preferred_agent = 'claude';
    agent_reason = 'Repair task → Claude (verify cycle)';
  } else if (needs_human_approval || risk_level === 'High' || risk_level === 'Critical') {
    preferred_agent = 'human';
    agent_reason = 'High risk / approval required → Human';
  } else {
    agent_reason = 'Default → Claude';
  }

  return {
    task_id: task.task_id,
    priority,
    priority_score,
    priority_reasons: reasons,
    preferred_agent,
    agent_reason,
    version: '2.3.0',
    dryRun: true
  };
}

function sortTasksByPriority(tasks) {
  const PRIORITY_ORDER = { critical: 0, high: 1, normal: 2, low: 3 };
  return tasks
    .map(t => ({ ...t, ...classifyTaskPriority(t) }))
    .sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2));
}

module.exports = { classifyTaskPriority, sortTasksByPriority };

if (require.main === module) {
  const tasks = [
    { task_id: 't-001', urgency: 'normal', risk_level: 'Low', needs_bulk: true },
    { task_id: 't-002', urgency: 'critical', risk_level: 'Low', is_blocking_release: true },
    { task_id: 't-003', urgency: 'high', risk_level: 'High', needs_human_approval: true },
    { task_id: 't-004', urgency: 'low', risk_level: 'Low', needs_repair: true }
  ];
  const sorted = sortTasksByPriority(tasks);
  console.log(JSON.stringify(sorted.map(t => ({ task_id: t.task_id, priority: t.priority, preferred_agent: t.preferred_agent })), null, 2));
}
