/**
 * Smoke Test: Human Approval Gate Controller v2.5.0
 */
const { checkApprovalGate, evaluateActionList, GATE_REQUIRED_ACTIONS } = require('../tools/human-approval-gate-controller.js');

function runSmokeTest() {
  console.log('Running smoke test: Human Approval Gate Controller v2.5.0');

  if (!Array.isArray(GATE_REQUIRED_ACTIONS) || GATE_REQUIRED_ACTIONS.length === 0) throw new Error('GATE_REQUIRED_ACTIONS empty');

  // git push → gated
  const r1 = checkApprovalGate('git push');
  if (!r1.gate_required) throw new Error('git push should be gated');
  if (r1.proceed) throw new Error('git push should not proceed without approval');
  if (r1.version !== '2.5.0') throw new Error('Version mismatch');

  // git tag → gated
  const r2 = checkApprovalGate('git tag v2.5.0');
  if (!r2.gate_required) throw new Error('git tag should be gated');

  // deploy → gated
  const r3 = checkApprovalGate('deploy to cloud run');
  if (!r3.gate_required) throw new Error('deploy should be gated');

  // npm run verify → not gated
  const r4 = checkApprovalGate('npm run verify');
  if (r4.gate_required) throw new Error('npm run verify should NOT be gated');
  if (!r4.proceed) throw new Error('npm run verify should proceed');

  // node --check → not gated
  const r5 = checkApprovalGate('node --check');
  if (r5.gate_required) throw new Error('node --check should NOT be gated');

  // evaluateActionList
  const result = evaluateActionList(['git push', 'npm run verify', 'git tag v2.5.0', 'node --check', 'deploy']);
  if (result.gated_count < 3) throw new Error(`Should have at least 3 gated actions, got: ${result.gated_count}`);
  if (!result.human_approval_required) throw new Error('human_approval_required should be true');
  if (result.safe_to_proceed_without_human) throw new Error('Should NOT be safe without human');

  console.log('Smoke test PASSED');
  return { version: '2.5.0', purpose: 'Human Approval Gate Controller Smoke Test', status: 'passed', dryRun: true };
}

if (require.main === module) {
  try { const r = runSmokeTest(); console.log(JSON.stringify(r, null, 2)); }
  catch (e) { console.error('Smoke test FAILED:', e.message); process.exit(1); }
}
