/**
 * Smoke Test: Agent Dispatch Request v2.3.0
 */
const { createDispatchRequest, DISPATCH_PRIORITIES, DISPATCH_AGENTS } = require('../tools/agent-dispatch-request-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Dispatch Request v2.3.0');

  if (!Array.isArray(DISPATCH_PRIORITIES) || !DISPATCH_PRIORITIES.includes('critical')) throw new Error('DISPATCH_PRIORITIES missing');
  if (!Array.isArray(DISPATCH_AGENTS) || !DISPATCH_AGENTS.includes('claude')) throw new Error('DISPATCH_AGENTS missing');

  const req = createDispatchRequest({
    task_id: 'task-001',
    task_title: 'dispatch test',
    assigned_agent: 'claude',
    priority: 'normal',
    risk_level: 'Low',
    requires_verify: true
  });

  if (req.assigned_agent !== 'claude') throw new Error('assigned_agent mismatch');
  if (req.status !== 'pending') throw new Error('status should be pending');
  if (req.fallback_agent !== 'human') throw new Error('fallback for claude should be human');
  if (req.version !== '2.3.0') throw new Error('Version mismatch');
  if (!req.dryRun) throw new Error('dryRun missing');

  // gemini fallback → claude
  const geminiReq = createDispatchRequest({ task_id: 't-g', task_title: 'g', assigned_agent: 'gemini', priority: 'normal' });
  if (geminiReq.fallback_agent !== 'claude') throw new Error('Gemini fallback should be claude');

  let threw = false;
  try { createDispatchRequest({ assigned_agent: 'invalid_agent' }); } catch { threw = true; }
  if (!threw) throw new Error('Should throw on invalid agent');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Dispatch Request Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
