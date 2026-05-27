/**
 * Smoke Test: Provider Routing Result v2.2.0
 */
const { createRoutingRequest } = require('../tools/provider-routing-request-pack.js');
const { evaluateRoutingRequest } = require('../tools/provider-routing-result-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Provider Routing Result v2.2.0');

  // bulk_generation + Gemini not blocked → gemini
  const r1 = evaluateRoutingRequest(createRoutingRequest({ task_type: 'bulk_generation', needs_bulk_generation: true, risk_level: 'Low' }));
  if (r1.recommended_provider !== 'gemini') throw new Error(`bulk_gen should route to gemini, got: ${r1.recommended_provider}`);
  if (!r1.next_action.includes('gemini')) throw new Error('next_action should reference gemini');

  // bulk_generation + Gemini blocked → claude
  const r2 = evaluateRoutingRequest(createRoutingRequest({ task_type: 'bulk_generation', needs_bulk_generation: true, blocked_provider: ['gemini'], risk_level: 'Low' }));
  if (r2.recommended_provider !== 'claude') throw new Error(`blocked gemini should route to claude, got: ${r2.recommended_provider}`);

  // precise_repair → claude
  const r3 = evaluateRoutingRequest(createRoutingRequest({ task_type: 'precise_repair', needs_precise_repair: true, risk_level: 'Low' }));
  if (r3.recommended_provider !== 'claude') throw new Error(`repair should route to claude, got: ${r3.recommended_provider}`);

  // architecture_judgment → kosame
  const r4 = evaluateRoutingRequest(createRoutingRequest({ task_type: 'architecture_design', needs_architecture_judgment: true, risk_level: 'Low' }));
  if (r4.recommended_provider !== 'kosame') throw new Error(`architecture should route to kosame, got: ${r4.recommended_provider}`);

  // High risk → approval_packet_required
  const r5 = evaluateRoutingRequest(createRoutingRequest({ task_type: 'docs_update', risk_level: 'High' }));
  if (!r5.approval_packet_required) throw new Error('High risk should require approval packet');

  if (r1.version !== '2.2.0') throw new Error('Version mismatch');
  if (!r1.dryRun) throw new Error('dryRun missing');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Provider Routing Result Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
