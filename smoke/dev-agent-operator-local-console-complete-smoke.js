/**
 * Smoke test for Operator Local Console Complete Pack v1.4.0
 */

const { finalizeLocalConsole } = require('../tools/operator-local-console-complete-pack.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Local Console Complete Pack v1.4.0');

  const result = finalizeLocalConsole();
  if (result.version !== '1.4.0') throw new Error('Version mismatch');
  if (result.status !== 'COMPLETE') throw new Error('Status should be COMPLETE');
  if (!Array.isArray(result.availableCommands)) throw new Error('availableCommands not an array');
  if (result.availableCommands.length === 0) throw new Error('availableCommands is empty');
  if (!result.dryRun) throw new Error('dryRun flag missing');

  const expectedCommands = ['status', 'next', 'approval', 'handoff', 'help'];
  expectedCommands.forEach(cmd => {
    if (!result.availableCommands.includes(cmd)) {
      throw new Error(`Missing expected command: ${cmd}`);
    }
  });

  console.log('Smoke test PASSED');
  return {
    version: '1.4.0',
    purpose: 'Operator Local Console Complete Pack Smoke Test',
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
