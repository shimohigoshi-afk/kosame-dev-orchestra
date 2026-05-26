/**
 * Smoke test for Operator Dashboard Snapshot v1.1.1
 */

const { generateSnapshot } = require('../tools/operator-dashboard-snapshot.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Dashboard Snapshot v1.1.1');

  const mockState = {
    state: {
      currentPhase: 'Test',
      currentVersion: '1.1.1',
      pendingApproval: [],
      riskLevel: 'Low',
      nextAction: 'None',
      activeAgent: 'Gemini'
    }
  };

  const snapshot = generateSnapshot(mockState, null, null);

  if (snapshot.cards.status.version !== '1.1.1') throw new Error('Version mismatch');
  if (snapshot.cards.governance.riskLevel !== 'Low') throw new Error('Risk level mismatch');

  console.log('Smoke test PASSED');
  return {
    version: '1.1.1',
    purpose: 'Operator Dashboard Snapshot Smoke Test',
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
