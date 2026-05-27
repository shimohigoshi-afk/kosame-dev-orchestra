/**
 * Smoke Test: Semi-Auto Operation Policy v2.5.0
 */
const { classifyDecision, getPolicySnapshot, KOSAME_AUTO_DECISIONS, JUNYA_REQUIRED_DECISIONS } = require('../tools/semi-auto-operation-policy.js');

function runSmokeTest() {
  console.log('Running smoke test: Semi-Auto Operation Policy v2.5.0');

  if (!Array.isArray(KOSAME_AUTO_DECISIONS) || KOSAME_AUTO_DECISIONS.length === 0) throw new Error('KOSAME_AUTO_DECISIONS empty');
  if (!Array.isArray(JUNYA_REQUIRED_DECISIONS) || JUNYA_REQUIRED_DECISIONS.length === 0) throw new Error('JUNYA_REQUIRED_DECISIONS empty');

  // Kosame auto decisions
  const r1 = classifyDecision('provider_routing');
  if (r1.authority !== 'kosame') throw new Error(`provider_routing should be kosame, got: ${r1.authority}`);
  if (r1.requires_junya) throw new Error('provider_routing should not require junya');
  if (r1.approval_packet_needed) throw new Error('provider_routing should not need approval packet');

  const r2 = classifyDecision('verify_proceed');
  if (r2.authority !== 'kosame') throw new Error('verify_proceed should be kosame');

  // Junya required
  const r3 = classifyDecision('git_push');
  if (r3.authority !== 'junya') throw new Error(`git_push should be junya, got: ${r3.authority}`);
  if (!r3.requires_junya) throw new Error('git_push should require junya');
  if (!r3.approval_packet_needed) throw new Error('git_push should need approval packet');

  const r4 = classifyDecision('deploy');
  if (r4.authority !== 'junya') throw new Error('deploy should be junya');

  const r5 = classifyDecision('billing_api');
  if (r5.authority !== 'junya') throw new Error('billing_api should be junya');

  // Policy snapshot
  const snap = getPolicySnapshot();
  if (snap.policy_type !== 'semi_auto_operation_policy') throw new Error('Wrong policy_type');
  if (!snap.principle.includes('YES地獄')) throw new Error('Missing principle about YES地獄');
  if (snap.version !== '2.5.0') throw new Error('Version mismatch');

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Semi-Auto Operation Policy Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
