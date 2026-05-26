/**
 * Smoke test for Verify Result Recorder CLI v1.0.6
 */

const { recordVerifyResult } = require('../tools/verify-result-recorder-cli.js');

function runSmokeTest() {
  console.log('Running smoke test: Verify Result Recorder CLI v1.0.6');

  // Test Pass
  const passResult = recordVerifyResult({ status: 'pass' });
  if (passResult.result !== 'pass') throw new Error('Pass recording failed');
  if (passResult.commitAllowed !== true) throw new Error('Commit should be allowed on pass');

  // Test Fail
  const failResult = recordVerifyResult({ status: 'fail', failedSmoke: ['smoke1'] });
  if (failResult.result !== 'fail') throw new Error('Fail recording failed');
  if (failResult.nextRepairOwner !== 'Claude') throw new Error('Should suggest Claude for smoke failures');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.6',
    purpose: 'Verify Result Recorder CLI Smoke Test',
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
