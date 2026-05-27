/**
 * Smoke Test: Provider Routing Request v2.2.0
 */
const { createRoutingRequest, TASK_TYPES, URGENCY_LEVELS, RISK_LEVELS } = require('../tools/provider-routing-request-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Provider Routing Request v2.2.0');

  if (!Array.isArray(TASK_TYPES) || TASK_TYPES.length === 0) throw new Error('TASK_TYPES empty');
  if (!Array.isArray(URGENCY_LEVELS)) throw new Error('URGENCY_LEVELS missing');
  if (!Array.isArray(RISK_LEVELS)) throw new Error('RISK_LEVELS missing');

  const req = createRoutingRequest({
    task_id: 'test-001',
    task_title: 'test routing',
    task_type: 'bulk_generation',
    urgency: 'normal',
    risk_level: 'Low',
    needs_bulk_generation: true,
    blocked_provider: ['gemini'],
    forbidden_actions: ['git push'],
    human_approval_required: false
  });

  if (!req.task_id) throw new Error('task_id missing');
  if (req.task_type !== 'bulk_generation') throw new Error('task_type mismatch');
  if (!req.needs_bulk_generation) throw new Error('needs_bulk_generation should be true');
  if (!req.blocked_provider.includes('gemini')) throw new Error('blocked_provider missing gemini');
  if (req.version !== '2.2.0') throw new Error('Version mismatch');
  if (!req.dryRun) throw new Error('dryRun flag missing');

  let threw = false;
  try { createRoutingRequest({ task_type: 'invalid_type' }); } catch { threw = true; }
  if (!threw) throw new Error('Should throw on invalid task_type');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Provider Routing Request Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
