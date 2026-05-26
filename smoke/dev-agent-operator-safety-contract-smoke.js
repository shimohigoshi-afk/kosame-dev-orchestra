/**
 * Smoke test for Operator Safety Contract Pack v1.2.4
 */

const { generateSafetyContract, validateAction, FORBIDDEN_ACTIONS } = require('../tools/operator-safety-contract-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Safety Contract Pack v1.2.4');

  const contract = generateSafetyContract();
  if (contract.version !== '1.2.4') throw new Error('Version mismatch');
  if (!Array.isArray(contract.forbiddenActions)) throw new Error('Forbidden actions missing');
  if (!Array.isArray(contract.allowedActions)) throw new Error('Allowed actions missing');
  if (!contract.dryRun) throw new Error('dryRun flag missing');

  const blocked = validateAction('git push origin main');
  if (blocked.verdict !== 'BLOCKED') throw new Error('git push should be BLOCKED');

  const allowed = validateAction('node --check');
  if (allowed.verdict !== 'ALLOWED') throw new Error('node --check should be ALLOWED');

  if (FORBIDDEN_ACTIONS.length === 0) throw new Error('Forbidden actions list empty');

  console.log('Smoke test PASSED');
  return {
    version: '1.2.4',
    purpose: 'Operator Safety Contract Pack Smoke Test',
    status: 'passed',
    dryRun: true
  };
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
