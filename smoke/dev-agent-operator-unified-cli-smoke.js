/**
 * Smoke test for Operator Unified CLI v1.2.1
 */

const { routeUnifiedCommand, getCommandMap } = require('../tools/operator-unified-cli.js');

function runSmokeTest() {
  console.log('Running smoke test: Operator Unified CLI v1.2.1');

  const help = routeUnifiedCommand('help');
  if (!help.availableCommands) throw new Error('Command map missing');
  if (help.version !== '1.2.1') throw new Error('Version mismatch');

  const status = routeUnifiedCommand('status');
  if (status.command !== 'status') throw new Error('Command routing failed');
  if (!status.resolvedTool) throw new Error('Resolved tool missing');

  const map = getCommandMap();
  if (!Array.isArray(map) || map.length === 0) throw new Error('Command map empty');

  const unknown = routeUnifiedCommand('nonexistent');
  if (!unknown.error) throw new Error('Unknown command should return error');

  console.log('Smoke test PASSED');
  return {
    version: '1.2.1',
    purpose: 'Operator Unified CLI Smoke Test',
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
