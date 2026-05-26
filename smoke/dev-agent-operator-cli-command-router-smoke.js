/**
 * Smoke test for Operator CLI Command Router v1.0.1
 */

const { routeCommand } = require('../tools/operator-cli-command-router.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator CLI Command Router v1.0.1');

  // Test help
  const helpResult = routeCommand('help');
  if (helpResult.status !== 'help') throw new Error('Help command failed');

  // Test valid command
  const statusResult = routeCommand('status');
  if (statusResult.command !== 'status') throw new Error('Routing to status failed');

  // Test unknown command
  const unknownResult = routeCommand('unknown');
  if (unknownResult.status !== 'error') throw new Error('Unknown command error handling failed');

  console.log('Smoke test PASSED');
  return {
    version: '1.0.1',
    purpose: 'Operator CLI Command Router Smoke Test',
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
