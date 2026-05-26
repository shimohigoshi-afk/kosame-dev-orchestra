/**
 * Smoke test for Operator Console Bundle Pack v1.2.2
 */

const { buildConsoleBundle } = require('../tools/operator-console-bundle-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Console Bundle Pack v1.2.2');

  const bundle = buildConsoleBundle();
  if (bundle.version !== '1.2.2') throw new Error('Version mismatch');
  if (bundle.bundleType !== 'operator-console') throw new Error('Bundle type mismatch');
  if (!bundle.timestamp) throw new Error('Timestamp missing');
  if (!bundle.dryRun) throw new Error('dryRun flag missing');

  const custom = buildConsoleBundle({ state: { workflowStatus: 'Running', riskLevel: 'High' } });
  if (custom.state.workflowStatus !== 'Running') throw new Error('Custom state not applied');

  console.log('Smoke test PASSED');
  return {
    version: '1.2.2',
    purpose: 'Operator Console Bundle Pack Smoke Test',
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
