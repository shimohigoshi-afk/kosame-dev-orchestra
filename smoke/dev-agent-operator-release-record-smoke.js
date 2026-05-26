/**
 * Smoke test for Operator Release Record Pack v1.1.2
 */

const { createReleaseRecord } = require('../tools/operator-release-record-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Release Record Pack v1.1.2');

  const record = createReleaseRecord({
    version: '1.1.2',
    commit: 'f00b4r',
    verified: true
  });

  if (record.record.version !== '1.1.2') throw new Error('Version mismatch');
  if (record.record.verified !== true) throw new Error('Verification status mismatch');

  console.log('Smoke test PASSED');
  return {
    version: '1.1.2',
    purpose: 'Operator Release Record Pack Smoke Test',
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
