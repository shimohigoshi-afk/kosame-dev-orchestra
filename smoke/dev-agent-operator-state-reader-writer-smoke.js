/**
 * Smoke test for Operator State Reader Writer v1.0.2
 */

const { readState, updateState } = require('../tools/operator-state-reader-writer.js');
const path = require('path');

function runSmokeTest() {
  console.log('Running smoke test: Operator State Reader Writer v1.0.2');

  const samplePath = path.join(__dirname, '../fixtures/operator-state.sample.json');
  const currentState = readState(samplePath);

  if (currentState.version !== '1.0.0') throw new Error('Invalid version in sample');

  const updates = {
    state: {
      workflowStatus: 'In-Progress',
      nextAction: 'Finalizing v1.0.2'
    }
  };

  const newState = updateState(currentState, updates);

  if (newState.state.workflowStatus !== 'In-Progress') throw new Error('State update failed');
  if (!newState.state.updatedAt) throw new Error('updatedAt not set');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.2',
    purpose: 'Operator State Reader Writer Smoke Test',
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
