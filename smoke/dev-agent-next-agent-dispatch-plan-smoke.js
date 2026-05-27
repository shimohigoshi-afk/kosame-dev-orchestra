/**
 * Smoke Test: Next Agent Dispatch Plan v2.2.0
 */
const { generateDispatchPlan, DISPATCH_TARGETS } = require('../tools/next-agent-dispatch-plan.js');

function runSmokeTest() {
  console.log('Running smoke test: Next Agent Dispatch Plan v2.2.0');

  if (!Array.isArray(DISPATCH_TARGETS) || DISPATCH_TARGETS.length === 0) throw new Error('DISPATCH_TARGETS empty');

  // Gemini auth error → all bulk tasks should go to claude
  const plan1 = generateDispatchPlan({
    pending_tasks: [
      { task_id: 't-001', task_title: 'bulk docs', needs_bulk: true },
      { task_id: 't-002', task_title: 'repair smoke', needs_repair: true }
    ],
    provider_health: { gemini: 'gemini_auth_error', claude: 'claude_available', githubActions: 'github_actions_success' }
  });

  if (plan1.packet_type !== 'next_agent_dispatch_plan') throw new Error('Wrong packet_type');
  if (plan1.plan_entries.length !== 2) throw new Error('Should have 2 plan entries');
  if (plan1.provider_health_snapshot.gemini !== 'unavailable') throw new Error('Gemini should show as unavailable');
  // bulk + gemini unavailable → claude
  const bulkEntry = plan1.plan_entries.find(e => e.task_id === 't-001');
  if (bulkEntry.assigned_to !== 'claude') throw new Error(`Bulk with gemini blocked should go to claude, got: ${bulkEntry.assigned_to}`);

  // Gemini available → bulk goes to gemini
  const plan2 = generateDispatchPlan({
    pending_tasks: [{ task_id: 't-003', task_title: 'bulk gen', needs_bulk: true }],
    provider_health: { gemini: 'gemini_available', claude: 'claude_available' }
  });
  const geminiEntry = plan2.plan_entries.find(e => e.task_id === 't-003');
  if (geminiEntry.assigned_to !== 'gemini') throw new Error(`Bulk with gemini available should go to gemini`);

  // High risk → human
  const plan3 = generateDispatchPlan({
    pending_tasks: [{ task_id: 't-004', task_title: 'git push', needs_approval: true, risk_level: 'High' }],
    provider_health: { gemini: 'gemini_available' }
  });
  if (plan3.plan_entries[0].assigned_to !== 'human') throw new Error('High risk should go to human');

  if (plan1.version !== '2.2.0') throw new Error('Version mismatch');
  if (!plan1.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Next Agent Dispatch Plan Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
