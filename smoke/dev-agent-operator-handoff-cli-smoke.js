/**
 * Smoke test for Operator Handoff CLI v1.0.5
 */

const { generateHandoff } = require('../tools/operator-handoff-cli.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Handoff CLI v1.0.5');

  const mockState = {
    state: {
      currentVersion: '1.0.5',
      lastCommit: 'abc1234',
      riskLevel: 'Medium',
      nextAction: 'Finalize Handoff'
    }
  };

  const handoff = generateHandoff(mockState, ['Test Completed'], ['Test Pending']);

  if (!handoff.includes('1.0.5')) throw new Error('Version missing in handoff');
  if (!handoff.includes('Test Completed')) throw new Error('Completed work missing');
  if (!handoff.includes('Medium')) throw new Error('Risk level missing');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.5',
    purpose: 'Operator Handoff CLI Smoke Test',
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
