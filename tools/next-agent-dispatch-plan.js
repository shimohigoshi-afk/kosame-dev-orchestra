/**
 * Next Agent Dispatch Plan v2.2.0
 *
 * Generates a dispatch plan: who does what next, based on provider health and task queue.
 */

const DISPATCH_TARGETS = ['gemini', 'claude', 'cloud_shell', 'github_actions', 'human'];

function generateDispatchPlan(params = {}) {
  const {
    pending_tasks = [],
    provider_health = {},
    current_session = {},
    force_provider = null
  } = params;

  if (!Array.isArray(pending_tasks)) throw new Error('pending_tasks must be array');

  const geminiAvailable = provider_health.gemini === 'gemini_available';
  const claudeAvailable = provider_health.claude !== 'claude_unavailable';
  const actionsStatus = provider_health.githubActions || 'unknown';

  const plan_entries = pending_tasks.map((task, idx) => {
    const { task_id, task_title, needs_bulk, needs_repair, needs_approval, risk_level = 'Low' } = task;

    let assigned_to = force_provider || 'claude';
    let rationale = '';

    if (force_provider) {
      rationale = `Forced to ${force_provider}.`;
    } else if (needs_approval || risk_level === 'High' || risk_level === 'Critical') {
      assigned_to = 'human';
      rationale = 'High risk or approval required → Human.';
    } else if (needs_bulk && geminiAvailable) {
      assigned_to = 'gemini';
      rationale = 'Bulk generation + Gemini available → Gemini.';
    } else if (needs_bulk && !geminiAvailable) {
      assigned_to = 'claude';
      rationale = 'Bulk generation but Gemini unavailable → Claude fallback.';
    } else if (needs_repair) {
      assigned_to = 'claude';
      rationale = 'Repair task → Claude.';
    } else {
      assigned_to = 'claude';
      rationale = 'Default → Claude.';
    }

    return {
      order: idx + 1,
      task_id,
      task_title,
      assigned_to,
      rationale,
      fallback: assigned_to === 'gemini' ? 'claude' : 'human',
      requires_verify: true,
      requires_approval: needs_approval || false
    };
  });

  const summary = {
    total_tasks: pending_tasks.length,
    gemini_tasks: plan_entries.filter(e => e.assigned_to === 'gemini').length,
    claude_tasks: plan_entries.filter(e => e.assigned_to === 'claude').length,
    human_tasks: plan_entries.filter(e => e.assigned_to === 'human').length
  };

  return {
    packet_type: 'next_agent_dispatch_plan',
    provider_health_snapshot: {
      gemini: geminiAvailable ? 'available' : 'unavailable',
      claude: claudeAvailable ? 'available' : 'unavailable',
      github_actions: actionsStatus
    },
    plan_entries,
    summary,
    next_immediate_action: plan_entries.length > 0
      ? `Execute task[1]: ${plan_entries[0].task_title} → ${plan_entries[0].assigned_to}`
      : 'No pending tasks',
    version: '2.2.0',
    timestamp: new Date().toISOString(),
    dryRun: true
  };
}

module.exports = { generateDispatchPlan, DISPATCH_TARGETS };

if (require.main === module) {
  const plan = generateDispatchPlan({
    pending_tasks: [
      { task_id: 't-001', task_title: 'v2.3.0 docs生成', needs_bulk: true },
      { task_id: 't-002', task_title: 'v2.3.0 smoke修正', needs_repair: true },
      { task_id: 't-003', task_title: 'git push', needs_approval: true, risk_level: 'High' }
    ],
    provider_health: {
      gemini: 'gemini_auth_error',
      claude: 'claude_available',
      githubActions: 'github_actions_success'
    }
  });
  console.log(JSON.stringify(plan, null, 2));
}
