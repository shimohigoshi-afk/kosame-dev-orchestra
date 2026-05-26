/**
 * Smoke test for KOSAME Dev Orchestra Local Operator Complete Pack v2.0.0
 */

const { generateV2CompleteRecord } = require('../tools/kosame-dev-orchestra-local-operator-complete-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: KOSAME Dev Orchestra Local Operator Complete Pack v2.0.0');

  const result = generateV2CompleteRecord();
  if (result.version !== '2.0.0') throw new Error('Version mismatch');
  if (result.status !== 'COMPLETE') throw new Error('Status should be COMPLETE');
  if (!Array.isArray(result.completedPacks)) throw new Error('completedPacks not an array');
  if (result.completedPacks.length === 0) throw new Error('completedPacks is empty');
  if (typeof result.teamContributions !== 'object') throw new Error('teamContributions missing');
  if (!result.humanApprovalRequired) throw new Error('humanApprovalRequired should be true');
  if (!result.dryRun) throw new Error('dryRun flag missing');

  const expectedPacks = ['v1.2.1', 'v1.2.2', 'v1.3.0', 'v1.4.0', 'v1.5.0', 'v2.0.0'];
  expectedPacks.forEach(v => {
    if (!result.completedPacks.some(p => p.startsWith(v))) {
      throw new Error(`Missing pack: ${v}`);
    }
  });

  console.log('Smoke test PASSED');
  return {
    version: '2.0.0',
    purpose: 'KOSAME Dev Orchestra Local Operator Complete Pack Smoke Test',
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
