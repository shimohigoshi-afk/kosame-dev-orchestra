/**
 * Smoke test for GitHub Actions Recorder CLI v1.0.7
 */

const { recordActionsResult } = require('../tools/github-actions-recorder-cli.js');

function runSmokeTest() {
  console.log('Running smoke test: GitHub Actions Recorder CLI v1.0.7');

  // Test Success
  const successResult = recordActionsResult({ status: 'success' });
  if (successResult.nextAction !== 'Release') throw new Error('Success classification failed');

  // Test Failed
  const failedResult = recordActionsResult({ status: 'failed' });
  if (failedResult.nextAction !== 'Repair') throw new Error('Failure classification failed');

  // Test Running
  const runningResult = recordActionsResult({ status: 'running' });
  if (runningResult.nextAction !== 'Wait') throw new Error('Running classification failed');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.7',
    purpose: 'GitHub Actions Recorder CLI Smoke Test',
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
