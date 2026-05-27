/**
 * Smoke Test: Provider Health Status v2.1.0
 */

const {
  PROVIDER_STATES,
  GEMINI_FALLBACK_TRIGGERS,
  createProviderHealthSnapshot,
  getRoutingRecommendation,
  classifyGeminiFallbackTrigger
} = require('../tools/provider-health-status.js');

function runSmokeTest() {
  console.log('Running smoke test: Provider Health Status v2.1.0');

  // 1. PROVIDER_STATES の存在確認
  if (!PROVIDER_STATES.GEMINI_AVAILABLE) throw new Error('Missing GEMINI_AVAILABLE state');
  if (!PROVIDER_STATES.GEMINI_AUTH_ERROR) throw new Error('Missing GEMINI_AUTH_ERROR state');
  if (!PROVIDER_STATES.GEMINI_QUOTA_EXHAUSTED) throw new Error('Missing GEMINI_QUOTA_EXHAUSTED state');
  if (!PROVIDER_STATES.GEMINI_NEEDS_FALLBACK) throw new Error('Missing GEMINI_NEEDS_FALLBACK state');
  if (!PROVIDER_STATES.CLAUDE_AVAILABLE) throw new Error('Missing CLAUDE_AVAILABLE state');

  // 2. GEMINI_FALLBACK_TRIGGERS の確認
  if (!Array.isArray(GEMINI_FALLBACK_TRIGGERS)) throw new Error('GEMINI_FALLBACK_TRIGGERS should be array');
  if (!GEMINI_FALLBACK_TRIGGERS.includes('QUOTA_EXHAUSTED')) throw new Error('Missing QUOTA_EXHAUSTED trigger');
  if (!GEMINI_FALLBACK_TRIGGERS.includes('auth_error')) throw new Error('Missing auth_error trigger');

  // 3. createProviderHealthSnapshot
  const snapshot = createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AUTH_ERROR });
  if (snapshot.gemini !== PROVIDER_STATES.GEMINI_AUTH_ERROR) throw new Error('Snapshot gemini state mismatch');
  if (snapshot.version !== '2.1.0') throw new Error('Snapshot version mismatch');
  if (!snapshot.dryRun) throw new Error('dryRun flag missing');

  // 4. getRoutingRecommendation - auth error → fallback to claude
  const authRec = getRoutingRecommendation(snapshot);
  if (authRec.primaryProvider !== 'claude') throw new Error('Auth error should route to claude');
  if (!authRec.requiresHandoff) throw new Error('Auth error should require handoff');

  // 5. getRoutingRecommendation - gemini available → use gemini
  const availableSnapshot = createProviderHealthSnapshot({ gemini: PROVIDER_STATES.GEMINI_AVAILABLE });
  const availableRec = getRoutingRecommendation(availableSnapshot);
  if (availableRec.primaryProvider !== 'gemini') throw new Error('Available gemini should route to gemini');

  // 6. classifyGeminiFallbackTrigger
  const authTrigger = classifyGeminiFallbackTrigger('metadata server application default credentials error');
  if (authTrigger !== 'metadata_server_error') throw new Error(`Wrong trigger: ${authTrigger}`);

  const quotaTrigger = classifyGeminiFallbackTrigger('QUOTA_EXHAUSTED error occurred');
  if (quotaTrigger !== 'QUOTA_EXHAUSTED') throw new Error(`Wrong trigger: ${quotaTrigger}`);

  const tokenTrigger = classifyGeminiFallbackTrigger('refresh_token invalid');
  if (tokenTrigger !== 'refresh_token_error') throw new Error(`Wrong trigger: ${tokenTrigger}`);

  console.log('Smoke test PASSED');
  return { version: '2.1.0', purpose: 'Provider Health Status Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try {
    const report = runSmokeTest();
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('Smoke test FAILED:', error.message);
    process.exit(1);
  }
}
