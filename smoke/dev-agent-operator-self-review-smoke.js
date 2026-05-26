/**
 * Smoke test for Operator Self Review Pack v1.3.0
 */

const { runSelfReview, RUBRIC } = require('../tools/operator-self-review-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Self Review Pack v1.3.0');

  const empty = runSelfReview();
  if (empty.version !== '1.3.0') throw new Error('Version mismatch');
  if (empty.verdict !== 'NOT_READY') throw new Error('Empty review should be NOT_READY');
  if (empty.summary.passed !== 0) throw new Error('No criteria should pass with empty input');

  const allCriteria = RUBRIC.map(r => r.criterion);
  const full = runSelfReview(allCriteria);
  if (full.verdict !== 'RELEASE_READY') throw new Error('All passed should be RELEASE_READY');
  if (!full.summary.allCriticalPassed) throw new Error('All critical should pass');

  if (RUBRIC.length === 0) throw new Error('Rubric is empty');

  console.log('Smoke test PASSED');
  return {
    version: '1.3.0',
    purpose: 'Operator Self Review Pack Smoke Test',
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
