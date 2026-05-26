/**
 * Smoke test for Operator Local Console CLI v1.1.0
 */

const { runConsole } = require('../tools/operator-local-console-cli.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Local Console CLI v1.1.0');

  const result = runConsole('dashboard');
  if (result.command !== 'dashboard') throw new Error('Console delegation failed');

  console.log('Smoke test PASSED');
  return {
    version: '1.1.0',
    purpose: 'Operator Local Console CLI Smoke Test',
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
