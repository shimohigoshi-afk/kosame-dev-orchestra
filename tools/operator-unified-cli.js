/**
 * Operator Unified CLI v1.2.1
 *
 * Single entry point that routes all Operator Console commands.
 */

const COMMANDS = {
  status: 'operator-cli-status',
  next: 'operator-next-action-engine',
  approval: 'operator-approval-summary',
  handoff: 'operator-handoff-cli',
  'verify-record': 'verify-result-recorder-cli',
  'actions-record': 'github-actions-recorder-cli',
  dashboard: 'operator-dashboard-snapshot',
  release: 'operator-release-record-pack',
  'escalate-claude': 'operator-claude-escalation-pack',
  'next-gemini': 'operator-gemini-next-work-pack',
  help: '__help__'
};

function getCommandMap() {
  return Object.entries(COMMANDS).map(([cmd, tool]) => ({ command: cmd, tool }));
}

function routeUnifiedCommand(command) {
  if (!command || command === 'help' || command === '__help__') {
    return {
      version: '1.2.1',
      name: 'KOSAME Operator Unified CLI',
      availableCommands: getCommandMap(),
      usage: 'node tools/operator-unified-cli.js <command>'
    };
  }

  const tool = COMMANDS[command];
  if (!tool) {
    return { error: `Unknown command: ${command}`, availableCommands: Object.keys(COMMANDS) };
  }

  return {
    version: '1.2.1',
    command,
    resolvedTool: tool,
    invocation: `node tools/${tool}.js`,
    dryRun: true
  };
}

module.exports = { routeUnifiedCommand, getCommandMap };

if (require.main === module) {
  const [,, command] = process.argv;
  const result = routeUnifiedCommand(command);
  console.log(JSON.stringify(result, null, 2));
}
