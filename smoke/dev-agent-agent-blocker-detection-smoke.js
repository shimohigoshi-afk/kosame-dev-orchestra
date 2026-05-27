/**
 * Smoke Test: Agent Blocker Detection v2.3.0
 */
const { detectBlocker, classifyBlocker, BLOCKER_CATEGORIES } = require('../tools/agent-blocker-detection.js');

function runSmokeTest() {
  console.log('Running smoke test: Agent Blocker Detection v2.3.0');

  if (typeof BLOCKER_CATEGORIES !== 'object') throw new Error('BLOCKER_CATEGORIES missing');
  if (!BLOCKER_CATEGORIES.GEMINI_AUTH) throw new Error('GEMINI_AUTH category missing');

  // metadata server → GEMINI_AUTH
  const r1 = detectBlocker('metadata server application default credentials error');
  if (r1.blocker_type !== 'gemini_auth_error') throw new Error(`Should detect gemini_auth_error, got: ${r1.blocker_type}`);
  if (!r1.is_gemini_blocker) throw new Error('Should be a gemini blocker');
  if (r1.recommended_action !== 'fallback_to_claude_immediately') throw new Error('auth should fallback immediately');

  // refresh_token → GEMINI_AUTH
  const r2 = detectBlocker('refresh_token invalid or expired');
  if (r2.blocker_type !== 'gemini_auth_error') throw new Error(`refresh_token should be auth_error, got: ${r2.blocker_type}`);

  // quota → GEMINI_QUOTA
  const r3 = detectBlocker('QUOTA_EXHAUSTED: daily limit reached');
  if (r3.blocker_type !== 'gemini_quota_exhausted') throw new Error(`quota should be gemini_quota_exhausted, got: ${r3.blocker_type}`);

  // verify fail → VERIFY_FAILURE
  const r4 = detectBlocker('npm run verify: 3 FAILED');
  if (r4.blocker_type !== 'verify_failure') throw new Error(`verify fail should be verify_failure, got: ${r4.blocker_type}`);
  if (r4.recommended_action !== 'claude_repair_mode') throw new Error('verify fail should trigger claude repair');

  // actions fail → ACTIONS_FAILURE
  const r5 = detectBlocker('GitHub Actions workflow failed');
  if (r5.blocker_type !== 'github_actions_failure') throw new Error(`actions fail should be github_actions_failure, got: ${r5.blocker_type}`);

  // empty → UNKNOWN
  const r6 = detectBlocker('');
  if (r6.blocker_type !== 'unknown') throw new Error('Empty error should be unknown');

  if (r1.version !== '2.3.0') throw new Error('Version mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.3.0', purpose: 'Agent Blocker Detection Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
