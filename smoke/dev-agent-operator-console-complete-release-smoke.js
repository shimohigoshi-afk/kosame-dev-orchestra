/**
 * Smoke test for Operator Console Complete Release Pack v1.5.0
 */

const { generateCompleteRelease } = require('../tools/operator-console-complete-release-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Console Complete Release Pack v1.5.0');

  const result = generateCompleteRelease();
  if (result.version !== '1.5.0') throw new Error('Version mismatch');
  if (result.status !== 'RELEASE_READY') throw new Error('Status should be RELEASE_READY');
  if (!Array.isArray(result.summary)) throw new Error('Summary not an array');
  if (result.summary.length === 0) throw new Error('Summary is empty');
  if (!Array.isArray(result.postV1Roadmap)) throw new Error('postV1Roadmap not an array');
  if (!result.humanApprovalRequired) throw new Error('humanApprovalRequired should be true');
  if (!result.dryRun) throw new Error('dryRun flag missing');

  console.log('Smoke test PASSED');
  return {
    version: '1.5.0',
    purpose: 'Operator Console Complete Release Pack Smoke Test',
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
