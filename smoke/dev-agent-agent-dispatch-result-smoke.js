/**
 * Smoke Test: Agent Dispatch Result v2.3.0
 */
const { createDispatchResult, RESULT_STATUSES, deriveNextAction } = require('../tools/agent-dispatch-result-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Dispatch Result v2.3.0');

  if (!Array.isArray(RESULT_STATUSES)) throw new Error('RESULT_STATUSES missing');
  if (!RESULT_STATUSES.includes('success')) throw new Error('Missing success status');

  // Success result
  const r1 = createDispatchResult({
    request_id: 'dr-001',
    task_id: 't-001',
    assigned_agent: 'claude',
    status: 'success',
    files_modified: ['tools/test.js'],
    verify_status: 'passed',
    node_check_status: 'passed',
    fallback_required: false,
    next_action: 'commit_candidate'
  });
  if (r1.result_type !== 'agent_dispatch_result') throw new Error('Wrong result_type');
  if (r1.status !== 'success') throw new Error('status mismatch');
  if (r1.fallback_to) throw new Error('No fallback expected');
  if (r1.version !== '2.3.0') throw new Error('Version mismatch');

  // Failed result → fallback to claude
  const r2 = createDispatchResult({
    request_id: 'dr-002',
    task_id: 't-002',
    assigned_agent: 'gemini',
    status: 'failed',
    failure_type: 'gemini_auth_error',
    fallback_required: true
  });
  if (r2.fallback_to !== 'claude') throw new Error('Gemini failure should fallback to claude');
  if (!r2.fallback_required) throw new Error('fallback_required should be true');

  // deriveNextAction
  if (deriveNextAction('success', 'passed', false) !== 'commit_candidate') throw new Error('success+passed should be commit_candidate');
  if (deriveNextAction('success', 'not_run', false) !== 'run_verify') throw new Error('success+not_run should be run_verify');
  if (deriveNextAction('failed', 'failed', false) !== 'trigger_fallback_escalation') throw new Error('failed should trigger fallback');
  if (deriveNextAction('timeout', 'not_run', false) !== 'retry_or_fallback') throw new Error('timeout should retry_or_fallback');

  let threw = false;
  try { createDispatchResult({ assigned_agent: 'claude', status: 'invalid' }); } catch { threw = true; }
  if (!threw) throw new Error('Should throw on invalid status');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Dispatch Result Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
