/**
 * Smoke Test: Provider Fallback Escalation v2.2.0
 */
const { determineEscalation, FAILURE_TYPES } = require('../tools/provider-fallback-escalation-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Provider Fallback Escalation v2.2.0');

  if (!Array.isArray(FAILURE_TYPES) || FAILURE_TYPES.length === 0) throw new Error('FAILURE_TYPES empty');

  // gemini_auth_error → claude, no retry
  const r1 = determineEscalation({ failure_type: 'gemini_auth_error', current_provider: 'gemini', risk_level: 'Low', retry_count: 0 });
  if (r1.escalation_target !== 'claude') throw new Error(`auth_error should go to claude, got: ${r1.escalation_target}`);
  if (r1.retry_recommended) throw new Error('auth_error should not retry');

  // gemini_quota_exhausted → claude
  const r2 = determineEscalation({ failure_type: 'gemini_quota_exhausted', current_provider: 'gemini', risk_level: 'Low', retry_count: 0 });
  if (r2.escalation_target !== 'claude') throw new Error(`quota should go to claude, got: ${r2.escalation_target}`);

  // gemini_timeout retry_count=0 → retry
  const r3 = determineEscalation({ failure_type: 'gemini_timeout', current_provider: 'gemini', risk_level: 'Low', retry_count: 0 });
  if (!r3.retry_recommended) throw new Error('First timeout should retry');

  // gemini_timeout retry_count=1 → claude
  const r4 = determineEscalation({ failure_type: 'gemini_timeout', current_provider: 'gemini', risk_level: 'Low', retry_count: 1 });
  if (r4.escalation_target !== 'claude') throw new Error('After retry, timeout should go to claude');

  // verify_failed → claude repair
  const r5 = determineEscalation({ failure_type: 'verify_failed', current_provider: 'claude', risk_level: 'Low', retry_count: 0 });
  if (r5.escalation_target !== 'claude') throw new Error('verify_failed should go to claude repair');

  // High risk → human_required
  const r6 = determineEscalation({ failure_type: 'gemini_timeout', current_provider: 'gemini', risk_level: 'High', retry_count: 1 });
  if (!r6.human_required) throw new Error('High risk should require human');

  if (r1.version !== '2.2.0') throw new Error('Version mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.2.0', purpose: 'Provider Fallback Escalation Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
